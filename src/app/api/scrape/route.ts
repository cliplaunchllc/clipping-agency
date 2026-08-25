import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { scrapeSubmission } from "@/lib/scraper";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const submissions = await prisma.submission.findMany({
    where: { scrapeStatus: { not: "error" } },
    select: { id: true },
    take: 50,
  });

  // Fire and forget
  Promise.all(submissions.map((s) => scrapeSubmission(s.id))).catch(console.error);
  return NextResponse.json({ queued: submissions.length });
}
