import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("Seeding database...");

  await prisma.user.upsert({
    where: { email: "admin@agency.com" },
    update: {},
    create: {
      email: "admin@agency.com",
      name: "Agency Admin",
      passwordHash: await bcrypt.hash("admin123", 10),
      role: "agency",
      status: "active",
    },
  });

  const client = await prisma.client.upsert({
    where: { id: "seed-client-1" },
    update: {},
    create: { id: "seed-client-1", name: "Demo Brand Co", status: "active" },
  });

  const clientUser = await prisma.user.upsert({
    where: { email: "client@demo.com" },
    update: {},
    create: {
      email: "client@demo.com",
      name: "Demo Brand Co",
      passwordHash: await bcrypt.hash("client123", 10),
      role: "client",
      status: "active",
      clientId: client.id,
    },
  });

  const clipper1User = await prisma.user.upsert({
    where: { email: "clipper1@demo.com" },
    update: {},
    create: {
      email: "clipper1@demo.com",
      name: "Alex Rivera",
      passwordHash: await bcrypt.hash("clipper123", 10),
      role: "clipper",
      status: "active",
      clientId: client.id,
    },
  });

  const clipper1Profile = await prisma.clipperProfile.upsert({
    where: { userId: clipper1User.id },
    update: {},
    create: { userId: clipper1User.id, displayName: "Alex Rivera" },
  });

  await prisma.user.upsert({
    where: { email: "clipper2@demo.com" },
    update: {},
    create: {
      email: "clipper2@demo.com",
      name: "Jordan Lee",
      passwordHash: await bcrypt.hash("clipper123", 10),
      role: "clipper",
      status: "pending",
      clientId: null,
    },
  });

  const sub = await prisma.clipperSubAccount.upsert({
    where: { id: "seed-sub-1" },
    update: {},
    create: {
      id: "seed-sub-1",
      clipperId: clipper1Profile.id,
      platform: "tiktok",
      handle: "alexrivera",
      profileUrl: "https://tiktok.com/@alexrivera",
    },
  });

  await prisma.clip.upsert({
    where: { id: "seed-clip-1" },
    update: {},
    create: {
      id: "seed-clip-1",
      clipperId: clipper1Profile.id,
      clientId: client.id,
      subAccountId: sub.id,
      url: "https://tiktok.com/@alexrivera/video/123456",
      views: 125000n, likes: 8200n, comments: 340n, shares: 1200n, saves: 450n,
    },
  });

  await prisma.clip.upsert({
    where: { id: "seed-clip-2" },
    update: {},
    create: {
      id: "seed-clip-2",
      clipperId: clipper1Profile.id,
      clientId: client.id,
      subAccountId: sub.id,
      url: "https://tiktok.com/@alexrivera/video/789012",
      views: 84000n, likes: 5100n, comments: 210n, shares: 870n, saves: 310n,
    },
  });

  console.log("Seed complete.");
  console.log("  Agency:  admin@agency.com / admin123");
  console.log("  Client:  client@demo.com  / client123");
  console.log("  Clipper: clipper1@demo.com / clipper123 (active)");
  console.log("  Clipper: clipper2@demo.com / clipper123 (pending)");
}

main().catch(console.error).finally(() => prisma.$disconnect());
