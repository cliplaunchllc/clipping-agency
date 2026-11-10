import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

function auth(req: NextRequest): boolean {
  return req.headers.get("x-report-secret") === process.env.REPORT_SECRET;
}

function serializeStats(s: {
  id: string; campaignId: string; clientId: string; asOf: Date;
  viewsTotal: number; viewsToday: number; totalSubmissions: number;
  pending: number; approved: number; rejected: number;
  amountSpent: number | null; effectiveCpm: number | null;
  totalBudget: number | null; budgetRemaining: number | null;
  tiktokViews: number; instagramViews: number; youtubeViews: number;
  platformViews: unknown; topClips: unknown; status: string; updatedAt: Date;
}) {
  return {
    id: s.id,
    campaignId: s.campaignId,
    clientId: s.clientId,
    asOf: s.asOf.toISOString(),
    viewsTotal: s.viewsTotal,
    viewsToday: s.viewsToday,
    totalSubmissions: s.totalSubmissions,
    pending: s.pending,
    approved: s.approved,
    rejected: s.rejected,
    amountSpent: s.amountSpent ?? null,
    effectiveCpm: s.effectiveCpm ?? null,
    totalBudget: s.totalBudget ?? null,
    budgetRemaining: s.budgetRemaining ?? null,
    tiktokViews: s.tiktokViews,
    instagramViews: s.instagramViews,
    youtubeViews: s.youtubeViews,
    platformViews: (s.platformViews as Record<string, number> | null) ?? null,
    topClips: (s.topClips as Record<string, unknown>[] | null) ?? null,
    status: s.status as "Strong" | "Normal" | "NeedsAttention",
    updatedAt: s.updatedAt.toISOString(),
  };
}

// ─── POST: upsert campaign stats ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { asOf?: string; campaigns?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.campaigns || !Array.isArray(body.campaigns)) {
    return NextResponse.json({ error: "campaigns array required" }, { status: 400 });
  }

  const asOf = body.asOf ? new Date(body.asOf) : new Date();
  const results = { updated: 0, skipped: 0, errors: [] as string[] };

  for (const item of body.campaigns) {
    const c = item as Record<string, unknown>;
    const { campaignId, clientId } = c;

    if (!campaignId || typeof campaignId !== "string") {
      results.skipped++;
      results.errors.push(`Missing campaignId on item`);
      continue;
    }
    if (!clientId || typeof clientId !== "string") {
      results.skipped++;
      results.errors.push(`Missing clientId for campaign ${campaignId}`);
      continue;
    }

    // Verify campaign exists and belongs to the stated client
    const campaign = await prisma.clientCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, clientId: true },
    });
    if (!campaign) {
      results.skipped++;
      results.errors.push(`Campaign ${campaignId} not found`);
      continue;
    }
    if (campaign.clientId !== clientId) {
      results.skipped++;
      results.errors.push(`Campaign ${campaignId} does not belong to client ${clientId}`);
      continue;
    }

    const platformViews = (c.platformViews && typeof c.platformViews === "object") ? c.platformViews : null;
    const topClips = Array.isArray(c.topClips) ? c.topClips : null;
    const status = (["Strong", "Normal", "NeedsAttention"] as const).includes(c.status as "Strong" | "Normal" | "NeedsAttention")
      ? (c.status as "Strong" | "Normal" | "NeedsAttention")
      : "Normal";

    const data = {
      clientId,
      asOf,
      viewsTotal: Number(c.viewsTotal ?? 0),
      viewsToday: Number(c.viewsToday ?? 0),
      totalSubmissions: Number(c.totalSubmissions ?? 0),
      pending: Number(c.pending ?? 0),
      approved: Number(c.approved ?? 0),
      rejected: Number(c.rejected ?? 0),
      amountSpent: c.amountSpent != null ? Number(c.amountSpent) : null,
      effectiveCpm: c.effectiveCpm != null ? Number(c.effectiveCpm) : null,
      totalBudget: c.totalBudget != null ? Number(c.totalBudget) : null,
      budgetRemaining: c.budgetRemaining != null ? Number(c.budgetRemaining) : null,
      tiktokViews: Number(c.tiktokViews ?? (platformViews as Record<string, number> | null)?.tiktok ?? 0),
      instagramViews: Number(c.instagramViews ?? (platformViews as Record<string, number> | null)?.instagram ?? 0),
      youtubeViews: Number(c.youtubeViews ?? (platformViews as Record<string, number> | null)?.youtube ?? 0),
      platformViews: platformViews != null ? (platformViews as Prisma.InputJsonValue) : Prisma.JsonNull,
      topClips: topClips != null ? (topClips as Prisma.InputJsonValue) : Prisma.JsonNull,
      status,
    };

    try {
      await prisma.campaignStats.upsert({
        where: { campaignId },
        create: { campaignId, ...data },
        update: data,
      });
      results.updated++;
    } catch (err) {
      results.skipped++;
      results.errors.push(`Error upserting ${campaignId}: ${String(err)}`);
    }
  }

  return NextResponse.json(results);
}

// ─── GET: return current live stats per campaign ──────────────────────────────

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const campaignId = searchParams.get("campaignId");

  const where: Record<string, string> = {};
  if (clientId) where.clientId = clientId;
  if (campaignId) where.campaignId = campaignId;

  const stats = await prisma.campaignStats.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(stats.map(serializeStats));
}
