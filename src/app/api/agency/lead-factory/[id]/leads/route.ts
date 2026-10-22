import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const leads = await prisma.leadFactoryLead.findMany({
    where: { runId: id, status: { not: "deleted" } },
    orderBy: [{ score: "desc" }, { num: "asc" }],
  });

  return NextResponse.json(leads);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { company, website, decisionMaker, dmRole, xHandle, instagramHandle, linkedinUrl, dmEmail, whatItIs, grade, score, segment } = body;

  if (!company?.trim()) return NextResponse.json({ error: "Company name required" }, { status: 400 });

  const lead = await prisma.leadFactoryLead.create({
    data: {
      runId: id,
      company: company.trim(),
      website: website?.trim() || "",
      decisionMaker: decisionMaker?.trim() || null,
      dmRole: dmRole?.trim() || null,
      xHandle: xHandle?.trim() || null,
      instagramHandle: instagramHandle?.trim() || null,
      linkedinUrl: linkedinUrl?.trim() || null,
      dmEmail: dmEmail?.trim() || null,
      whatItIs: whatItIs?.trim() || null,
      grade: grade || null,
      score: score || null,
      segment: segment?.trim() || null,
    },
  });

  return NextResponse.json(lead, { status: 201 });
}
