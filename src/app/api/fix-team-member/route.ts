import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-report-secret") !== process.env.REPORT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Reset isTeamMember to false for all agency-role users
  const result = await prisma.user.updateMany({
    where: { role: "agency", isTeamMember: true },
    data: { isTeamMember: false },
  });
  return NextResponse.json({ fixed: result.count });
}
