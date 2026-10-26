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
    where: { runId: id, dmEmail: { not: null } },
    orderBy: { num: "asc" },
  });

  const escape = (v: unknown) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };

  const headers = ["Name", "Description", "Email"];

  const rows = leads.map((l) => {
    const raw = (l.rawData ?? {}) as Record<string, unknown>;
    const name = (raw["gameName"] as string | undefined) || l.company;
    const description = l.whatItIs ?? "";
    const email = l.dmEmail ?? "";
    return [name, description, email].map(escape).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const slug = (run.prompt ?? run.criteria ?? "leads").slice(0, 30).replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const filename = `leads-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
