import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// POST — generate a 30-day device token for the currently logged-in user
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = crypto.randomUUID() + "-" + crypto.randomUUID(); // long unique token
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { sessionToken: token, userId: session.user.id, expires },
  });

  return NextResponse.json({ token });
}
