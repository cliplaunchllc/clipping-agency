import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const setting = await prisma.siteSetting.findUnique({ where: { key: "admin_invite_code" } });
  return NextResponse.json({ code: setting?.value ?? null });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json();
  if (!code || typeof code !== "string" || code.trim().length < 4) {
    return NextResponse.json({ error: "Invite code must be at least 4 characters" }, { status: 400 });
  }

  const setting = await prisma.siteSetting.upsert({
    where: { key: "admin_invite_code" },
    update: { value: code.trim() },
    create: { key: "admin_invite_code", value: code.trim() },
  });
  return NextResponse.json({ code: setting.value });
}
