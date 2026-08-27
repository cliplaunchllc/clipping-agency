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

  const { name, email, password, existingUserId } = await req.json();
  if (!name) return NextResponse.json({ error: "Missing client name" }, { status: 400 });

  const client = await prisma.client.create({ data: { name } });

  if (existingUserId) {
    // Link an existing pending client user to this new client record
    const user = await prisma.user.findUnique({ where: { id: existingUserId } });
    if (!user || user.role !== "client") {
      // Rollback client if user is invalid — delete the just-created client
      await prisma.client.delete({ where: { id: client.id } });
      return NextResponse.json({ error: "Invalid user account" }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: existingUserId },
      data: { clientId: client.id, status: "active" },
    });
  } else {
    // Create a brand-new user with provided credentials
    if (!email || !password) {
      await prisma.client.delete({ where: { id: client.id } });
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.client.delete({ where: { id: client.id } });
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
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
  }

  return NextResponse.json(client, { status: 201 });
}
