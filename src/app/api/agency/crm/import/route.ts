import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_NICHES = ["gaming", "entertainment", "agency"] as const;
type Niche = (typeof VALID_NICHES)[number];

interface IncomingLead {
  name?: unknown;
  company?: unknown;
  email?: unknown;
  contactPerson?: unknown;
  contactRole?: unknown;
  studioCustom?: unknown;
  description?: unknown;
  notes?: unknown;
  source?: unknown;
}

interface ImportBody {
  niche?: unknown;
  leads?: unknown;
}

function buildNotes(lead: IncomingLead, niche: Niche): string {
  const parts: string[] = [`[niche: ${niche}]`];
  if (lead.company)       parts.push(`[company: ${lead.company}]`);
  if (lead.contactPerson) parts.push(`[contactPerson: ${lead.contactPerson}]`);
  if (lead.contactRole)   parts.push(`[contactRole: ${lead.contactRole}]`);
  if (lead.studioCustom)  parts.push(`[studioCustom: ${lead.studioCustom}]`);
  if (lead.description)   parts.push(`[description: ${lead.description}]`);
  if (lead.notes)         parts.push(String(lead.notes));
  return parts.join(" ").trim();
}

export async function POST(req: NextRequest) {
  // Authenticate with secret header
  const secret = req.headers.get("x-import-secret");
  if (!secret || secret !== process.env.LEADS_IMPORT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ImportBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate niche
  const niche = body.niche as Niche;
  if (!VALID_NICHES.includes(niche)) {
    return NextResponse.json(
      { error: `niche must be one of: ${VALID_NICHES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate leads array
  if (!Array.isArray(body.leads) || body.leads.length === 0) {
    return NextResponse.json(
      { error: "leads must be a non-empty array" },
      { status: 400 }
    );
  }

  const incoming = body.leads as IncomingLead[];

  // Collect all non-empty emails from the batch for a single DB lookup
  const emailsInBatch = incoming
    .map((l) => (typeof l.email === "string" ? l.email.trim().toLowerCase() : null))
    .filter((e): e is string => !!e);

  // Fetch existing records whose email matches any in this batch (case-insensitive)
  const existing = await prisma.crmLead.findMany({
    where: {
      email: {
        in: emailsInBatch,
        mode: "insensitive",
      },
    },
    select: { email: true },
  });
  const existingEmails = new Set(
    existing.map((r) => r.email!.trim().toLowerCase())
  );

  let added = 0;
  let skipped = 0;
  const errors: Array<{ index: number; reason: string }> = [];

  for (let i = 0; i < incoming.length; i++) {
    const lead = incoming[i];

    const name = typeof lead.name === "string" ? lead.name.trim() : "";
    const email = typeof lead.email === "string" ? lead.email.trim() : "";

    if (!name) {
      errors.push({ index: i, reason: "missing name" });
      continue;
    }

    // Skip if email already exists in DB
    if (email && existingEmails.has(email.toLowerCase())) {
      skipped++;
      continue;
    }

    try {
      await prisma.crmLead.create({
        data: {
          leadName:   name,
          email:      email || null,
          notes:      buildNotes(lead, niche),
          leadSource: "Grok Bot",
        },
      });
      // Track within-batch so a repeated email in the same batch is also skipped
      if (email) existingEmails.add(email.toLowerCase());
      added++;
    } catch (err) {
      errors.push({ index: i, reason: err instanceof Error ? err.message : "unknown error" });
    }
  }

  return NextResponse.json({ added, skipped, errors });
}
