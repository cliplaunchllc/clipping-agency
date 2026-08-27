import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST — seed ~35 demo clips spread over the last 30 days
// Body: { token: process.env.SEED_SECRET }
export async function POST(req: Request) {
  const { token } = await req.json();
  if (token !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve demo client and clipper (created by /api/seed)
  const client = await prisma.client.findFirst({ where: { name: "Demo Brand Co" } });
  if (!client) return NextResponse.json({ error: "Run /api/seed first" }, { status: 400 });

  const clipper = await prisma.clipperProfile.findFirst({ include: { subAccounts: true } });
  if (!clipper) return NextResponse.json({ error: "No clipper found" }, { status: 400 });

  const tiktokSub = clipper.subAccounts.find((s) => s.platform === "tiktok")
    ?? clipper.subAccounts[0];
  if (!tiktokSub) return NextResponse.json({ error: "No sub-account found" }, { status: 400 });

  // Ensure an instagram sub-account exists
  let igSub = clipper.subAccounts.find((s) => s.platform === "instagram");
  if (!igSub) {
    igSub = await prisma.clipperSubAccount.create({
      data: {
        clipperId: clipper.id,
        platform: "instagram",
        handle: "alexrivera.clips",
        profileUrl: "https://instagram.com/alexrivera.clips",
      },
    });
  }

  // Clip schedule — day offset from today (negative = past), views, likes, etc.
  // Designed to produce an interesting chart shape: slow start, mid-month spike, taper, late surge
  const schedule: Array<{
    daysAgo: number; platform: "tiktok" | "instagram";
    views: number; likes: number; comments: number; shares: number; saves: number;
    title: string;
  }> = [
    { daysAgo: 30, platform: "tiktok",    views: 14200,  likes: 940,  comments: 62,  shares: 210,  saves: 88,  title: "Product reveal pt.1" },
    { daysAgo: 29, platform: "instagram", views: 8700,   likes: 620,  comments: 38,  shares: 110,  saves: 54,  title: "Behind the scenes" },
    { daysAgo: 28, platform: "tiktok",    views: 22500,  likes: 1800, comments: 130, shares: 490,  saves: 170, title: "Trending sound POV" },
    { daysAgo: 27, platform: "tiktok",    views: 19800,  likes: 1420, comments: 95,  shares: 310,  saves: 130, title: "Day in the life" },
    { daysAgo: 26, platform: "instagram", views: 11400,  likes: 830,  comments: 51,  shares: 160,  saves: 70,  title: "Aesthetic reel" },
    { daysAgo: 25, platform: "tiktok",    views: 31000,  likes: 2600, comments: 182, shares: 710,  saves: 290, title: "Viral transition #1" },
    { daysAgo: 24, platform: "tiktok",    views: 58400,  likes: 5100, comments: 380, shares: 1340, saves: 520, title: "This blew up 😭" },
    { daysAgo: 23, platform: "instagram", views: 27200,  likes: 2200, comments: 145, shares: 520,  saves: 210, title: "Collab drop" },
    { daysAgo: 22, platform: "tiktok",    views: 44100,  likes: 3900, comments: 265, shares: 960,  saves: 380, title: "Duet challenge" },
    { daysAgo: 21, platform: "tiktok",    views: 38700,  likes: 3100, comments: 220, shares: 820,  saves: 310, title: "POV: main character" },
    { daysAgo: 20, platform: "instagram", views: 16500,  likes: 1250, comments: 78,  shares: 290,  saves: 120, title: "Story time reel" },
    { daysAgo: 19, platform: "tiktok",    views: 72000,  likes: 6800, comments: 510, shares: 1900, saves: 740, title: "🔥 60k views?!" },
    { daysAgo: 18, platform: "tiktok",    views: 91500,  likes: 8400, comments: 620, shares: 2400, saves: 980, title: "Part 2 — you asked for it" },
    { daysAgo: 17, platform: "instagram", views: 34600,  likes: 2900, comments: 195, shares: 640,  saves: 260, title: "Unboxing reaction" },
    { daysAgo: 16, platform: "tiktok",    views: 83200,  likes: 7700, comments: 540, shares: 2100, saves: 850, title: "Stitch response" },
    { daysAgo: 15, platform: "tiktok",    views: 55800,  likes: 4900, comments: 360, shares: 1400, saves: 590, title: "Get ready with me" },
    { daysAgo: 14, platform: "instagram", views: 22300,  likes: 1750, comments: 112, shares: 390,  saves: 160, title: "Quick tutorial" },
    { daysAgo: 13, platform: "tiktok",    views: 47300,  likes: 4100, comments: 295, shares: 1050, saves: 430, title: "Green screen reveal" },
    { daysAgo: 12, platform: "tiktok",    views: 34900,  likes: 2900, comments: 205, shares: 740,  saves: 300, title: "Why I switched" },
    { daysAgo: 11, platform: "instagram", views: 18800,  likes: 1420, comments: 89,  shares: 310,  saves: 128, title: "Morning routine" },
    { daysAgo: 10, platform: "tiktok",    views: 29400,  likes: 2300, comments: 160, shares: 590,  saves: 245, title: "Honest thoughts" },
    { daysAgo: 9,  platform: "tiktok",    views: 42000,  likes: 3600, comments: 248, shares: 890,  saves: 365, title: "Finally tried it" },
    { daysAgo: 8,  platform: "instagram", views: 25700,  likes: 2000, comments: 130, shares: 450,  saves: 185, title: "5 things I love" },
    { daysAgo: 7,  platform: "tiktok",    views: 38100,  likes: 3200, comments: 225, shares: 810,  saves: 335, title: "Weekend vlog clip" },
    { daysAgo: 6,  platform: "tiktok",    views: 61400,  likes: 5600, comments: 415, shares: 1600, saves: 650, title: "People keep asking…" },
    { daysAgo: 5,  platform: "instagram", views: 29800,  likes: 2350, comments: 155, shares: 530,  saves: 215, title: "Aesthetic GRWM" },
    { daysAgo: 4,  platform: "tiktok",    views: 78900,  likes: 7200, comments: 530, shares: 2050, saves: 830, title: "This went crazy" },
    { daysAgo: 3,  platform: "tiktok",    views: 112000, likes: 10200,comments: 760, shares: 3100, saves: 1260,title: "1M on its way 👀" },
    { daysAgo: 2,  platform: "instagram", views: 44500,  likes: 3700, comments: 255, shares: 870,  saves: 355, title: "Recap reel" },
    { daysAgo: 1,  platform: "tiktok",    views: 95300,  likes: 8900, comments: 660, shares: 2700, saves: 1090,title: "Back to back 🔥" },
    { daysAgo: 0,  platform: "tiktok",    views: 67800,  likes: 6100, comments: 450, shares: 1850, saves: 750, title: "Today's drop" },
  ];

  const created: string[] = [];

  for (const s of schedule) {
    const submittedAt = new Date();
    submittedAt.setDate(submittedAt.getDate() - s.daysAgo);
    submittedAt.setHours(Math.floor(Math.random() * 14) + 8, Math.floor(Math.random() * 60), 0, 0);

    const subId = s.platform === "tiktok" ? tiktokSub.id : igSub.id;
    const vidId = Math.floor(Math.random() * 9000000000) + 1000000000;

    const clip = await prisma.clip.create({
      data: {
        clipperId: clipper.id,
        clientId: client.id,
        subAccountId: subId,
        url: s.platform === "tiktok"
          ? `https://tiktok.com/@${tiktokSub.handle}/video/${vidId}`
          : `https://instagram.com/reel/${vidId}`,
        title: s.title,
        views: BigInt(s.views),
        likes: BigInt(s.likes),
        comments: BigInt(s.comments),
        shares: BigInt(s.shares),
        saves: BigInt(s.saves),
        submittedAt,
      },
    });
    created.push(clip.id);
  }

  return NextResponse.json({ ok: true, created: created.length });
}
