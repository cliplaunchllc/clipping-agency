import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "agency")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const logs = await prisma.leadRunLog.findMany({
    where: { runId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(logs);
}
