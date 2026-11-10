import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function requireSecret(req: NextRequest): boolean {
  const secret = process.env.REPORT_SECRET;
  return !!secret && req.headers.get("x-report-secret") === secret;
}

const VALID_STATUSES = ["active", "justlaunched", "prelaunch"] as const;
type ClientStatus = (typeof VALID_STATUSES)[number];

export async function POST(req: NextRequest) {
  if (!requireSecret(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { clients?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.clients))
    return NextResponse.json({ error: "clients must be an array" }, { status: 400 });

  let created = 0, updated = 0, skipped = 0;
  const errors: Array<{ name?: unknown; error: string }> = [];

  for (const raw of body.clients) {
    const c = raw as Record<string, unknown>;
    const name = typeof c.name === "string" ? c.name.trim() : "";

    if (!name) {
      errors.push({ name: c.name, error: "name is required" });
      skipped++;
      continue;
    }

    if (c.status !== undefined && !VALID_STATUSES.includes(c.status as ClientStatus)) {
      errors.push({ name, error: `invalid status "${c.status}"; must be active, justlaunched, or prelaunch` });
      skipped++;
      continue;
    }

    const status = (c.status as ClientStatus) || "active";
    const logoUrl = typeof c.logoUrl === "string" && c.logoUrl.trim() ? c.logoUrl.trim() : undefined;
    const campaigns = Array.isArray(c.campaigns) ? (c.campaigns as Record<string, unknown>[]) : [];

    try {
      const existing = await prisma.client.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });

      let clientId: string;

      if (existing) {
        await prisma.client.update({
          where: { id: existing.id },
          data: {
            status,
            ...(logoUrl !== undefined && { logoUrl }),
          },
        });
        clientId = existing.id;
        updated++;
      } else {
        const created_ = await prisma.client.create({
          data: { name, status, ...(logoUrl !== undefined && { logoUrl }) },
        });
        clientId = created_.id;
        created++;
      }

      for (const camp of campaigns) {
        const campName = typeof camp.name === "string" ? camp.name.trim() : "";
        if (!campName) continue;

        const totalBudget = typeof camp.totalBudget === "number" ? camp.totalBudget : 0;
        const cpm = typeof camp.cpm === "number" ? camp.cpm : undefined;
        const startDate =
          typeof camp.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(camp.startDate)
            ? new Date(camp.startDate + "T00:00:00.000Z")
            : undefined;

        const existingCamp = await prisma.clientCampaign.findFirst({
          where: { clientId, name: { equals: campName, mode: "insensitive" } },
          select: { id: true },
        });

        if (existingCamp) {
          await prisma.clientCampaign.update({
            where: { id: existingCamp.id },
            data: {
              totalBudget,
              ...(cpm !== undefined && { cpm }),
              ...(startDate !== undefined && { startDate }),
            },
          });
        } else {
          const maxOrder = await prisma.clientCampaign.aggregate({
            where: { clientId },
            _max: { order: true },
          });
          await prisma.clientCampaign.create({
            data: {
              clientId,
              name: campName,
              totalBudget,
              ...(cpm !== undefined && { cpm }),
              ...(startDate !== undefined && { startDate }),
              order: (maxOrder._max.order ?? 0) + 1,
            },
          });
        }
      }
    } catch (err) {
      errors.push({ name, error: err instanceof Error ? err.message : "unknown error" });
      skipped++;
      // undo the increment if we already counted it
      if (created > 0) created--;
      else if (updated > 0) updated--;
    }
  }

  return NextResponse.json({ created, updated, skipped, errors });
}
