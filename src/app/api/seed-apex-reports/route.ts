import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { token } = await req.json();
  if (token !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.client.findFirst({
    where: { name: { contains: "Apex", mode: "insensitive" } },
  });

  if (!client) {
    return NextResponse.json({ error: "Apex Media client not found" }, { status: 404 });
  }

  // Clear existing ongoing reports
  await prisma.ongoingReport.deleteMany({ where: { clientId: client.id } });

  const baseDate = new Date("2026-09-16T12:00:00Z");
  const rows = [
    { d: 0,  subs: 12, pend: 3, appr: 9,  vToday: 42_000,  vTotal: 42_000 },
    { d: 1,  subs: 15, pend: 2, appr: 13, vToday: 67_500,  vTotal: 109_500 },
    { d: 2,  subs: 10, pend: 4, appr: 6,  vToday: 38_200,  vTotal: 147_700 },
    { d: 3,  subs: 18, pend: 1, appr: 17, vToday: 94_000,  vTotal: 241_700 },
    { d: 4,  subs: 14, pend: 5, appr: 9,  vToday: 51_300,  vTotal: 293_000 },
    { d: 5,  subs: 20, pend: 2, appr: 18, vToday: 128_000, vTotal: 421_000 },
    { d: 6,  subs: 11, pend: 3, appr: 8,  vToday: 44_100,  vTotal: 465_100 },
    { d: 7,  subs: 22, pend: 0, appr: 22, vToday: 176_000, vTotal: 641_100 },
    { d: 8,  subs: 9,  pend: 4, appr: 5,  vToday: 29_800,  vTotal: 670_900 },
    { d: 9,  subs: 17, pend: 2, appr: 15, vToday: 112_400, vTotal: 783_300 },
    { d: 10, subs: 13, pend: 6, appr: 7,  vToday: 58_700,  vTotal: 842_000 },
    { d: 11, subs: 25, pend: 1, appr: 24, vToday: 204_000, vTotal: 1_046_000 },
    { d: 12, subs: 16, pend: 3, appr: 13, vToday: 89_600,  vTotal: 1_135_600 },
    { d: 13, subs: 21, pend: 2, appr: 19, vToday: 147_200, vTotal: 1_282_800 },
  ];

  const created = [];
  for (const row of rows) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + row.d);
    const report = await prisma.ongoingReport.create({
      data: {
        clientId: client.id,
        date,
        campaignName: "Apex Media — Main",
        totalSubmissions: row.subs,
        pending: row.pend,
        approved: row.appr,
        rejected: 0,
        viewsToday: row.vToday,
        viewsTotal: row.vTotal,
        status: "Normal",
      },
    });
    created.push({ date: date.toISOString().slice(0, 10), viewsToday: row.vToday });
  }

  return NextResponse.json({
    ok: true,
    client: client.name,
    reportsCreated: created.length,
    reports: created,
  });
}
