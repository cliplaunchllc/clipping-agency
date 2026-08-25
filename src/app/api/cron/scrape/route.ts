import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { scrapeSubmission } from "@/lib/scraper";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const submissions = await prisma.submission.findMany({
    where: { scrapeStatus: { not: "error" } },
    select: { id: true },
  });
  // Run in batches of 10
  for (let i = 0; i < submissions.length; i += 10) {
    await Promise.all(submissions.slice(i, i + 10).map((s) => scrapeSubmission(s.id)));
  }
  return NextResponse.json({ scraped: submissions.length });
}
