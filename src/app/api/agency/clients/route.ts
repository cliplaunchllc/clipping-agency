import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

function agencyOnly(session: { user?: { role?: string } | null } | null) {
  return session?.user?.role === "agency";
}

export async function GET() {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clients = await prisma.client.findMany({
    include: {
      users: { where: { role: "clipper" }, select: { id: true } },
      _count: { select: { clips: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, email, password } = await req.json();
  if (!name || !email || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const client = await prisma.client.create({ data: { name } });

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 10),
      role: "client",
      status: "active",
      clientId: client.id,
    },
  });

  return NextResponse.json(client, { status: 201 });
}
