import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [nameSetting, tokenSetting] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: "skool_community_name" } }),
    prisma.siteSetting.findUnique({ where: { key: "skool_portal_token" } }),
  ]);

  // Auto-create portal token if missing
  let token = tokenSetting?.value;
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await prisma.siteSetting.upsert({
      where: { key: "skool_portal_token" },
      update: { value: token },
      create: { key: "skool_portal_token", value: token },
    });
  }

  return NextResponse.json({
    communityName: nameSetting?.value ?? "Member Resources",
    portalToken: token,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (body.communityName !== undefined) {
    await prisma.siteSetting.upsert({
      where: { key: "skool_community_name" },
      update: { value: body.communityName },
      create: { key: "skool_community_name", value: body.communityName },
    });
  }

  if (body.regenerateToken) {
    const newToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await prisma.siteSetting.upsert({
      where: { key: "skool_portal_token" },
      update: { value: newToken },
      create: { key: "skool_portal_token", value: newToken },
    });
    return NextResponse.json({ portalToken: newToken });
  }

  return NextResponse.json({ ok: true });
}
