import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { CrmLead } from "@prisma/client";

function serializeLead(l: CrmLead) {
  return {
    ...l,
    dateMessaged: l.dateMessaged?.toISOString() ?? null,
    followUp1: l.followUp1?.toISOString() ?? null,
    followUp2: l.followUp2?.toISOString() ?? null,
    followUp3: l.followUp3?.toISOString() ?? null,
    lastFollowUpDate: l.lastFollowUpDate?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "agency") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leads = await prisma.crmLead.findMany({
    orderBy: { createdAt: "asc" },
  });

  // Deduplicate in response (keep oldest per name)
  const seen = new Set<string>();
  const deduped = leads.filter((l) => {
    const key = l.leadName.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json(deduped.map(serializeLead));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "agency") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Handle bulk import (array of leads)
  if (Array.isArray(body)) {
    // Fetch existing lead names (lowercased) to skip duplicates
    const existing = await prisma.crmLead.findMany({ select: { leadName: true } });
    const existingNames = new Set(existing.map((l) => l.leadName.trim().toLowerCase()));

    const incoming = body.map((l: Record<string, string>) => ({
      leadName: (l.leadName || l["Lead Name"] || l["lead_name"] || "").trim(),
      instagram: l.instagram || l["Instagram"] || undefined,
      email: l.email || l["Email"] || undefined,
      linkedin: l.linkedin || l["LinkedIn"] || undefined,
      x: l.x || l["X"] || l["Twitter"] || l["twitter"] || undefined,
      leadSource: "cold_outbound", // CSV imports are always cold outbound
    })).filter((l) => l.leadName.length > 0);

    // Deduplicate within the CSV itself (keep first occurrence per name)
    const seenInCsv = new Set<string>();
    const deduped = incoming.filter((l) => {
      const key = l.leadName.toLowerCase();
      if (seenInCsv.has(key)) return false;
      seenInCsv.add(key);
      return true;
    });

    const toCreate = deduped.filter((l) => !existingNames.has(l.leadName.toLowerCase()));
    const skipped = incoming.length - toCreate.length;

    // Explicitly stamp each row 1ms apart in CSV order so sort by createdAt
    // always reflects top-to-bottom CSV position, even on fast DBs.
    const baseTime = Date.now();
    for (let i = 0; i < toCreate.length; i++) {
      await prisma.crmLead.create({
        data: { ...toCreate[i], createdAt: new Date(baseTime + i) },
      });
    }
    const count = toCreate.length;

    return NextResponse.json({ created: count, skipped });
  }

  // Single lead creation
  const lead = await prisma.crmLead.create({
    data: {
      leadName: body.leadName,
      instagram: body.instagram || null,
      email: body.email || null,
      linkedin: body.linkedin || null,
      x: body.x || null,
      leadSource: body.leadSource || "cold_outbound",
    },
  });

  return NextResponse.json(serializeLead(lead), { status: 201 });
}

// DELETE ?all=true → wipe every lead
// DELETE (no params) → remove duplicate leads (keep oldest per name)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "agency") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get("all") === "true") {
    const { count } = await prisma.crmLead.deleteMany();
    return NextResponse.json({ removed: count });
  }

  const all = await prisma.crmLead.findMany({ orderBy: { createdAt: "asc" } });

  // Group by lowercased name, keep first (oldest), collect rest to delete
  const seen = new Map<string, string>(); // name → id to keep
  const toDelete: string[] = [];

  for (const lead of all) {
    const key = lead.leadName.trim().toLowerCase();
    if (seen.has(key)) {
      toDelete.push(lead.id);
    } else {
      seen.set(key, lead.id);
    }
  }

  if (toDelete.length > 0) {
    await prisma.crmLead.deleteMany({ where: { id: { in: toDelete } } });
  }

  return NextResponse.json({ removed: toDelete.length });
}
