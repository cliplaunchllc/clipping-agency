import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenSetting = await prisma.siteSetting.findUnique({ where: { key: "skool_portal_token" } });
  if (!tokenSetting || tokenSetting.value !== token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [nameSetting, freebies] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: "skool_community_name" } }),
    prisma.freebie.findMany({
      where: { type: "skool" },
      include: { links: { orderBy: { order: "asc" } }, assets: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    }),
  ]);

  return NextResponse.json({
    communityName: nameSetting?.value ?? "Member Resources",
    freebies,
  });
}
