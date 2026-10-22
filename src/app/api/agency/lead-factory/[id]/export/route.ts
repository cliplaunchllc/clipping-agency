import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "agency")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const run = await prisma.leadRun.findUnique({ where: { id } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const leads = await prisma.leadFactoryLead.findMany({
    where: { runId: id },
    orderBy: { num: "asc" },
  });

  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };

  const headers = [
    "#", "Company", "Website", "What It Is", "Segment",
    "Grade", "Score", "Decision Maker", "Role",
    "Email", "Instagram", "Twitter/X", "LinkedIn", "Discord",
    "Best Channel", "Why It Fits", "Status",
  ];

  const rows = leads.map((l) => {
    const why = l.whyItFits as { reason?: string; channel?: string; linkedin?: string; discord?: string } | null;
    return [
      l.num,
      l.company,
      l.website,
      l.whatItIs ?? "",
      l.segment ?? "",
      l.grade ?? "",
      l.score ?? "",
      l.decisionMaker ?? "",
      l.dmRole ?? "",
      l.dmEmail ?? "",
      l.instagramHandle ?? "",
      l.xHandle ?? "",
      why?.linkedin ?? "",
      why?.discord ?? "",
      l.bestChannel ?? "",
      why?.reason ?? "",
      l.status,
    ].map(escape).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const filename = `leads-${run.prompt.slice(0, 30).replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
