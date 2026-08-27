import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// POST — get or create a share token for a client
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const client = await prisma.client.findUnique({ where: { id }, select: { shareToken: true } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Return existing token or create a new one
  const token = client.shareToken ?? crypto.randomUUID() + "-" + crypto.randomUUID();

  if (!client.shareToken) {
    await prisma.client.update({ where: { id }, data: { shareToken: token } });
  }

  return NextResponse.json({ token });
}
