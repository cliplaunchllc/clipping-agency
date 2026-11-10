import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Accept any string niche — the dashboard normalises/displays it
const VALID_NICHES = ["gaming", "entertainment", "agency", "sports", "podcast", "irl", "other"] as const;
type Niche = (typeof VALID_NICHES)[number] | string;

interface IncomingLead {
  name?: unknown;
  company?: unknown;
  email?: unknown;
  instagram?: unknown;
  linkedin?: unknown;
  x?: unknown;
  contactPerson?: unknown;
  contactRole?: unknown;
  studioCustom?: unknown;
  description?: unknown;
  notes?: unknown;         // outreach message sent to lead
  initialMessage?: unknown; // what the lead first sent / last reply from them
  replyMessage?: unknown;  // alias for initialMessage
  replied?: unknown;       // boolean — did they reply?
  inConvo?: unknown;       // boolean — are we actively in conversation?
  whoMessaged?: unknown;   // which team member sent the outreach
  source?: unknown;
}

interface ImportBody {
  niche?: unknown;
  leads?: unknown;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function bool(v: unknown): boolean | undefined {
  if (v === true || v === "true" || v === 1) return true;
  if (v === false || v === "false" || v === 0) return false;
  return undefined;
}

function buildCompanyDescription(lead: IncomingLead): string | null {
  const parts: string[] = [];
  if (lead.company)       parts.push(String(lead.company).trim());
  if (lead.description)   parts.push(String(lead.description).trim());
  if (lead.contactPerson) parts.push(`Contact: ${lead.contactPerson}`);
  if (lead.contactRole)   parts.push(`Role: ${lead.contactRole}`);
  if (lead.studioCustom)  parts.push(String(lead.studioCustom).trim());
  return parts.length > 0 ? parts.join(" — ") : null;
}

export async function POST(req: NextRequest) {
  const providedSecret = (req.headers.get("x-import-secret") ?? "").trim();
  const expectedSecret = (process.env.LEADS_IMPORT_SECRET ?? "").trim();
  if (!providedSecret || !expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ImportBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const niche = (body.niche as Niche) ?? null;

  if (!Array.isArray(body.leads) || body.leads.length === 0) {
    return NextResponse.json({ error: "leads must be a non-empty array" }, { status: 400 });
  }

  const incoming = body.leads as IncomingLead[];

  // Single DB lookup for all emails in this batch
  const emailsInBatch = incoming
    .map((l) => (typeof l.email === "string" ? l.email.trim().toLowerCase() : null))
    .filter((e): e is string => !!e);

  const existing = await prisma.crmLead.findMany({
    where: { email: { in: emailsInBatch, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  const existingByEmail = new Map(existing.map((r) => [r.email!.trim().toLowerCase(), r.id]));

  let added = 0;
  let updated = 0;
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

    // Derive reply state — if either reply field is populated, they replied
    const theirMessage = str(lead.initialMessage) ?? str(lead.replyMessage);
    const repliedExplicit = bool(lead.replied);
    const hasReplied = repliedExplicit ?? (theirMessage !== null);
    const inConvoVal = bool(lead.inConvo) ?? false;

    const existingId = email ? existingByEmail.get(email.toLowerCase()) : undefined;

    if (existingId) {
      // UPSERT: update reply/convo state on existing lead so Grok can sync back
      try {
        await prisma.crmLead.update({
          where: { id: existingId },
          data: {
            ...(theirMessage !== null ? { initialMessage: theirMessage } : {}),
            ...(hasReplied ? { replied: true } : {}),
            ...(inConvoVal ? { inConvo: true } : {}),
            // Refresh socials / description if Grok has better data
            ...(str(lead.instagram) ? { instagram: str(lead.instagram) } : {}),
            ...(str(lead.linkedin) ? { linkedin: str(lead.linkedin) } : {}),
            ...(str(lead.x) ? { x: str(lead.x) } : {}),
            ...(buildCompanyDescription(lead) ? { companyDescription: buildCompanyDescription(lead) } : {}),
          },
        });
        updated++;
      } catch (err) {
        errors.push({ index: i, reason: err instanceof Error ? err.message : "unknown error" });
      }
      continue;
    }

    // New lead — create it
    try {
      await prisma.crmLead.create({
        data: {
          leadName:           name,
          email:              email || null,
          instagram:          str(lead.instagram),
          linkedin:           str(lead.linkedin),
          x:                  str(lead.x),
          niche:              niche || null,
          companyDescription: buildCompanyDescription(lead),
          notes:              str(lead.notes),
          initialMessage:     theirMessage,
          replied:            hasReplied,
          inConvo:            inConvoVal,
          whoMessaged:        str(lead.whoMessaged),
          leadSource:         "Grok Bot",
        },
      });
      if (email) existingByEmail.set(email.toLowerCase(), "pending");
      added++;
    } catch (err) {
      errors.push({ index: i, reason: err instanceof Error ? err.message : "unknown error" });
    }
  }

  // Suppress skipped count — we updated instead of skipping
  void skipped;

  return NextResponse.json({ added, updated, errors });
}
