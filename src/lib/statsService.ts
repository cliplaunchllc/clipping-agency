import { prisma } from "@/lib/prisma";

export interface ClipStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
  );
  return match?.[1] ?? null;
}

function extractTikTokVideoId(url: string): string | null {
  const match = url.match(/\/(?:video|v)\/(\d+)/);
  return match?.[1] ?? null;
}

function extractInstagramShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

interface InstagramResult {
  stats: ClipStats;
  thumbnailUrl: string | null;
}

async function fetchInstagramStats(url: string): Promise<InstagramResult | null> {
  const token = process.env.APIFY_TOKEN;
  if (!token) { console.log("[Instagram] APIFY_TOKEN not set"); return null; }

  try {
    // Start Apify Instagram scraper run
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrls: [url],
          resultsType: "posts",
          resultsLimit: 1,
        }),
        cache: "no-store",
      }
    );
    if (!runRes.ok) {
      console.log("[Instagram] Apify run start failed:", runRes.status, await runRes.text());
      return null;
    }
    const runData = await runRes.json();
    const runId = runData?.data?.id;
    if (!runId) { console.log("[Instagram] No run ID returned"); return null; }

    // Poll until finished (max 60s)
    let status = runData?.data?.status;
    for (let i = 0; i < 20 && status !== "SUCCEEDED" && status !== "FAILED"; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`, { cache: "no-store" });
      if (statusRes.ok) {
        const s = await statusRes.json();
        status = s?.data?.status;
      }
    }

    if (status !== "SUCCEEDED") { console.log("[Instagram] Apify run did not succeed:", status); return null; }

    // Fetch dataset items
    const datasetId = runData?.data?.defaultDatasetId;
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=1`,
      { cache: "no-store" }
    );
    if (!itemsRes.ok) { console.log("[Instagram] Failed to fetch dataset items"); return null; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = await itemsRes.json();
    const item = items?.[0];
    if (!item) { console.log("[Instagram] No items in dataset"); return null; }

    console.log("[Instagram] Apify item keys:", Object.keys(item));
    console.log("[Instagram] Apify item (media/thumbnail fields):", {
      displayUrl: item.displayUrl,
      thumbnailUrl: item.thumbnailUrl,
      previewUrl: item.previewUrl,
      imageUrl: item.imageUrl,
      coverUrl: item.coverUrl,
      images: item.images,
      videoUrl: item.videoUrl,
      type: item.type,
    });

    const views = item.videoPlayCount ?? item.playsCount ?? item.videoViewCount ?? 0;
    const likes = item.likesCount ?? 0;
    const comments = item.commentsCount ?? 0;
    const shares = item.sharesCount ?? 0;
    const thumbnailUrl: string | null = item.displayUrl ?? item.thumbnailUrl ?? item.previewUrl ?? item.imageUrl ?? item.coverUrl ?? null;
    console.log("[Instagram] Apify success:", { views, likes, comments, shares, thumbnailUrl });
    return { stats: { views, likes, comments, shares, saves: 0 }, thumbnailUrl };
  } catch (e) {
    console.log("[Instagram] Apify error:", e);
    return null;
  }
}

async function fetchYouTubeStats(url: string): Promise<ClipStats | null> {
  const videoId = extractYouTubeId(url);
  if (!videoId) { console.log("[YouTube] Could not extract video ID from:", url); return null; }
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) { console.log("[YouTube] YOUTUBE_API_KEY not set"); return null; }
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(videoId)}&key=${apiKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      const err = await res.text();
      console.log("[YouTube] API error", res.status, err);
      return null;
    }
    const data = await res.json();
    const s = data.items?.[0]?.statistics;
    if (!s) { console.log("[YouTube] No statistics in response for video", videoId, JSON.stringify(data)); return null; }
    console.log("[YouTube] Fetched stats for", videoId, s);
    return {
      views: parseInt(s.viewCount ?? "0", 10),
      likes: parseInt(s.likeCount ?? "0", 10),
      comments: parseInt(s.commentCount ?? "0", 10),
      shares: 0,
      saves: 0,
    };
  } catch (e) {
    console.log("[YouTube] Exception:", e);
    return null;
  }
}

const TIKTOK_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchTikTokStats(url: string): Promise<ClipStats | null> {
  const videoId = extractTikTokVideoId(url);

  // --- Approach 1: TikTok JSON API (most reliable, no HTML parsing) ---
  if (videoId) {
    try {
      const apiUrl =
        `https://www.tiktok.com/api/item/detail/?itemId=${videoId}` +
        `&aid=1988&app_name=tiktok_web&device_platform=web_pc` +
        `&region=US&priority_region=US&os=windows` +
        `&browser_language=en-US&browser_platform=Win32` +
        `&browser_name=Mozilla&browser_version=5.0%20(Windows%20NT%2010.0%3B%20Win64%3B%20x64)`;

      const res = await fetch(apiUrl, {
        headers: {
          "User-Agent": TIKTOK_UA,
          Referer: "https://www.tiktok.com/",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
        },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const item = data?.itemInfo?.itemStruct;
        const s = item?.stats;
        const sv2 = item?.statsV2;
        if (s || sv2) {
          return {
            views: parseInt(String(sv2?.playCount ?? s?.playCount ?? "0"), 10),
            likes: parseInt(String(sv2?.diggCount ?? s?.diggCount ?? "0"), 10),
            comments: parseInt(String(sv2?.commentCount ?? s?.commentCount ?? "0"), 10),
            shares: parseInt(String(sv2?.shareCount ?? s?.shareCount ?? "0"), 10),
            saves: parseInt(String(sv2?.collectCount ?? s?.collectCount ?? "0"), 10),
          };
        }
      }
    } catch { /* fall through */ }

    // --- Approach 2: Mobile API endpoint ---
    try {
      const res = await fetch(
        `https://api16-normal-c-useast1a.tiktok.com/aweme/v1/feed/?aweme_id=${videoId}&aid=1180&app_name=musical_ly&device_platform=android&os=android`,
        {
          headers: {
            "User-Agent": "com.zhiliaoapp.musically/2022600030 (Linux; U; Android 10; en_US; Pixel 4; Build/QQ3A.200805.001; Cronet/58.0.2991.0)",
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );
      if (res.ok) {
        const data = await res.json();
        const item = data?.aweme_list?.[0];
        const s = item?.statistics;
        if (s) {
          return {
            views: s.play_count ?? 0,
            likes: s.digg_count ?? 0,
            comments: s.comment_count ?? 0,
            shares: s.share_count ?? 0,
            saves: s.collect_count ?? 0,
          };
        }
      }
    } catch { /* fall through */ }
  }

  // --- Approach 3: HTML scraping as last resort ---
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": TIKTOK_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://www.tiktok.com/",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      cache: "no-store",
      redirect: "follow",
    });
    if (res.ok) {
      const html = await res.text();

      // __UNIVERSAL_DATA_FOR_REHYDRATION__
      const m1 = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
      if (m1) {
        try {
          const json = JSON.parse(m1[1]);
          const detail = json?.["__DEFAULT_SCOPE__"]?.["webapp.video-detail"]?.itemInfo?.itemStruct;
          const s = detail?.stats;
          const sv2 = detail?.statsV2;
          if (s || sv2) {
            return {
              views: parseInt(String(sv2?.playCount ?? s?.playCount ?? "0"), 10),
              likes: parseInt(String(sv2?.diggCount ?? s?.diggCount ?? "0"), 10),
              comments: parseInt(String(sv2?.commentCount ?? s?.commentCount ?? "0"), 10),
              shares: parseInt(String(sv2?.shareCount ?? s?.shareCount ?? "0"), 10),
              saves: parseInt(String(sv2?.collectCount ?? s?.collectCount ?? "0"), 10),
            };
          }
        } catch { /* continue */ }
      }

      // Regex fallback on raw HTML
      const m3 = html.match(/"playCount"\s*:\s*"?(\d+)"?/);
      const m4 = html.match(/"diggCount"\s*:\s*"?(\d+)"?/);
      if (m3 && m4) {
        return {
          views: parseInt(m3[1], 10),
          likes: parseInt(m4[1], 10),
          comments: parseInt((html.match(/"commentCount"\s*:\s*"?(\d+)"?/)?.[1] ?? "0"), 10),
          shares: parseInt((html.match(/"shareCount"\s*:\s*"?(\d+)"?/)?.[1] ?? "0"), 10),
          saves: parseInt((html.match(/"collectCount"\s*:\s*"?(\d+)"?/)?.[1] ?? "0"), 10),
        };
      }
    }
  } catch { /* ignore */ }

  return null;
}

export async function fetchThumbnailUrl(url: string, platform: string): Promise<string | null> {
  if (platform === "youtube") {
    const videoId = extractYouTubeId(url);
    if (!videoId) return null;
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }
  if (platform === "instagram") {
    try {
      const res = await fetch(`https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}&maxwidth=640`, {
        headers: { "User-Agent": TIKTOK_UA },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.thumbnail_url) return data.thumbnail_url;
      }
    } catch { /* ignore */ }
  }
  if (platform === "tiktok") {
    const videoId = extractTikTokVideoId(url);
    // Try API thumbnail first
    if (videoId) {
      try {
        const apiUrl = `https://www.tiktok.com/api/item/detail/?itemId=${videoId}&aid=1988&app_name=tiktok_web&device_platform=web_pc`;
        const res = await fetch(apiUrl, {
          headers: { "User-Agent": TIKTOK_UA, Referer: "https://www.tiktok.com/", Accept: "application/json" },
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          const cover = data?.itemInfo?.itemStruct?.video?.cover ?? data?.itemInfo?.itemStruct?.video?.dynamicCover;
          if (cover) return cover;
        }
      } catch { /* fall through */ }
    }
    // oEmbed fallback
    try {
      const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
        headers: { "User-Agent": TIKTOK_UA, Accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return data.thumbnail_url ?? null;
      }
    } catch { /* ignore */ }
  }
  return null;
}

export async function fetchStatsForClip(
  clipId: string,
  url: string,
  platform: string
): Promise<ClipStats | null> {
  let stats: ClipStats | null = null;
  let apifyThumbnail: string | null = null;

  if (platform === "youtube") {
    stats = await fetchYouTubeStats(url);
  } else if (platform === "tiktok") {
    stats = await fetchTikTokStats(url);
  } else if (platform === "instagram") {
    const result = await fetchInstagramStats(url);
    if (result) {
      stats = result.stats;
      apifyThumbnail = result.thumbnailUrl;
    }
  }

  if (stats) {
    const thumbnailUrl = apifyThumbnail ?? await fetchThumbnailUrl(url, platform);
    await prisma.clip.update({
      where: { id: clipId },
      data: {
        views: stats.views,
        likes: stats.likes,
        comments: stats.comments,
        shares: stats.shares,
        saves: stats.saves,
        lastScraped: new Date(),
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
      },
    });
  } else {
    // Still update lastScraped so we know we tried
    await prisma.clip.update({
      where: { id: clipId },
      data: { lastScraped: new Date() },
    });
  }

  return stats;
}
