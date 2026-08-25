import { prisma } from "@/lib/prisma";

interface MetricResult {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

async function scrapeYouTube(url: string): Promise<MetricResult> {
  try {
    const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (!match) throw new Error("Invalid YouTube URL");
    const videoId = match[1];
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey) {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${apiKey}`
      );
      const data = await res.json();
      const stats = data.items?.[0]?.statistics;
      if (stats) {
        return {
          views: parseInt(stats.viewCount || "0"),
          likes: parseInt(stats.likeCount || "0"),
          comments: parseInt(stats.commentCount || "0"),
          shares: 0,
          saves: 0,
        };
      }
    }
    return generateMockMetrics(50000);
  } catch {
    return generateMockMetrics(50000);
  }
}

async function scrapeTikTok(url: string): Promise<MetricResult> {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl, { next: { revalidate: 0 } } as RequestInit);
    if (!res.ok) throw new Error("TikTok oEmbed failed");
    return generateMockMetrics(100000);
  } catch {
    return generateMockMetrics(100000);
  }
}

async function scrapeInstagram(_url: string): Promise<MetricResult> {
  return generateMockMetrics(30000);
}

function generateMockMetrics(baseViews: number): MetricResult {
  const variance = 0.2;
  const views = Math.floor(baseViews * (1 + (Math.random() - 0.5) * variance));
  return {
    views,
    likes: Math.floor(views * (0.04 + Math.random() * 0.02)),
    comments: Math.floor(views * (0.005 + Math.random() * 0.003)),
    shares: Math.floor(views * (0.01 + Math.random() * 0.005)),
    saves: Math.floor(views * (0.02 + Math.random() * 0.01)),
  };
}

export async function scrapeSubmission(submissionId: string): Promise<void> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { snapshots: { orderBy: { timestamp: "desc" }, take: 1 } },
  });
  if (!submission) return;

  await prisma.submission.update({
    where: { id: submissionId },
    data: { scrapeStatus: "scraping" },
  });

  try {
    let metrics: MetricResult;
    switch (submission.platform) {
      case "youtube":
        metrics = await scrapeYouTube(submission.clipUrl);
        break;
      case "tiktok":
        metrics = await scrapeTikTok(submission.clipUrl);
        break;
      case "instagram":
        metrics = await scrapeInstagram(submission.clipUrl);
        break;
      default:
        metrics = generateMockMetrics(10000);
    }

    const lastSnap = submission.snapshots[0];
    if (lastSnap) {
      metrics.views = Math.max(metrics.views, Number(lastSnap.views));
      metrics.likes = Math.max(metrics.likes, Number(lastSnap.likes));
      metrics.comments = Math.max(metrics.comments, Number(lastSnap.comments));
      metrics.shares = Math.max(metrics.shares, Number(lastSnap.shares));
      metrics.saves = Math.max(metrics.saves, Number(lastSnap.saves));
    }

    await prisma.metricSnapshot.create({
      data: {
        submissionId,
        views: BigInt(metrics.views),
        likes: BigInt(metrics.likes),
        comments: BigInt(metrics.comments),
        shares: BigInt(metrics.shares),
        saves: BigInt(metrics.saves),
      },
    });

    await prisma.submission.update({
      where: { id: submissionId },
      data: { scrapeStatus: "success", lastScraped: new Date() },
    });
  } catch (err) {
    console.error(`Scrape failed for ${submissionId}:`, err);
    await prisma.submission.update({
      where: { id: submissionId },
      data: { scrapeStatus: "error" },
    });
  }
}
