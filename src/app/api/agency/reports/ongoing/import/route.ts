import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function requireSecret(req: NextRequest): boolean {
  const secret = process.env.REPORT_SECRET;
  return !!secret && req.headers.get("x-report-secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!requireSecret(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { date?: unknown; reports?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date, reports } = body;

  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 });

  if (!Array.isArray(reports))
    return NextResponse.json({ error: "reports must be an array" }, { status: 400 });

  const reportDate = new Date(date + "T00:00:00.000Z");
  const VALID_STATUSES = ["Strong", "Normal", "NeedsAttention"] as const;
  type ReportStatus = (typeof VALID_STATUSES)[number];

  let created = 0, updated = 0, skipped = 0;
  const errors: Array<{ index: number; message: string }> = [];

  for (let i = 0; i < reports.length; i++) {
    const r = reports[i] as Record<string, unknown>;

    // Resolve client
    let clientId: string | null = null;

    if (typeof r.clientId === "string" && r.clientId.trim()) {
      const c = await prisma.client.findUnique({
        where: { id: r.clientId.trim() },
        select: { id: true },
      });
      if (c) clientId = c.id;
    }

    if (!clientId && typeof r.clientName === "string" && r.clientName.trim()) {
      const c = await prisma.client.findFirst({
        where: { name: { equals: r.clientName.trim(), mode: "insensitive" } },
        select: { id: true },
      });
      if (c) clientId = c.id;
    }

    if (!clientId) {
      errors.push({
        index: i,
        message: `client not found (clientId=${r.clientId ?? "none"}, clientName=${r.clientName ?? "none"})`,
      });
      skipped++;
      continue;
    }

    const campaignName =
      typeof r.campaignName === "string" && r.campaignName.trim()
        ? r.campaignName.trim()
        : null;

    if (!campaignName) {
      errors.push({ index: i, message: "campaignName is required" });
      skipped++;
      continue;
    }

    if (!VALID_STATUSES.includes(r.status as ReportStatus)) {
      errors.push({
        index: i,
        message: `invalid status "${r.status}"; must be Strong, Normal, or NeedsAttention`,
      });
      skipped++;
      continue;
    }

    // Resolve optional campaignId
    let campaignId: string | null = null;
    if (typeof r.campaignId === "string" && r.campaignId.trim()) {
      const camp = await prisma.clientCampaign.findFirst({
        where: { id: r.campaignId.trim(), clientId },
        select: { id: true },
      });
      campaignId = camp?.id ?? null;
    }
    if (!campaignId) {
      const camp = await prisma.clientCampaign.findFirst({
        where: { name: { equals: campaignName, mode: "insensitive" }, clientId },
        select: { id: true },
      });
      campaignId = camp?.id ?? null;
    }

    const data = {
      status:           r.status as ReportStatus,
      viewsTotal:       typeof r.viewsTotal === "number" ? r.viewsTotal : 0,
      viewsToday:       typeof r.viewsToday === "number" ? r.viewsToday : 0,
      totalSubmissions: typeof r.totalSubmissions === "number" ? r.totalSubmissions : 0,
      pending:          typeof r.pending === "number" ? r.pending : 0,
      approved:         typeof r.approved === "number" ? r.approved : 0,
      rejected:         typeof r.rejected === "number" ? r.rejected : 0,
      amountSpent:      typeof r.amountSpent === "number" ? r.amountSpent : null,
      effectiveCpm:     typeof r.effectiveCpm === "number" ? r.effectiveCpm : null,
      mainTrend:        typeof r.mainTrend === "string" ? r.mainTrend : null,
      clipperFeedback:  typeof r.clipperFeedback === "string" ? r.clipperFeedback : null,
      mainOptimization: typeof r.mainOptimization === "string" ? r.mainOptimization : null,
      totalBudget:      typeof r.totalBudget === "number" ? r.totalBudget : null,
      budgetRemaining:  typeof r.budgetRemaining === "number" ? r.budgetRemaining : null,
      platformViews:    r.platformViews != null ? (r.platformViews as object) : undefined,
      topClips:         r.topClips != null ? (r.topClips as object) : undefined,
      campaignId:       campaignId,
    };

    try {
      const existing = await prisma.ongoingReport.findFirst({
        where: {
          clientId,
          campaignName: { equals: campaignName, mode: "insensitive" },
          date: reportDate,
        },
        select: { id: true },
      });

      if (existing) {
        await prisma.ongoingReport.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.ongoingReport.create({
          data: { clientId, campaignName, date: reportDate, ...data },
        });
        created++;
      }
    } catch (err) {
      errors.push({ index: i, message: err instanceof Error ? err.message : "unknown error" });
      skipped++;
    }
  }

  return NextResponse.json({ created, updated, skipped, errors });
}
