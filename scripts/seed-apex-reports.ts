import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // Find Apex Media
  const client = await prisma.client.findFirst({
    where: { name: { contains: "Apex", mode: "insensitive" } },
  });

  if (!client) {
    console.error("Apex Media client not found");
    process.exit(1);
  }

  console.log(`Found client: ${client.name} (${client.id}) — type: ${client.campaignType}`);

  // Delete existing ongoing reports for this client (clean slate)
  await prisma.ongoingReport.deleteMany({ where: { clientId: client.id } });
  console.log("Cleared existing ongoing reports");

  // Generate 14 days of dummy data ending yesterday (2026-09-29)
  const baseDate = new Date("2026-09-16");
  const rows = [
    // date offset, totalSubs, pending, approved, viewsToday, viewsTotal
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

  for (const row of rows) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + row.d);

    await prisma.ongoingReport.create({
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

    console.log(`  Created report for ${date.toISOString().slice(0, 10)} — views today: ${row.vToday.toLocaleString()}`);
  }

  console.log(`\nDone! Created ${rows.length} reports for ${client.name}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
