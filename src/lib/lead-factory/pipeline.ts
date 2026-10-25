/**
 * Lead Factory Pipeline v2
 *
 * Sources (chart-rank-based only — no keyword searches):
 *   Roblox   → games.roblox.com top games by live players
 *   Steam    → SteamSpy top100in2weeks + Steam appdetails
 *   Mobile   → iTunes RSS top-grossing (US main chart + subcategory charts × 6 countries)
 *
 * All thresholds, blocklists, and genre lists live in config.json.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import cfg from "./config.json";

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function setStatus(runId: string, status: string, stage?: string) {
  await prisma.leadRun.update({
    where: { id: runId },
    data: { status, ...(stage !== undefined ? { stage } : {}) },
  });
}

async function setStage(runId: string, stage: string) {
  await prisma.leadRun.update({ where: { id: runId }, data: { stage } });
}

async function log(runId: string, stage: string, message: string, level: "info" | "warn" | "error" = "info") {
  await prisma.leadRunLog.create({ data: { runId, stage, message, level } }).catch(() => {});
}

async function isStopped(runId: string): Promise<boolean> {
  const r = await prisma.leadRun.findUnique({ where: { id: runId }, select: { status: true } });
  return r?.status === "stopped";
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contacts {
  email:     string | null;
  emailSource: "published" | "api" | "searxng" | null;
  genericInbox: boolean;
  instagram: string | null;
  twitter:   string | null;
  discord:   string | null;
  linkedin:  string | null;
}

function emptyContacts(): Contacts {
  return { email: null, emailSource: null, genericInbox: false, instagram: null, twitter: null, discord: null, linkedin: null };
}

interface Candidate {
  type:       "roblox" | "steam" | "mobile";
  name:       string;  // developer / studio name
  website:    string;  // own website (not platform profile)
  storeLink:  string;  // actual store page
  gameName:   string;
  description: string;
  genre:      string;
  chartRank:  number | null;
  ratingsCount: number | null;
  lastUpdateDate: string | null;
  updateProofUrl: string | null;
  country:    string | null;
  earnsRealMoney: boolean;
  contacts:   Contacts;
  rawData:    Record<string, unknown>;
}

interface RejectionRecord {
  name:   string;
  reason: string;
  source: string;
}

// ─── Config-derived sets (built once at module load) ─────────────────────────

const COMPANY_BLOCKLIST = new Set(
  cfg.blocklist.companies.map((s) => s.toLowerCase())
);

const DOMAIN_BLOCKLIST = new Set(cfg.domain_blocklist.domains.map((d) => d.toLowerCase()));

const GENRE_REJECT_PRIMARY = new Set(
  cfg.genre_reject.primary_genres.map((s) => s.toLowerCase())
);

const GENRE_REJECT_KEYWORDS = cfg.genre_reject.title_keywords.map((k) => k.toLowerCase());

const GENERIC_EMAIL_PREFIXES = new Set(cfg.email.generic_prefixes.map((s) => s.toLowerCase()));

const BAD_HANDLES = new Set(cfg.handles.bad_handles.map((s) => s.toLowerCase()));

// ─── Blocklist helpers ────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`)
      .hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/^www\./, "");
  }
}

function isDomainBlocked(url: string): boolean {
  const domain = extractDomain(url);
  if (DOMAIN_BLOCKLIST.has(domain)) return true;
  for (const blocked of DOMAIN_BLOCKLIST) {
    if (domain.endsWith("." + blocked) || domain === blocked) return true;
  }
  return false;
}

function isCompanyBlocked(name: string): boolean {
  const n = name.toLowerCase().trim();
  for (const blocked of COMPANY_BLOCKLIST) {
    if (n === blocked || n.includes(blocked)) return true;
  }
  return false;
}

// ─── Genre filter ─────────────────────────────────────────────────────────────

function isRejectedGenre(genre: string, title: string, description: string): boolean {
  const g = genre.toLowerCase();
  const t = title.toLowerCase();
  const d = description.toLowerCase().slice(0, 300);

  if (GENRE_REJECT_PRIMARY.has(g)) return true;

  for (const kw of GENRE_REJECT_KEYWORDS) {
    if (t.includes(kw) || g.includes(kw)) return true;
  }

  // Also check description for strong casino/puzzle signals
  const strongReject = ["slot machine", "texas hold", "blackjack", "roulette", "poker chips", "match-3", "match 3", "triple match", "merge ", "hidden object"];
  for (const kw of strongReject) {
    if (d.includes(kw)) return true;
  }

  return false;
}

// ─── Activity check ───────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function isActivityStale(lastUpdateDate: string | null, maxDays: number): boolean {
  if (!lastUpdateDate) return true; // missing = reject
  const d = new Date(lastUpdateDate);
  if (isNaN(d.getTime())) return true;
  return Date.now() - d.getTime() > maxDays * DAY_MS;
}

// ─── Email extraction (no fabrication) ───────────────────────────────────────
// Only extracts emails actually present in text. Never builds contact@domain.

function extractEmail(text: string): { email: string | null; generic: boolean } {
  if (!text) return { email: null, generic: false };

  // Full RFC-lite email regex
  const match = text.match(/\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  if (!match) return { email: null, generic: false };

  const prefix = match[1].toLowerCase();
  const domain = match[2].toLowerCase();

  // Reject if email domain is on blocklist
  if (DOMAIN_BLOCKLIST.has(domain) || [...DOMAIN_BLOCKLIST].some((d) => domain.endsWith("." + d))) {
    return { email: null, generic: false };
  }

  const generic = GENERIC_EMAIL_PREFIXES.has(prefix) ||
    [...GENERIC_EMAIL_PREFIXES].some((p) => prefix.startsWith(p + ".") || prefix.startsWith(p + "_"));

  return { email: match[0], generic };
}

// ─── Social handle extraction (URL-only, no @word scraping) ──────────────────

function extractSocialHandles(text: string): Pick<Contacts, "instagram" | "twitter" | "discord" | "linkedin"> {
  if (!text) return { instagram: null, twitter: null, discord: null, linkedin: null };

  // Only extract from actual profile URL patterns
  const igMatch  = text.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]{2,30})\/?(?:\s|$|[^a-zA-Z0-9_.])/i);
  const twMatch  = text.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([a-zA-Z0-9_]{2,30})\/?(?:\s|$|[^a-zA-Z0-9_])/i);
  const dcMatch  = text.match(/(?:https?:\/\/)?discord\.gg\/([a-zA-Z0-9_-]{2,30})\/?(?:\s|$|[^a-zA-Z0-9_-])/i);
  const liMatch  = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|company)\/([a-zA-Z0-9_%\-]{2,80})\/?/i);

  const validHandle = (h: string | undefined): string | null => {
    if (!h) return null;
    const clean = h.replace(/[/?#].*$/, "").toLowerCase();
    if (BAD_HANDLES.has(clean)) return null;
    if (clean.length < 2) return null;
    return h;
  };

  const ig = validHandle(igMatch?.[1]);
  const tw = validHandle(twMatch?.[1]);

  return {
    instagram: ig ? `@${ig}` : null,
    twitter:   tw ? `@${tw}` : null,
    discord:   dcMatch?.[1] ? `https://discord.gg/${dcMatch[1]}` : null,
    linkedin:  liMatch?.[1] ? `https://linkedin.com/company/${liMatch[1]}` : null,
  };
}

// ─── SearXNG email fallback ───────────────────────────────────────────────────

const SEARX_INSTANCES = [
  "https://searx.be",
  "https://search.inetol.net",
  "https://searxng.site",
  "https://opnxng.com",
  "https://search.bus-hit.me",
];

async function searxSearch(query: string): Promise<Array<{ title: string; url: string; content: string }>> {
  for (const base of SEARX_INSTANCES) {
    try {
      const url = `${base}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=en`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json() as { results?: Array<{ title: string; url: string; content?: string }> };
      const results = data.results ?? [];
      if (!results.length) continue;
      return results.slice(0, 8).map((r) => ({ title: r.title, url: r.url, content: r.content ?? "" }));
    } catch { /* try next */ }
  }
  return [];
}

async function findEmailViaSearx(studioName: string, ownWebsite: string): Promise<{ email: string | null; generic: boolean }> {
  // Query 1: studio name + email
  const r1 = await searxSearch(`"${studioName}" contact email`);
  const text1 = r1.map((r) => `${r.content} ${r.url}`).join(" ");
  const e1 = extractEmail(text1);
  if (e1.email) return e1;

  // Query 2: site:domain email (if they have a real domain)
  if (ownWebsite && !isDomainBlocked(ownWebsite)) {
    const domain = extractDomain(ownWebsite);
    const r2 = await searxSearch(`site:${domain} email contact`);
    const text2 = r2.map((r) => `${r.content} ${r.url}`).join(" ");
    const e2 = extractEmail(text2);
    if (e2.email) return e2;
  }

  return { email: null, generic: false };
}

// ─── Roblox source ────────────────────────────────────────────────────────────

interface RobloxGameRaw {
  creatorId: number;
  creatorName: string;
  creatorType: string;
  name: string;
  placeId: number;
  playerCount: number;
  totalUpVotes: number;
  updated?: string;
}

async function robloxFetchCreatorProfile(id: number, type: "Group" | "User"): Promise<{ description: string; updated: string | null }> {
  const url = type === "Group"
    ? `https://groups.roblox.com/v1/groups/${id}`
    : `https://users.roblox.com/v1/users/${id}`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) }).catch(() => null);
  if (!res?.ok) return { description: "", updated: null };
  const data = await res.json() as { description?: string; updated?: string };
  return { description: data.description ?? "", updated: data.updated ?? null };
}

async function robloxTopGames(minPlaying: number, take: number, rejections: RejectionRecord[]): Promise<Candidate[]> {
  const seenCreators = new Map<number, RobloxGameRaw>();
  let cursor = "";
  let pages = 0;
  const maxPages = 8;

  while (seenCreators.size < take * 2 && pages < maxPages) {
    const url = `https://games.roblox.com/v1/games/list?model.gameFilter=0&model.genreFilter=all&model.keyword=&model.sortToken=&model.maxRows=100${cursor ? `&model.cursor=${encodeURIComponent(cursor)}` : ""}`;
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) }).catch(() => null);
    if (!res?.ok) break;

    const data = await res.json() as { games?: RobloxGameRaw[]; nextPageCursor?: string };
    const games = data.games ?? [];

    for (const g of games) {
      if (g.playerCount >= minPlaying && !seenCreators.has(g.creatorId)) {
        seenCreators.set(g.creatorId, g);
      }
    }

    cursor = data.nextPageCursor ?? "";
    pages++;
    if (!cursor) break;
    // Stop early if CCU is dropping far below threshold
    if (games.length > 0 && games[games.length - 1].playerCount < minPlaying * 0.3) break;
  }

  const entries = [...seenCreators.entries()].slice(0, take * 2);
  const maxAge = cfg.activity.roblox_max_age_days;

  const results = await Promise.allSettled(
    entries.map(async ([creatorId, g]) => {
      const type = g.creatorType === "Group" ? "Group" : "User";
      const { description, updated } = await robloxFetchCreatorProfile(creatorId, type);

      const profileUrl = type === "Group"
        ? `https://www.roblox.com/groups/${creatorId}`
        : `https://www.roblox.com/users/${creatorId}/profile`;

      // Extract own website from bio (not social platforms)
      const ownUrlMatch = description.match(
        /https?:\/\/(?!(?:www\.)?(?:roblox|twitter|x|instagram|discord|youtube|twitch|tiktok|facebook|linktr)\.)([^\s<>"',]{4,80})/i
      );
      const ownWebsite = ownUrlMatch ? ownUrlMatch[0].replace(/[.,;)]+$/, "") : null;

      // Activity check
      const lastUpdate = updated ?? g.updated ?? null;
      const updateProofUrl = `https://www.roblox.com/games/${g.placeId}`;

      if (isActivityStale(lastUpdate, maxAge)) {
        rejections.push({ name: g.creatorName, reason: `Last update > ${maxAge} days ago (${lastUpdate ?? "unknown"})`, source: "roblox" });
        return null;
      }
      if (g.playerCount < cfg.activity.min_playing_roblox) {
        rejections.push({ name: g.creatorName, reason: `Only ${g.playerCount} playing (min ${cfg.activity.min_playing_roblox})`, source: "roblox" });
        return null;
      }

      // Blocklist
      if (isCompanyBlocked(g.creatorName)) {
        rejections.push({ name: g.creatorName, reason: "Company blocklisted", source: "roblox" });
        return null;
      }

      const { email, generic } = extractEmail(description);
      const handles = extractSocialHandles(description);

      const candidate: Candidate = {
        type: "roblox",
        name: g.creatorName,
        website: ownWebsite ?? profileUrl,
        storeLink: `https://www.roblox.com/games/${g.placeId}`,
        gameName: g.name,
        description: `Roblox ${type === "Group" ? "studio" : "developer"}. Game: "${g.name}" · ${g.playerCount} playing · ${g.totalUpVotes} upvotes.${description ? ` Bio: ${description.slice(0, 200)}` : ""}`,
        genre: "Roblox",
        chartRank: null,
        ratingsCount: g.totalUpVotes,
        lastUpdateDate: lastUpdate,
        updateProofUrl,
        country: null,
        earnsRealMoney: false,
        contacts: {
          email,
          emailSource: email ? "published" : null,
          genericInbox: generic,
          ...handles,
        },
        rawData: { ...g, creatorId, profileDesc: description, robloxProfileUrl: profileUrl },
      };
      return candidate;
    })
  );

  return results.filter((r): r is PromiseFulfilledResult<Candidate> =>
    r.status === "fulfilled" && r.value !== null
  ).map((r) => r.value);
}

// ─── Steam source ─────────────────────────────────────────────────────────────

async function steamTopGames(maxAgeMonths: number, rejections: RejectionRecord[]): Promise<Candidate[]> {
  // SteamSpy top100in2weeks — free, no key required
  const spyRes = await fetch("https://steamspy.com/api.php?request=top100in2weeks", {
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!spyRes?.ok) return [];

  const spyData = await spyRes.json() as Record<string, {
    appid: number; name: string; developer: string; publisher: string; owners: string;
  }>;

  const games = Object.values(spyData).slice(0, 100);
  const cutoff = new Date(Date.now() - maxAgeMonths * 30 * DAY_MS);
  const candidates: Candidate[] = [];
  const seenDevs = new Set<string>();

  await Promise.allSettled(games.map(async (game) => {
    const appid = game.appid;
    const detUrl = `https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic,genres,developers,publishers,support_info,website,release_date`;
    const detRes = await fetch(detUrl, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!detRes?.ok) return;

    const detData = await detRes.json() as Record<string, {
      success: boolean;
      data?: {
        name?: string;
        developers?: string[];
        publishers?: string[];
        genres?: Array<{ id: string; description: string }>;
        short_description?: string;
        website?: string;
        support_info?: { url?: string; email?: string };
        release_date?: { coming_soon: boolean; date: string };
        header_image?: string;
      };
    }>;
    const app = detData[String(appid)];
    if (!app?.success || !app.data) return;

    const devName = app.data.developers?.[0] ?? app.data.publishers?.[0] ?? game.developer;
    if (!devName) return;
    const key = devName.toLowerCase().trim();
    if (seenDevs.has(key)) return;

    // Blocklist check
    if (isCompanyBlocked(devName) || isCompanyBlocked(app.data.publishers?.[0] ?? "")) {
      rejections.push({ name: devName, reason: "Company blocklisted", source: "steam" });
      return;
    }

    // Release date / activity check
    if (app.data.release_date?.coming_soon) {
      rejections.push({ name: devName, reason: "Not yet released (coming_soon)", source: "steam" });
      return;
    }
    if (app.data.release_date?.date) {
      const rel = new Date(app.data.release_date.date);
      if (!isNaN(rel.getTime()) && rel < cutoff) {
        rejections.push({ name: devName, reason: `Release date ${app.data.release_date.date} older than ${maxAgeMonths} months`, source: "steam" });
        return;
      }
    }

    // Genre check
    const primaryGenre = app.data.genres?.[0]?.description ?? "";
    const gameName = app.data.name ?? game.name;
    const desc = app.data.short_description ?? "";
    if (isRejectedGenre(primaryGenre, gameName, desc)) {
      rejections.push({ name: devName, reason: `Rejected genre: "${primaryGenre}" / title: "${gameName}"`, source: "steam" });
      return;
    }

    seenDevs.add(key);

    const ownWebsite = app.data.website && !isDomainBlocked(app.data.website) ? app.data.website : null;
    const storeLink = `https://store.steampowered.com/app/${appid}`;

    // Support email — only if it's a real domain (not steam platform)
    const rawSupportEmail = app.data.support_info?.email ?? null;
    let contactEmail: string | null = null;
    let contactGeneric = false;
    if (rawSupportEmail) {
      const { email, generic } = extractEmail(rawSupportEmail);
      if (email) { contactEmail = email; contactGeneric = generic; }
    }

    const handles = extractSocialHandles(desc + " " + (ownWebsite ?? ""));

    candidates.push({
      type: "steam",
      name: devName,
      website: ownWebsite ?? storeLink,
      storeLink,
      gameName,
      description: `Steam developer. Game: "${gameName}". ${desc.slice(0, 250)}`.trim(),
      genre: primaryGenre,
      chartRank: null,
      ratingsCount: null, // SteamSpy `owners` is a range — not useful as a review count
      lastUpdateDate: app.data.release_date?.date ?? null,
      updateProofUrl: storeLink,
      country: null,
      earnsRealMoney: false,
      contacts: {
        email: contactEmail,
        emailSource: contactEmail ? "published" : null,
        genericInbox: contactGeneric,
        ...handles,
      },
      rawData: {
        appId: appid,
        gameName,
        source: "SteamSpy Top 100",
        ownersRange: game.owners,
        ...app.data,
      },
    });
  }));

  return candidates;
}

// ─── Apple App Store source ───────────────────────────────────────────────────
// Pulls top-grossing charts across allowed subcategories × countries.
// Skips ranks 1–49 on the US main chart; accepts anything from subcategory charts
// (which don't have a global rank — depth beyond the top 200).

interface ITunesRSSEntry {
  "im:name": { label: string };
  "im:artist": { label: string };
  id: { attributes: { "im:id": string }; label: string };
  "im:price"?: { attributes?: { amount?: string } };
}

interface ITunesLookupResult {
  trackId?: number;
  sellerName?: string;
  artistName?: string;
  sellerUrl?: string;
  description?: string;
  currentVersionReleaseDate?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  genres?: string[];
  userRatingCountForCurrentVersion?: number;
  userRatingCount?: number;
  trackName?: string;
  trackViewUrl?: string;
  price?: number;
  ipadScreenshotUrls?: string[];
  [key: string]: unknown;
}

async function fetchItunesChart(country: string, genreId: string, limit = 200): Promise<ITunesRSSEntry[]> {
  const url = `https://itunes.apple.com/${country}/rss/topgrossingapplications/limit=${limit}/genre=${genreId}/json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) }).catch(() => null);
  if (!res?.ok) return [];
  try {
    const data = await res.json() as { feed?: { entry?: ITunesRSSEntry[] } };
    return data.feed?.entry ?? [];
  } catch {
    return [];
  }
}

async function fetchItunesLookup(ids: string[]): Promise<Map<string, ITunesLookupResult>> {
  if (!ids.length) return new Map();
  // iTunes lookup has a max of ~100 IDs per request
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));

  const map = new Map<string, ITunesLookupResult>();
  for (const chunk of chunks) {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${chunk.join(",")}&country=us`, {
      signal: AbortSignal.timeout(20000),
    }).catch(() => null);
    if (!res?.ok) continue;
    try {
      const data = await res.json() as { results?: ITunesLookupResult[] };
      for (const d of data.results ?? []) {
        if (d.trackId) map.set(String(d.trackId), d);
      }
    } catch { /* skip */ }
  }
  return map;
}

async function appStoreTopGames(rejections: RejectionRecord[]): Promise<Candidate[]> {
  const countries = cfg.sources.app_store_countries;
  const allowedSubcats = cfg.sources.app_store_allowed_subcategory_ids;
  const skipTopN = cfg.sources.app_store_rank_skip_top; // skip ranks 1–49 on US main chart

  // Collect (appId, isMainUS, rank, country) tuples across all charts
  const appIdToMeta = new Map<string, { rank: number | null; country: string; fromMainUS: boolean }>();

  // 1. US main chart — skip ranks 1–skipTopN
  const usMain = await fetchItunesChart("us", "6014", 200);
  for (let i = 0; i < usMain.length; i++) {
    const rank = i + 1;
    const appId = usMain[i].id.attributes["im:id"];
    if (rank <= skipTopN) continue; // skip mega-publishers at top
    if (!appIdToMeta.has(appId)) {
      appIdToMeta.set(appId, { rank, country: "US", fromMainUS: true });
    }
  }

  // 2. Subcategory charts across all countries
  await Promise.allSettled(
    countries.flatMap((country) =>
      allowedSubcats.map(async (subcatId) => {
        const entries = await fetchItunesChart(country, subcatId, 200);
        for (let i = 0; i < entries.length; i++) {
          const appId = entries[i].id.attributes["im:id"];
          if (!appIdToMeta.has(appId)) {
            appIdToMeta.set(appId, { rank: null, country: country.toUpperCase(), fromMainUS: false });
          }
        }
      })
    )
  );

  if (!appIdToMeta.size) return [];

  // 3. Batch iTunes lookup for full metadata
  const allIds = [...appIdToMeta.keys()];
  const detailMap = await fetchItunesLookup(allIds);

  const candidates: Candidate[] = [];
  const seenDevs = new Set<string>();

  for (const [appId, meta] of appIdToMeta) {
    const detail = detailMap.get(appId);
    const devName = detail?.sellerName ?? detail?.artistName ?? "";
    if (!devName) continue;
    const key = devName.toLowerCase().trim();
    if (seenDevs.has(key)) continue;

    // Blocklist check
    if (isCompanyBlocked(devName)) {
      rejections.push({ name: devName, reason: "Company blocklisted", source: "mobile" });
      seenDevs.add(key);
      continue;
    }

    const gameName = detail?.trackName ?? "";
    const primaryGenre = detail?.primaryGenreName ?? "";
    const desc = detail?.description ?? "";

    // Genre check
    if (isRejectedGenre(primaryGenre, gameName, desc)) {
      rejections.push({ name: devName, reason: `Rejected genre: "${primaryGenre}" / title: "${gameName}"`, source: "mobile" });
      seenDevs.add(key);
      continue;
    }

    // Activity / ratings check
    const ratingsCount = detail?.userRatingCount ?? detail?.userRatingCountForCurrentVersion ?? 0;
    const minRatings = cfg.activity.min_ratings_mobile;
    if (ratingsCount < minRatings) {
      rejections.push({ name: devName, reason: `Only ${ratingsCount} ratings (min ${minRatings})`, source: "mobile" });
      seenDevs.add(key);
      continue;
    }

    // Last update date
    const lastUpdate = detail?.currentVersionReleaseDate ?? detail?.releaseDate ?? null;
    const maxAge = cfg.activity.max_age_days;
    if (!lastUpdate || isActivityStale(lastUpdate, maxAge)) {
      rejections.push({ name: devName, reason: `App not updated within ${maxAge} days (${lastUpdate ?? "unknown"})`, source: "mobile" });
      seenDevs.add(key);
      continue;
    }

    const storeLink = detail?.trackViewUrl ?? `https://apps.apple.com/us/app/id${appId}`;
    const rawSellerUrl = detail?.sellerUrl ?? null;
    const ownWebsite = rawSellerUrl && !isDomainBlocked(rawSellerUrl) ? rawSellerUrl : null;

    // Extract contacts from description (email only — no @word scraping)
    const { email: descEmail, generic: descGeneric } = extractEmail(desc);
    const handles = extractSocialHandles(desc + " " + (ownWebsite ?? ""));

    // Real-money signals: paid app or IAP-heavy genre
    const earnsRealMoney = (detail?.price ?? 0) > 0 || ["Casino", "Sports", "Racing"].includes(primaryGenre);

    seenDevs.add(key);
    candidates.push({
      type: "mobile",
      name: devName,
      website: ownWebsite ?? storeLink,
      storeLink,
      gameName,
      description: `Mobile developer (App Store, ${meta.country}${meta.rank ? ` #${meta.rank}` : ""}). Game: "${gameName}". ${desc.slice(0, 250)}`.trim(),
      genre: primaryGenre,
      chartRank: meta.rank,
      ratingsCount,
      lastUpdateDate: lastUpdate,
      updateProofUrl: storeLink,
      country: meta.country,
      earnsRealMoney,
      contacts: {
        email: descEmail,
        emailSource: descEmail ? "published" : null,
        genericInbox: descGeneric,
        ...handles,
      },
      rawData: { appId, fromMainUS: meta.fromMainUS, ...detail },
    });
  }

  return candidates;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

interface ScoreResult {
  score: number;
  grade: string;
  breakdown: string;
  activityVerified: boolean;
  genrePasses: boolean;
}

function scoreCandidate(c: Candidate): ScoreResult {
  const sc = cfg.scoring;
  let score = 0;
  const parts: string[] = [];

  // Required check: activity
  const activityVerified = c.lastUpdateDate !== null && !isActivityStale(
    c.lastUpdateDate,
    c.type === "roblox" ? cfg.activity.roblox_max_age_days : cfg.activity.max_age_days
  );
  if (activityVerified) { score += sc.activity_verified; parts.push(`activity(${sc.activity_verified})`); }

  // Required check: genre
  const genrePasses = !isRejectedGenre(c.genre, c.gameName, c.description);

  // Email found
  if (c.contacts.email && !c.contacts.genericInbox) {
    score += sc.real_email_found; parts.push(`email(${sc.real_email_found})`);
  } else if (c.contacts.email && c.contacts.genericInbox) {
    // Generic email still provides some value
    score += Math.floor(sc.real_email_found / 2); parts.push(`generic_email(${Math.floor(sc.real_email_found / 2)})`);
  }

  // Audience size
  const audience = c.ratingsCount ?? (c.type === "roblox" ? (c.rawData.playerCount as number ?? 0) : 0);
  if (audience >= 50000) { score += sc.audience_large; parts.push(`audience_large(${sc.audience_large})`); }
  else if (audience >= 5000) { score += sc.audience_medium; parts.push(`audience_medium(${sc.audience_medium})`); }

  // Country bonus (US/UK/CA/AU/EU)
  const goodCountries = new Set(["US", "GB", "CA", "AU", "DE", "FR", "NL", "SE", "NO", "DK", "FI"]);
  if (c.country && goodCountries.has(c.country.toUpperCase())) {
    score += sc.us_uk_ca_au_eu_country; parts.push(`country(${sc.us_uk_ca_au_eu_country})`);
  }

  // Real-money gameplay
  if (c.earnsRealMoney) { score += sc.real_money_gameplay; parts.push(`real_money(${sc.real_money_gameplay})`); }

  score = Math.min(100, Math.max(0, score));
  const breakdown = parts.join(" + ") || "0";

  // Grade: A requires activity + genre + money signal + named DM — we can't know DM here
  // so A is awarded in the final save step when DM is populated.
  // For now: B = activity + email found; C = activity; D/F = missing required.
  let grade: string;
  if (!activityVerified || !genrePasses) {
    grade = "F";
  } else if (score >= sc.grade_a_threshold) {
    grade = "A";
  } else if (score >= sc.grade_b_threshold) {
    grade = "B";
  } else if (score >= sc.grade_c_threshold) {
    grade = "C";
  } else if (score >= sc.grade_d_threshold) {
    grade = "D";
  } else {
    grade = "F";
  }

  return { score, grade, breakdown, activityVerified, genrePasses };
}

// ─── Cross-run deduplication ──────────────────────────────────────────────────

async function loadSeenDomains(): Promise<Set<string>> {
  const rows = await prisma.leadFactoryLead.findMany({
    select: { website: true },
    where: { run: { status: { in: ["completed", "stopped"] } } },
  });
  const domains = new Set<string>();
  for (const row of rows) {
    if (row.website) domains.add(extractDomain(row.website));
  }
  return domains;
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function processLeadRun(runId: string): Promise<void> {
  const run = await prisma.leadRun.findUnique({ where: { id: runId } });
  if (!run) return;

  // Rejection tracking for the final report
  const rejections: RejectionRecord[] = [];

  try {
    // ── PHASE 1: SETUP ────────────────────────────────────────────────────────
    await setStatus(runId, "planning", "Initialising pipeline…");
    await log(runId, "planning", `Run started: criteria="${(run.criteria ?? "none").slice(0, 80)}" count=${run.count}`);

    // Load existing domains to avoid cross-run duplicates
    await setStage(runId, "Loading seen companies from previous runs…");
    const seenDomains = await loadSeenDomains();
    await log(runId, "planning", `Cross-run deduplication: ${seenDomains.size} known domains loaded`);

    if (await isStopped(runId)) return;

    // ── PHASE 2: DISCOVER ─────────────────────────────────────────────────────
    await setStatus(runId, "discovering", "Fetching charts…");

    const seenThisRun = new Set<string>();
    const candidates: Candidate[] = [];
    let totalPulled = 0;

    function tryAdd(c: Candidate) {
      const domain = extractDomain(c.website);
      // Skip platform URLs as unique key — use storeLink domain if website is platform
      const storeKey = extractDomain(c.storeLink);
      const key = !isDomainBlocked(c.website) ? domain : storeKey;

      if (seenThisRun.has(key)) return;
      if (seenDomains.has(key)) {
        rejections.push({ name: c.name, reason: "Already seen in a previous run", source: c.type });
        return;
      }
      seenThisRun.add(key);
      candidates.push(c);
    }

    // Roblox
    await setStage(runId, `Fetching Roblox top games (≥${cfg.sources.roblox_min_ccu} playing)…`);
    const robloxResults = await robloxTopGames(cfg.sources.roblox_min_ccu, Math.max(run.count * 4, 200), rejections);
    totalPulled += Math.max(run.count * 4, 200);
    robloxResults.forEach(tryAdd);
    await log(runId, "discovering", `Roblox: ${candidates.filter((c) => c.type === "roblox").length} candidates`);
    if (await isStopped(runId)) return;

    // Steam
    await setStage(runId, "Fetching Steam top trending games…");
    const steamResults = await steamTopGames(cfg.sources.steam_max_age_months, rejections);
    totalPulled += 100;
    steamResults.forEach(tryAdd);
    await log(runId, "discovering", `Steam: ${candidates.filter((c) => c.type === "steam").length} candidates`);
    if (await isStopped(runId)) return;

    // App Store (multi-chart)
    await setStage(runId, "Fetching App Store charts (subcategories × countries)…");
    const mobileResults = await appStoreTopGames(rejections);
    totalPulled += (cfg.sources.app_store_countries.length * (cfg.sources.app_store_allowed_subcategory_ids.length + 1)) * 200;
    mobileResults.forEach(tryAdd);
    await log(runId, "discovering", `App Store: ${candidates.filter((c) => c.type === "mobile").length} candidates`);

    const preFilterCount = candidates.length;
    await setStage(runId, `Discovered ${preFilterCount} unique candidates`);
    await log(runId, "discovering", `Total unique candidates: ${preFilterCount} (from ~${totalPulled} raw)`);

    if (candidates.length === 0) {
      await writeRejectionReport(runId, rejections, 0, 0);
      await setStatus(runId, "failed", "No candidates found after filtering. Check external APIs.");
      return;
    }

    if (await isStopped(runId)) return;

    // ── PHASE 2.5: HARD FILTER ────────────────────────────────────────────────
    // Secondary pass to catch any candidates that slipped through source-level checks
    await setStage(runId, "Applying hard filters…");
    const hardFiltered: Candidate[] = [];

    for (const c of candidates) {
      // Domain blocklist
      if (isDomainBlocked(c.website) && isDomainBlocked(c.storeLink)) {
        rejections.push({ name: c.name, reason: `Both website and store link are platform URLs (${c.website})`, source: c.type });
        continue;
      }
      // Company blocklist
      if (isCompanyBlocked(c.name)) {
        rejections.push({ name: c.name, reason: "Company name in blocklist", source: c.type });
        continue;
      }
      // Genre filter
      if (isRejectedGenre(c.genre, c.gameName, c.description)) {
        rejections.push({ name: c.name, reason: `Rejected genre: "${c.genre}" game: "${c.gameName}"`, source: c.type });
        continue;
      }
      hardFiltered.push(c);
    }

    candidates.length = 0;
    candidates.push(...hardFiltered);
    await log(runId, "discovering", `After hard filter: ${candidates.length} candidates`);

    if (candidates.length === 0) {
      await writeRejectionReport(runId, rejections, preFilterCount, 0);
      await setStatus(runId, "failed", "All candidates filtered out. Adjust criteria or blocklist.");
      return;
    }

    if (await isStopped(runId)) return;

    // ── PHASE 3: SCORE + ENRICH ───────────────────────────────────────────────
    await setStatus(runId, "researching", "Scoring and enriching leads…");

    // Sort: mobile and steam first (better email findability), roblox last
    const typeOrder = { steam: 0, mobile: 1, roblox: 2 };
    candidates.sort((a, b) => (typeOrder[a.type] ?? 2) - (typeOrder[b.type] ?? 2));

    let savedCount = 0;
    const processCap = run.count * 6;
    const toProcess = candidates.slice(0, Math.min(candidates.length, processCap));

    const BATCH = 15;

    for (let i = 0; i < toProcess.length && savedCount < run.count; i += BATCH) {
      if (await isStopped(runId)) return;

      const batch = toProcess.slice(i, Math.min(i + BATCH, toProcess.length));

      for (const c of batch) {
        if (savedCount >= run.count) break;

        const scored = scoreCandidate(c);

        // Skip F-grade leads (failed required checks)
        if (scored.grade === "F") {
          rejections.push({ name: c.name, reason: `Grade F (score ${scored.score}): ${scored.breakdown}`, source: c.type });
          continue;
        }

        // Email enrichment — only if no real email found from source
        if (!c.contacts.email) {
          const { email, generic } = await findEmailViaSearx(c.name, isDomainBlocked(c.website) ? "" : c.website);
          if (email) {
            c.contacts.email = email;
            c.contacts.emailSource = "searxng";
            c.contacts.genericInbox = generic;
          }
        }

        // Require email
        if (!c.contacts.email) {
          rejections.push({ name: c.name, reason: "No email found (source + SearXNG exhausted)", source: c.type });
          continue;
        }

        // Re-score now that we may have email
        const finalScored = scoreCandidate(c);

        savedCount++;

        const signals = {
          activityVerified: finalScored.activityVerified,
          genrePasses: finalScored.genrePasses,
          notBlocklisted: true,
          hasFunding: false,
          hasOtherMoneySignal: c.chartRank !== null,
          namedDecisionMaker: false,
          publishedEmail: c.contacts.emailSource === "published",
          audienceSize: (c.ratingsCount ?? 0) >= 50000 ? "large" : (c.ratingsCount ?? 0) >= 5000 ? "medium" : "small",
          country: c.country,
          realMoneyGameplay: c.earnsRealMoney,
          breakdown: finalScored.breakdown,
          total: finalScored.score,
        };

        // Determine final grade: A requires money signal + no generic email
        let finalGrade = finalScored.grade;
        const hasMoneySignal = c.chartRank !== null;
        const hasNamedDM = false; // no DM enrichment without paid API
        if (finalGrade === "A" && (!hasMoneySignal || !hasNamedDM || c.contacts.genericInbox)) {
          finalGrade = "B";
        }

        // Own website (not platform) for CSV
        const ownWebsite = !isDomainBlocked(c.website) ? c.website : null;

        await prisma.leadFactoryLead.create({
          data: {
            runId,
            num: savedCount,
            company:        c.name.slice(0, 100),
            website:        ownWebsite ?? c.storeLink,
            whatItIs:       c.description.replace(/\n/g, " ").slice(0, 250),
            segment:        c.type === "roblox" ? "Roblox Studio" : c.type === "steam" ? "PC/Steam Developer" : "Mobile Developer",
            grade:          finalGrade,
            score:          finalScored.score,
            country:        c.country,
            decisionMaker:  null,
            dmRole:         null,
            dmEmail:        c.contacts.email,
            instagramHandle: c.contacts.instagram,
            xHandle:        c.contacts.twitter,
            linkedinUrl:    c.contacts.linkedin,
            bestChannel:    c.contacts.email ? (c.contacts.genericInbox ? "generic-inbox" : "email") : "direct",
            whyItFits:      Prisma.JsonNull,
            signals:        signals as unknown as Prisma.InputJsonValue,
            rawData: {
              source:          c.type,
              gameName:        c.gameName,
              storeLink:       c.storeLink,
              genre:           c.genre,
              chartRank:       c.chartRank,
              ratingsCount:    c.ratingsCount,
              lastUpdateDate:  c.lastUpdateDate,
              updateProofUrl:  c.updateProofUrl,
              country:         c.country,
              earnsRealMoney:  c.earnsRealMoney,
              employees:       null,
              employeesVerified: false,
              investorBacked:  null,
              latestFunding:   null,
              fundingProof:    null,
              moneySignals:    c.chartRank !== null ? [`Chart rank ${c.chartRank}`] : [],
              moneySignalProof: c.updateProofUrl,
              emailSource:     c.contacts.emailSource,
              genericInbox:    c.contacts.genericInbox,
              discord:         c.contacts.discord,
              ownWebsite,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        await prisma.leadRun.update({
          where: { id: runId },
          data: {
            stage: `Saved ${savedCount} / ${run.count} leads`,
            stats: {
              pulled: preFilterCount,
              filtered: preFilterCount - candidates.length,
              saved: savedCount,
              rejectedTotal: rejections.length,
            },
          },
        });
      }
    }

    // ── DONE ──────────────────────────────────────────────────────────────────
    await writeRejectionReport(runId, rejections, preFilterCount, savedCount);

    await prisma.leadRun.update({
      where: { id: runId },
      data: {
        status: "completed",
        stage: null,
        stats: { pulled: preFilterCount, saved: savedCount, rejectedTotal: rejections.length },
      },
    });

    await log(runId, "completed", `✓ ${savedCount} leads saved. ${rejections.length} total rejections from ${preFilterCount} candidates.`);

  } catch (err) {
    const msg = String(err).slice(0, 400);
    await log(runId, "failed", msg, "error").catch(() => {});
    await prisma.leadRun.update({ where: { id: runId }, data: { status: "failed", stage: msg } }).catch(() => {});
  }
}

// ─── Rejection report ─────────────────────────────────────────────────────────

async function writeRejectionReport(runId: string, rejections: RejectionRecord[], pulled: number, saved: number) {
  // Summarise by reason category
  const counts: Record<string, number> = {};
  for (const r of rejections) {
    const cat = categoriseRejection(r.reason);
    counts[cat] = (counts[cat] ?? 0) + 1;
  }

  const summary = [
    `=== REJECTION REPORT ===`,
    `Candidates pulled: ${pulled}`,
    `Saved: ${saved}`,
    `Rejected total: ${rejections.length}`,
    ``,
    `By category:`,
    ...Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, n]) => `  ${cat}: ${n}`),
    ``,
    `Examples (first 3 per category):`,
    ...Object.keys(counts).flatMap((cat) => {
      const examples = rejections.filter((r) => categoriseRejection(r.reason) === cat).slice(0, 3);
      return [`  [${cat}]`, ...examples.map((r) => `    ${r.name} — ${r.reason}`)];
    }),
  ].join("\n");

  await log(runId, "completed", summary, "info");
}

function categoriseRejection(reason: string): string {
  if (reason.includes("blocklist") || reason.includes("blocklisted")) return "company-blocklisted";
  if (reason.includes("genre") || reason.includes("Genre")) return "rejected-genre";
  if (reason.includes("rating") || reason.includes("Rating")) return "low-ratings";
  if (reason.includes("playing") || reason.includes("Playing")) return "low-player-count";
  if (reason.includes("update") || reason.includes("Update") || reason.includes("stale")) return "inactive";
  if (reason.includes("previous run") || reason.includes("seen")) return "duplicate";
  if (reason.includes("email") || reason.includes("Email")) return "no-email";
  if (reason.includes("platform") || reason.includes("URL")) return "platform-only-url";
  if (reason.includes("Grade F")) return "low-score";
  if (reason.includes("release") || reason.includes("Release")) return "too-old-or-unreleased";
  return "other";
}
