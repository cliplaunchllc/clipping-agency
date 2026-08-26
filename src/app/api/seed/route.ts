import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// One-time seed endpoint — protected by a secret token
export async function POST(req: Request) {
  const { token } = await req.json();
  if (token !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  void clientUser;

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
      views: BigInt(125000), likes: BigInt(8200), comments: BigInt(340), shares: BigInt(1200), saves: BigInt(450),
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
      views: BigInt(84000), likes: BigInt(5100), comments: BigInt(210), shares: BigInt(870), saves: BigInt(310),
    },
  });

  return NextResponse.json({
    ok: true,
    accounts: [
      "admin@agency.com / admin123",
      "client@demo.com / client123",
      "clipper1@demo.com / clipper123 (active)",
      "clipper2@demo.com / clipper123 (pending)",
    ],
  });
}
