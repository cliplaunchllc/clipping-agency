import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "agency")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const run = await prisma.leadRun.findUnique({ where: { id } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const leads = await prisma.leadFactoryLead.findMany({
    where: { runId: id },
    orderBy: { num: "asc" },
  });

  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };

  const headers = [
    "Studio",
    "Own Website",
    "Game",
    "Store Link",
    "Segment",
    "Genre",
    "Earns Real Money",
    "Clip Hook",
    "Chart Rank / Player Count",
    "Ratings or Reviews",
    "Last Update Date",
    "Update Proof Link",
    "Employees",
    "Employees Verified",
    "Investor Backed",
    "Latest Funding",
    "Funding Proof Link",
    "Other Money Signals",
    "Money Signal Proof Link",
    "Contact Name",
    "Title",
    "Contact LinkedIn",
    "Email",
    "Email Source",
    "Generic Inbox",
    "Instagram",
    "X",
    "Discord",
    "Country",
    "Score",
    "Score Breakdown",
    "Grade",
  ];

  const rows = leads.map((l) => {
    const raw = (l.rawData ?? {}) as Record<string, unknown>;
    const signals = (l.signals ?? {}) as Record<string, unknown>;

    const str = (key: string) => {
      const v = raw[key];
      return v !== null && v !== undefined ? String(v) : "";
    };

    const bool = (key: string) => {
      const v = raw[key];
      if (v === true || v === "true") return "Yes";
      if (v === false || v === "false") return "No";
      return "";
    };

    // Score breakdown from signals JSON
    const breakdown = (() => {
      const bd = signals["breakdown"];
      if (!bd) return "";
      if (typeof bd === "string") return bd;
      if (typeof bd === "object") return JSON.stringify(bd);
      return String(bd);
    })();

    return [
      l.company,
      l.website ?? str("ownWebsite"),
      str("gameName"),
      str("storeLink"),
      l.segment ?? "",
      str("genre"),
      bool("earnsRealMoney"),
      "", // Clip Hook — left blank for user to fill
      str("chartRank") || str("playerCount"),
      str("ratingsCount"),
      str("lastUpdateDate"),
      str("updateProofUrl"),
      str("employees"),
      bool("employeesVerified"),
      bool("investorBacked"),
      str("latestFunding"),
      str("fundingProof"),
      str("moneySignals"),
      str("moneySignalProof"),
      l.decisionMaker ?? "",
      l.dmRole ?? "",
      l.linkedinUrl ?? str("contactLinkedin"),
      l.dmEmail ?? "",
      str("emailSource"),
      str("genericInbox") === "true" ? "Yes" : str("genericInbox") === "false" ? "No" : "",
      l.instagramHandle ?? "",
      l.xHandle ?? "",
      str("discord"),
      l.country ?? str("country"),
      l.score ?? "",
      breakdown,
      l.grade ?? "",
    ].map(escape).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const slug = (run.prompt ?? run.criteria ?? "leads").slice(0, 30).replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const filename = `leads-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
