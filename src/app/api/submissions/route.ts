import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { scrapeSubmission } from "@/lib/scraper";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "clipper") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { subAccountId, clipUrl, platform } = body;
  if (!subAccountId || !clipUrl || !platform) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const clipper = await prisma.clipper.findUnique({ where: { userId: session.user.id } });
  if (!clipper) return NextResponse.json({ error: "Clipper not found" }, { status: 404 });

  const submission = await prisma.submission.create({
    data: { subAccountId, clipperId: clipper.id, clipUrl, platform, scrapeStatus: "pending" },
  });
  // Fire-and-forget initial scrape
  scrapeSubmission(submission.id).catch(console.error);
  return NextResponse.json(submission, { status: 201 });
}
