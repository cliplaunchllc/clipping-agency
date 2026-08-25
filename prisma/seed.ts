import { PrismaClient, Platform } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("Seeding database...");

  // Agency Admin
  const agencyUser = await prisma.user.upsert({
    where: { email: "admin@agency.com" },
    update: {},
    create: {
      email: "admin@agency.com",
      name: "Agency Admin",
      passwordHash: await bcrypt.hash("admin123", 10),
      role: "agency",
    },
  });

  // Clipper users
  const clipper1User = await prisma.user.upsert({
    where: { email: "clipper1@agency.com" },
    update: {},
    create: {
      email: "clipper1@agency.com",
      name: "Alex Rivera",
      passwordHash: await bcrypt.hash("clipper123", 10),
      role: "clipper",
    },
  });

  const clipper1 = await prisma.clipper.upsert({
    where: { userId: clipper1User.id },
    update: {},
    create: { userId: clipper1User.id, displayName: "Alex Rivera" },
  });

  const clipper2User = await prisma.user.upsert({
    where: { email: "clipper2@agency.com" },
    update: {},
    create: {
      email: "clipper2@agency.com",
      name: "Jordan Lee",
      passwordHash: await bcrypt.hash("clipper123", 10),
      role: "clipper",
    },
  });

  const clipper2 = await prisma.clipper.upsert({
    where: { userId: clipper2User.id },
    update: {},
    create: { userId: clipper2User.id, displayName: "Jordan Lee" },
  });

  // Client users
  const client1User = await prisma.user.upsert({
    where: { email: "client1@brand.com" },
    update: {},
    create: {
      email: "client1@brand.com",
      name: "NovaTech Brand",
      passwordHash: await bcrypt.hash("client123", 10),
      role: "client",
    },
  });

  const client1 = await prisma.clientAccount.upsert({
    where: { userId: client1User.id },
    update: {},
    create: {
      userId: client1User.id,
      name: "NovaTech Brand",
      status: "active",
      packageInfo: "Growth Package - 50 clips/month",
    },
  });

  const client2User = await prisma.user.upsert({
    where: { email: "client2@brand.com" },
    update: {},
    create: {
      email: "client2@brand.com",
      name: "Stellar Apparel",
      passwordHash: await bcrypt.hash("client123", 10),
      role: "client",
    },
  });

  const client2 = await prisma.clientAccount.upsert({
    where: { userId: client2User.id },
    update: {},
    create: {
      userId: client2User.id,
      name: "Stellar Apparel",
      status: "active",
      packageInfo: "Pro Package - 100 clips/month",
    },
  });

  // Assign clippers to clients
  await prisma.clipperClientAssignment.upsert({
    where: { clipperId_clientId: { clipperId: clipper1.id, clientId: client1.id } },
    update: {},
    create: { clipperId: clipper1.id, clientId: client1.id },
  });

  await prisma.clipperClientAssignment.upsert({
    where: { clipperId_clientId: { clipperId: clipper1.id, clientId: client2.id } },
    update: {},
    create: { clipperId: clipper1.id, clientId: client2.id },
  });

  await prisma.clipperClientAssignment.upsert({
    where: { clipperId_clientId: { clipperId: clipper2.id, clientId: client2.id } },
    update: {},
    create: { clipperId: clipper2.id, clientId: client2.id },
  });

  // Sub-accounts
  const subAccount1 = await prisma.subAccount.create({
    data: {
      clientId: client1.id,
      clipperId: clipper1.id,
      platform: "tiktok",
      handle: "@novatech_official",
      profileUrl: "https://tiktok.com/@novatech_official",
    },
  });

  const subAccount2 = await prisma.subAccount.create({
    data: {
      clientId: client1.id,
      clipperId: clipper1.id,
      platform: "instagram",
      handle: "@novatech.brand",
      profileUrl: "https://instagram.com/novatech.brand",
    },
  });

  const subAccount3 = await prisma.subAccount.create({
    data: {
      clientId: client2.id,
      clipperId: clipper2.id,
      platform: "tiktok",
      handle: "@stellarapparel",
      profileUrl: "https://tiktok.com/@stellarapparel",
    },
  });

  // Submissions with metric snapshots
  const now = new Date();

  async function createSubmissionWithSnapshots(
    subAccountId: string,
    clipperId: string,
    platform: Platform,
    clipUrl: string,
    daysAgo: number,
    baseViews: number
  ) {
    const submittedAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const submission = await prisma.submission.create({
      data: {
        subAccountId,
        clipperId,
        platform,
        clipUrl,
        submittedAt,
        scrapeStatus: "success",
        lastScraped: now,
      },
    });

    // Create snapshots every 6 hours from submittedAt to now
    const snapshots = [];
    let currentTime = new Date(submittedAt);
    let views = baseViews;
    while (currentTime <= now) {
      const growthFactor = 1 + Math.random() * 0.15;
      views = Math.floor(views * growthFactor);
      snapshots.push({
        submissionId: submission.id,
        timestamp: new Date(currentTime),
        views: BigInt(views),
        likes: BigInt(Math.floor(views * (0.04 + Math.random() * 0.02))),
        comments: BigInt(Math.floor(views * (0.005 + Math.random() * 0.003))),
        shares: BigInt(Math.floor(views * (0.01 + Math.random() * 0.005))),
        saves: BigInt(Math.floor(views * (0.02 + Math.random() * 0.01))),
      });
      currentTime = new Date(currentTime.getTime() + 6 * 60 * 60 * 1000);
    }

    await prisma.metricSnapshot.createMany({ data: snapshots });
    return submission;
  }

  await createSubmissionWithSnapshots(subAccount1.id, clipper1.id, "tiktok", "https://tiktok.com/@novatech_official/video/1", 14, 1000);
  await createSubmissionWithSnapshots(subAccount1.id, clipper1.id, "tiktok", "https://tiktok.com/@novatech_official/video/2", 10, 5000);
  await createSubmissionWithSnapshots(subAccount2.id, clipper1.id, "instagram", "https://instagram.com/p/ABC123", 7, 2000);
  await createSubmissionWithSnapshots(subAccount3.id, clipper2.id, "tiktok", "https://tiktok.com/@stellarapparel/video/1", 12, 8000);
  await createSubmissionWithSnapshots(subAccount3.id, clipper2.id, "tiktok", "https://tiktok.com/@stellarapparel/video/2", 5, 15000);

  // Onboarding steps for clients
  const onboardingSteps = [
    { title: "Account Created", completed: true, order: 1 },
    { title: "Sub-accounts Added", completed: true, order: 2 },
    { title: "First Clip Submitted", completed: true, order: 3 },
    { title: "First Payout Scheduled", completed: false, order: 4 },
    { title: "30-Day Review Completed", completed: false, order: 5 },
  ];

  for (const step of onboardingSteps) {
    await prisma.onboardingStep.create({
      data: { clientId: client1.id, ...step },
    });
  }

  console.log("Seeding complete!");
  console.log("Demo credentials:");
  console.log("  Agency Admin: admin@agency.com / admin123");
  console.log("  Clipper 1: clipper1@agency.com / clipper123");
  console.log("  Clipper 2: clipper2@agency.com / clipper123");
  console.log("  Client 1: client1@brand.com / client123");
  console.log("  Client 2: client2@brand.com / client123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
