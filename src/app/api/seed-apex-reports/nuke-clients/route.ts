import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { token } = await req.json();
  if (token !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Delete in dependency order (no-cascade relations first)
  await prisma.clip.deleteMany({});
  await prisma.user.updateMany({ where: { clientId: { not: null } }, data: { clientId: null } });
  await prisma.client.deleteMany({});

  return NextResponse.json({ ok: true, message: "All clients and related data deleted" });
}
