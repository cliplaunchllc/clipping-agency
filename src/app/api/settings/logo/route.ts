import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "agency_logo" } });
  return NextResponse.json({ logoUrl: setting?.value ?? null });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { logoUrl } = await req.json();
  if (logoUrl === null || logoUrl === "") {
    await prisma.siteSetting.deleteMany({ where: { key: "agency_logo" } });
    return NextResponse.json({ logoUrl: null });
  }

  const setting = await prisma.siteSetting.upsert({
    where: { key: "agency_logo" },
    update: { value: logoUrl },
    create: { key: "agency_logo", value: logoUrl },
  });
  return NextResponse.json({ logoUrl: setting.value });
}
