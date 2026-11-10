import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const AI_STRINGS = [
  "Hook-first TikTok clips driving strong engagement. Short-form UGC outperforming branded cuts.",
  "Double down on trending audio formats. Push 60% of quota to hook-first clips.",
  "Clippers executing brief well. Strong engagement across all platforms.",
];

export async function POST(req: Request) {
  const { token } = await req.json();
  if (token !== process.env.REPORT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Clear AI-generated text from any ongoing report that has these exact strings
  let cleared = 0;
  const reports = await prisma.ongoingReport.findMany({
    where: {
      OR: [
        { mainTrend: { in: AI_STRINGS } },
        { mainOptimization: { in: AI_STRINGS } },
        { clipperFeedback: { in: AI_STRINGS } },
      ],
    },
    select: { id: true, mainTrend: true, mainOptimization: true, clipperFeedback: true },
  });

  for (const r of reports) {
    await prisma.ongoingReport.update({
      where: { id: r.id },
      data: {
        mainTrend: AI_STRINGS.includes(r.mainTrend ?? "") ? null : r.mainTrend,
        mainOptimization: AI_STRINGS.includes(r.mainOptimization ?? "") ? null : r.mainOptimization,
        clipperFeedback: AI_STRINGS.includes(r.clipperFeedback ?? "") ? null : r.clipperFeedback,
      },
    });
    cleared++;
  }

  return NextResponse.json({ ok: true, cleared });
}
