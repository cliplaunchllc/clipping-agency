import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const timeframe = searchParams.get("timeframe") || "7d";

  let startDate = new Date();
  if (timeframe === "1d") startDate.setDate(startDate.getDate() - 1);
  else if (timeframe === "7d") startDate.setDate(startDate.getDate() - 7);
  else if (timeframe === "30d") startDate.setDate(startDate.getDate() - 30);
  else if (timeframe === "90d") startDate.setDate(startDate.getDate() - 90);
  else if (searchParams.get("startDate")) startDate = new Date(searchParams.get("startDate")!);

  // Build submission filter
  const submissionFilter: Record<string, unknown> = {
    submittedAt: { lte: new Date() },
  };
  if (clientId) {
    submissionFilter.subAccount = { clientId };
  } else if (session.user.role === "client") {
    const ca = await prisma.clientAccount.findUnique({ where: { userId: session.user.id } });
    if (ca) submissionFilter.subAccount = { clientId: ca.id };
  } else if (session.user.role === "clipper") {
    const clipper = await prisma.clipper.findUnique({ where: { userId: session.user.id } });
    if (clipper) submissionFilter.clipperId = clipper.id;
  }

  const snapshots = await prisma.metricSnapshot.findMany({
    where: {
      timestamp: { gte: startDate },
      submission: submissionFilter,
    },
    include: { submission: { include: { subAccount: { include: { client: true } } } } },
    orderBy: { timestamp: "asc" },
  });

  // Group by day for chart
  const byDay: Record<string, { views: number; likes: number; comments: number; shares: number; saves: number }> = {};
  for (const snap of snapshots) {
    const day = snap.timestamp.toISOString().split("T")[0];
    if (!byDay[day]) byDay[day] = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
    const prev = byDay[day];
    prev.views = Math.max(prev.views, Number(snap.views));
    prev.likes = Math.max(prev.likes, Number(snap.likes));
    prev.comments = Math.max(prev.comments, Number(snap.comments));
    prev.shares = Math.max(prev.shares, Number(snap.shares));
    prev.saves = Math.max(prev.saves, Number(snap.saves));
  }

  const chartData = Object.entries(byDay).map(([date, metrics]) => ({ date, ...metrics }));

  // Totals
  const totals = chartData.reduce(
    (acc, d) => ({
      views: acc.views + d.views,
      likes: acc.likes + d.likes,
      comments: acc.comments + d.comments,
      shares: acc.shares + d.shares,
      saves: acc.saves + d.saves,
    }),
    { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 }
  );

  return NextResponse.json({
    chartData,
    totals,
    snapshots: snapshots.map((s) => ({
      ...s,
      views: Number(s.views),
      likes: Number(s.likes),
      comments: Number(s.comments),
      shares: Number(s.shares),
      saves: Number(s.saves),
    })),
  });
}
