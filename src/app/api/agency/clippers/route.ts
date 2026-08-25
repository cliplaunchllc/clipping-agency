import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clippers = await prisma.clipper.findMany({
    include: {
      user: true,
      assignments: { include: { client: true } },
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(clippers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, email, password } = await req.json();
  if (!name || !email || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const user = await prisma.user.create({
    data: {
      email, name,
      passwordHash: await bcrypt.hash(password, 10),
      role: "clipper",
      clipper: { create: { displayName: name } },
    },
    include: { clipper: true },
  });
  return NextResponse.json(user.clipper, { status: 201 });
}
