import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const clients = await prisma.clientAccount.findMany({
    include: {
      user: true,
      assignments: { include: { clipper: { include: { user: true } } } },
      subAccounts: true,
      _count: { select: { subAccounts: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { name, email, password, packageInfo } = await req.json();
  if (!name || !email || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 10),
      role: "client",
      clientAccount: { create: { name, packageInfo } },
    },
    include: { clientAccount: true },
  });
  return NextResponse.json(user.clientAccount, { status: 201 });
}
