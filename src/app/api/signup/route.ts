import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { name, email, password, role } = await req.json();
  if (!name || !email || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const signupRole = role === "client" ? "client" : "clipper";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  if (signupRole === "clipper") {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await bcrypt.hash(password, 10),
        role: "clipper",
        status: "pending",
        clipperProfile: { create: { displayName: name } },
      },
    });
    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  }

  // client self-signup — status pending, no clientId yet (agency assigns)
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 10),
      role: "client",
      status: "pending",
    },
  });

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
