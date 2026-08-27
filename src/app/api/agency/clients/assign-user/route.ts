import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// POST /api/agency/clients/assign-user
// body: { userId, clientId } — assigns a pending client user to a client record
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, clientId } = await req.json();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "client") return NextResponse.json({ error: "User not found or not a client" }, { status: 404 });

  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      clientId: clientId || null,
      status: clientId ? "active" : "pending",
    },
    select: { id: true, name: true, email: true, status: true, clientId: true },
  });

  return NextResponse.json(updated);
}
