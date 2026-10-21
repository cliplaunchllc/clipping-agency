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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "agency") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  const boolFields = [
    "outreachedIg", "outreachedEmail", "outreachedLinkedin", "outreachedX",
    "replied", "callBooked", "showedUpToCall", "closedCall", "inConvo", "leadLost", "markedDone",
  ];
  const dateFields = ["dateMessaged", "followUp1", "followUp2", "followUp3", "lastFollowUpDate"];
  const strFields = ["leadName", "instagram", "email", "linkedin", "x", "whoMessaged", "replyMessage", "notes", "leadSource"];

  for (const f of boolFields) {
    if (f in body) data[f] = Boolean(body[f]);
  }
  for (const f of dateFields) {
    if (f in body) data[f] = body[f] ? new Date(body[f]) : null;
  }
  for (const f of strFields) {
    if (f in body) data[f] = body[f] || null;
  }

  const lead = await prisma.crmLead.update({ where: { id }, data });
  return NextResponse.json(serializeLead(lead));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "agency") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.crmLead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
