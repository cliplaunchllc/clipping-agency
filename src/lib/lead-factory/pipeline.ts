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

// google-play-scraper is loaded lazily inside googlePlayTopGames() to prevent
// a module-load crash from breaking the entire pipeline.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _gplay: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getGplay(): any {
  if (_gplay) return _gplay;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require("google-play-scraper");
    _gplay = m.default ?? m;
  } catch {
    _gplay = null;
  }
  return _gplay;
}

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

function blankEnrichment(): Pick<Candidate, "decisionMaker" | "decisionMakerTitle" | "decisionMakerLinkedin" | "investorBacked" | "fundingDetails" | "fundingProofUrl"> {
  return { decisionMaker: null, decisionMakerTitle: null, decisionMakerLinkedin: null, investorBacked: false, fundingDetails: null, fundingProofUrl: null };
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
  installCount: number | null;    // Google Play minInstalls
  lastUpdateDate: string | null;
  updateProofUrl: string | null;
  country:    string | null;
  earnsRealMoney: boolean;
  // Enriched signals (filled during phase 3)
  decisionMaker:       string | null;
  decisionMakerTitle:  string | null;
  decisionMakerLinkedin: string | null;
  investorBacked:      boolean;
  fundingDetails:      string | null;
  fundingProofUrl:     string | null;
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

const EMAIL_RE = /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;

function classifyEmail(raw: string): { email: string; generic: boolean } | null {
  const m = raw.match(/^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
  if (!m) return null;
  const prefix = m[1].toLowerCase();
  const domain = m[2].toLowerCase();
  if (DOMAIN_BLOCKLIST.has(domain) || [...DOMAIN_BLOCKLIST].some((d) => domain.endsWith("." + d))) return null;
  const generic = GENERIC_EMAIL_PREFIXES.has(prefix) ||
    [...GENERIC_EMAIL_PREFIXES].some((p) => prefix.startsWith(p + ".") || prefix.startsWith(p + "_"));
  return { email: raw.toLowerCase(), generic };
}

/** Scan all emails in text, prefer non-generic, fallback to first generic. */
function extractEmail(text: string): { email: string | null; generic: boolean } {
  if (!text) return { email: null, generic: false };
  const matches = [...text.matchAll(EMAIL_RE)];
  const all: Array<{ email: string; generic: boolean }> = [];
  for (const m of matches) {
    const c = classifyEmail(m[0]);
    if (c) all.push(c);
  }
  if (!all.length) return { email: null, generic: false };
  const named = all.find((e) => !e.generic);
  return named ?? all[0];
}

// ─── Website scraping for email ───────────────────────────────────────────────
// Fetches the studio's actual website — no API key needed, highest hit rate.

const SCRAPE_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function scrapePageForEmail(url: string): Promise<{ email: string | null; generic: boolean }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": SCRAPE_UA, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.5" },
      signal: AbortSignal.timeout(5000), // reduced from 9s
    });
    if (!res.ok) return { email: null, generic: false };
    const reader = res.body?.getReader();
    if (!reader) return { email: null, generic: false };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < 200000) { // 200 KB is plenty
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.length;
    }
    reader.cancel().catch(() => {});
    const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");

    // Priority 1: mailto: links
    const mailtoMatches = [...html.matchAll(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi)];
    const mailtoEmails: Array<{ email: string; generic: boolean }> = [];
    for (const m of mailtoMatches) {
      const c = classifyEmail(m[1]);
      if (c) mailtoEmails.push(c);
    }
    const namedMailto = mailtoEmails.find((e) => !e.generic);
    if (namedMailto) return namedMailto;
    if (mailtoEmails.length) return mailtoEmails[0];

    return extractEmail(html);
  } catch {
    return { email: null, generic: false };
  }
}

/** Try homepage then up to 3 subpages. Stop on first non-generic hit. */
async function findEmailOnWebsite(ownWebsite: string): Promise<{ email: string | null; generic: boolean }> {
  if (!ownWebsite || isDomainBlocked(ownWebsite)) return { email: null, generic: false };
  const base = ownWebsite.replace(/\/+$/, "");

  // Homepage first
  const home = await scrapePageForEmail(base);
  if (home.email && !home.generic) return home;

  // Try 3 subpages only (not 7) to keep per-lead time reasonable
  const subpages = ["/contact", "/about", "/contact-us"];
  let bestGeneric: { email: string; generic: boolean } | null = home.email
    ? home as { email: string; generic: boolean }
    : null;

  for (const path of subpages) {
    const result = await scrapePageForEmail(base + path);
    if (result.email && !result.generic) return result;
    if (result.email && !bestGeneric) bestGeneric = result as { email: string; generic: boolean };
  }

  return bestGeneric ?? { email: null, generic: false };
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
  const domain = ownWebsite && !isDomainBlocked(ownWebsite) ? extractDomain(ownWebsite) : null;

  const queries = [
    // Most likely to surface a real named email in snippet
    domain ? `site:${domain} "@${domain}"` : `"${studioName}" "@" email contact`,
    domain ? `site:${domain} contact` : `"${studioName}" contact press email`,
    // Broader fallback
    `"${studioName}" email studio`,
  ];

  for (const q of queries) {
    const results = await searxSearch(q);
    const text = results.map((r) => `${r.content} ${r.url} ${r.title}`).join(" ");
    const found = extractEmail(text);
    if (found.email && !found.generic) return found; // named email — stop immediately
    if (found.email) {
      // Keep searching for a named one before accepting generic
      const remaining = queries.slice(queries.indexOf(q) + 1);
      for (const q2 of remaining) {
        const r2 = await searxSearch(q2);
        const t2 = r2.map((r) => `${r.content} ${r.url} ${r.title}`).join(" ");
        const f2 = extractEmail(t2);
        if (f2.email && !f2.generic) return f2;
      }
      return found; // best we found is generic
    }
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
  const maxPages = 18; // deeper pool

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
        installCount: g.playerCount,
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
        ...blankEnrichment(),
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
  // Pull both trending and all-time top — SteamSpy, no key required
  const [trendRes, allTimeRes] = await Promise.all([
    fetch("https://steamspy.com/api.php?request=top100in2weeks", { signal: AbortSignal.timeout(15000) }).catch(() => null),
    fetch("https://steamspy.com/api.php?request=top100forever", { signal: AbortSignal.timeout(15000) }).catch(() => null),
  ]);

  type SpyGame = { appid: number; name: string; developer: string; publisher: string; owners: string };
  const mergedById = new Map<number, SpyGame>();
  for (const res of [trendRes, allTimeRes]) {
    if (!res?.ok) continue;
    const data = await res.json() as Record<string, SpyGame>;
    for (const g of Object.values(data)) mergedById.set(g.appid, g);
  }
  if (!mergedById.size) return [];

  const spyData = mergedById;
  const games = [...spyData.values()].slice(0, 200);
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
      ratingsCount: null,
      installCount: null,
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
      ...blankEnrichment(),
      rawData: {
        appId: appid,
        gameName,
        source: "SteamSpy",
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

type ItunesChartType = "topgrossingapplications" | "topfreeapplications";

async function fetchItunesChart(country: string, genreId: string, chartType: ItunesChartType = "topgrossingapplications", limit = 200): Promise<ITunesRSSEntry[]> {
  const url = `https://itunes.apple.com/${country}/rss/${chartType}/limit=${limit}/genre=${genreId}/json`;
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

  // 1. US main charts (grossing + free) — skip ranks 1–skipTopN on grossing
  const [usMainGross, usMainFree] = await Promise.all([
    fetchItunesChart("us", "6014", "topgrossingapplications", 200),
    fetchItunesChart("us", "6014", "topfreeapplications", 200),
  ]);
  for (let i = 0; i < usMainGross.length; i++) {
    const rank = i + 1;
    if (rank <= skipTopN) continue;
    const appId = usMainGross[i].id.attributes["im:id"];
    if (!appIdToMeta.has(appId)) appIdToMeta.set(appId, { rank, country: "US", fromMainUS: true });
  }
  for (let i = 0; i < usMainFree.length; i++) {
    const appId = usMainFree[i].id.attributes["im:id"];
    if (!appIdToMeta.has(appId)) appIdToMeta.set(appId, { rank: null, country: "US", fromMainUS: false });
  }

  // 2. Subcategory charts (grossing + free) across all countries
  await Promise.allSettled(
    countries.flatMap((country) =>
      allowedSubcats.flatMap((subcatId) => [
        fetchItunesChart(country, subcatId, "topgrossingapplications", 200).then((entries) => {
          for (let i = 0; i < entries.length; i++) {
            const appId = entries[i].id.attributes["im:id"];
            if (!appIdToMeta.has(appId)) appIdToMeta.set(appId, { rank: null, country: country.toUpperCase(), fromMainUS: false });
          }
        }),
        fetchItunesChart(country, subcatId, "topfreeapplications", 200).then((entries) => {
          for (let i = 0; i < entries.length; i++) {
            const appId = entries[i].id.attributes["im:id"];
            if (!appIdToMeta.has(appId)) appIdToMeta.set(appId, { rank: null, country: country.toUpperCase(), fromMainUS: false });
          }
        }),
      ])
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
      installCount: null,
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
      ...blankEnrichment(),
      rawData: { appId, fromMainUS: meta.fromMainUS, ...detail },
    });
  }

  return candidates;
}

// Google Play removed at user request — stub returns empty.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function googlePlayTopGames(_rejections: RejectionRecord[]): Promise<Candidate[]> {
  return [];
}

// ─── Named contact finder (SearXNG → LinkedIn pattern) ────────────────────────

async function findNamedContact(studioName: string, domain: string | null): Promise<{
  name: string | null; title: string | null; linkedin: string | null;
}> {
  // LinkedIn page titles are: "Name – Role – Company | LinkedIn"
  const queries = [
    `site:linkedin.com/in "${studioName}" founder OR CEO OR "indie developer"`,
    domain ? `site:linkedin.com "${studioName}" founder` : `"${studioName}" founder CEO "game studio" linkedin`,
    `"${studioName}" founder indie game developer`,
  ];

  const TITLE_ROLES = /(?:founder|co-founder|ceo|chief executive|director|head of|president|owner|studio head|creative director|indie developer)/i;

  for (const q of queries) {
    const results = await searxSearch(q);
    for (const r of results) {
      // LinkedIn title pattern: "First Last - Role - Company | LinkedIn"
      const liTitle = r.title.match(/^([A-Z][a-z]+(?: [A-Z][a-z'-]+){1,3})\s*[-–—|]\s*([^-–—|]+)/);
      if (liTitle && TITLE_ROLES.test(liTitle[2])) {
        const linkedinUrl = r.url.includes("linkedin.com/in/") ? r.url.split("?")[0] : null;
        return {
          name: liTitle[1].trim(),
          title: liTitle[2].trim().slice(0, 80),
          linkedin: linkedinUrl,
        };
      }

      // Fallback: extract from snippet
      const snippetName = (r.content + " " + r.title).match(
        /\b([A-Z][a-z]+ [A-Z][a-z']+)\b[^.]*?\b(?:founder|CEO|co-founder|director|studio head)\b/i
      );
      if (snippetName) {
        const linkedinUrl = r.url.includes("linkedin.com/in/") ? r.url.split("?")[0] : null;
        return {
          name: snippetName[1].trim(),
          title: snippetName[0].match(TITLE_ROLES)?.[0] ?? "Founder",
          linkedin: linkedinUrl,
        };
      }
    }
  }

  return { name: null, title: null, linkedin: null };
}

// ─── Funding signal detector (SearXNG → press coverage) ──────────────────────

async function findFundingSignals(studioName: string, domain: string | null): Promise<{
  backed: boolean; details: string | null; proofUrl: string | null;
}> {
  const queries = [
    `"${studioName}" raised funding million seed "series a" OR "series b" investment`,
    domain ? `site:${domain} investor OR funding OR backed` : `"${studioName}" investor game studio funding`,
  ];

  const AMOUNT_RE = /(?:raised|secured|closed|received|announced)\s+\$?([\d,.]+)\s*(?:million|M|billion|B)\b/i;
  const SIGNAL_RE = /\b(?:seed round|series [abc]|venture capital|VC-backed|investor[s]?|raised \$|funding round|investment round)\b/i;

  for (const q of queries) {
    const results = await searxSearch(q);
    for (const r of results) {
      const text = r.title + " " + r.content;
      const amountMatch = text.match(AMOUNT_RE);
      if (amountMatch) {
        return {
          backed: true,
          details: `Raised $${amountMatch[1]}M`,
          proofUrl: r.url,
        };
      }
      if (SIGNAL_RE.test(text)) {
        return {
          backed: true,
          details: "Investor-backed (press coverage)",
          proofUrl: r.url,
        };
      }
    }
  }

  return { backed: false, details: null, proofUrl: null };
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
    score += Math.floor(sc.real_email_found / 2); parts.push(`generic_email(${Math.floor(sc.real_email_found / 2)})`);
  }

  // Named decision maker
  if (c.decisionMaker) {
    score += sc.named_decision_maker; parts.push(`named_dm(${sc.named_decision_maker})`);
  }

  // Funding signals
  if (c.investorBacked) {
    score += sc.funding_last_12mo; parts.push(`funding(${sc.funding_last_12mo})`);
  }

  // Audience size — prefer install count for Android, else ratings
  const audience = c.installCount ?? c.ratingsCount ?? (c.type === "roblox" ? (c.rawData.playerCount as number ?? 0) : 0);
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
    totalPulled += (cfg.sources.app_store_countries.length * (cfg.sources.app_store_allowed_subcategory_ids.length + 1)) * 400; // grossing + free
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

    // Sort: steam/mobile first (own website = better email hit rate), roblox last
    const typeOrder: Record<string, number> = { steam: 0, mobile: 1, roblox: 2 };
    candidates.sort((a, b) => (typeOrder[a.type] ?? 2) - (typeOrder[b.type] ?? 2));

    let savedCount = 0;
    const toProcess = candidates.slice(0, Math.min(candidates.length, run.count * 8));

    // ── Per-candidate enrichment (run in parallel batches) ────────────────────
    type EnrichedResult = {
      c: Candidate;
      finalScored: ReturnType<typeof scoreCandidate>;
      finalGrade: string;
      moneySignals: string[];
      ownWebsite: string | null;
    } | null;

    async function enrichOne(c: Candidate): Promise<EnrichedResult> {
      const scored = scoreCandidate(c);
      if (scored.grade === "F") return null;

      const ownSite = !isDomainBlocked(c.website) ? c.website : null;

      // ── Email + social handles (one website fetch for both) ──────────────────
      if (!c.contacts.email || (!c.contacts.instagram && !c.contacts.twitter)) {
        if (ownSite) {
          try {
            const res = await fetch(ownSite, {
              headers: { "User-Agent": SCRAPE_UA, Accept: "text/html" },
              signal: AbortSignal.timeout(5000),
            });
            if (res.ok) {
              const html = await res.text();
              // Email from homepage
              if (!c.contacts.email) {
                // mailto: links first
                const mLinks = [...html.matchAll(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi)];
                const mailtoEmails = mLinks.map((m) => classifyEmail(m[1])).filter(Boolean) as Array<{ email: string; generic: boolean }>;
                const bestMailto = mailtoEmails.find((e) => !e.generic) ?? mailtoEmails[0];
                if (bestMailto) {
                  c.contacts.email = bestMailto.email;
                  c.contacts.emailSource = "published";
                  c.contacts.genericInbox = bestMailto.generic;
                } else {
                  const fallback = extractEmail(html);
                  if (fallback.email) {
                    c.contacts.email = fallback.email;
                    c.contacts.emailSource = "published";
                    c.contacts.genericInbox = fallback.generic;
                  }
                }
              }
              // Social handles from homepage
              const h = extractSocialHandles(html);
              if (!c.contacts.instagram) c.contacts.instagram = h.instagram;
              if (!c.contacts.twitter) c.contacts.twitter = h.twitter;
              if (!c.contacts.discord) c.contacts.discord = h.discord;
              if (!c.contacts.linkedin) c.contacts.linkedin = h.linkedin;
            }
          } catch { /* best-effort */ }
        }

        // /contact page if still no email
        if (!c.contacts.email && ownSite) {
          const r = await scrapePageForEmail(ownSite.replace(/\/+$/, "") + "/contact");
          if (r.email) { c.contacts.email = r.email; c.contacts.emailSource = "published"; c.contacts.genericInbox = r.generic; }
        }

        // SearXNG fallback — single fast query only
        if (!c.contacts.email) {
          const domain = ownSite ? extractDomain(ownSite) : null;
          const q = domain ? `site:${domain} email OR contact` : `"${c.name}" contact email game studio`;
          const results = await searxSearch(q);
          const text = results.map((r) => `${r.content} ${r.title} ${r.url}`).join(" ");
          const found = extractEmail(text);
          if (found.email) {
            c.contacts.email = found.email;
            c.contacts.emailSource = "searxng";
            c.contacts.genericInbox = found.generic;
          }
        }
      }

      if (!c.contacts.email) return null; // no email found — skip

      // ── Named contact + funding (parallel, 15s combined deadline) ────────────
      const domainForEnrich = ownSite ? extractDomain(ownSite) : null;
      const ENRICH_TIMEOUT = 15000;
      const timed = <T>(p: Promise<T>, fb: T) =>
        Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fb), ENRICH_TIMEOUT))]);

      const [dmResult, fundingResult] = await Promise.all([
        timed(findNamedContact(c.name, domainForEnrich), { name: null, title: null, linkedin: null }),
        timed(findFundingSignals(c.name, domainForEnrich), { backed: false, details: null, proofUrl: null }),
      ]);

      if (dmResult.name) {
        c.decisionMaker = dmResult.name;
        c.decisionMakerTitle = dmResult.title;
        c.decisionMakerLinkedin = dmResult.linkedin ?? c.contacts.linkedin;
        if (dmResult.linkedin && !c.contacts.linkedin) c.contacts.linkedin = dmResult.linkedin;
      }
      if (fundingResult.backed) {
        c.investorBacked = true;
        c.fundingDetails = fundingResult.details;
        c.fundingProofUrl = fundingResult.proofUrl;
      }

      const finalScored = scoreCandidate(c);
      const moneySignals: string[] = [];
      if (c.chartRank !== null) moneySignals.push(`App Store chart rank ${c.chartRank}`);
      if (c.installCount !== null && c.installCount > 0) moneySignals.push(`${c.installCount.toLocaleString()}+ installs`);
      if (c.earnsRealMoney) moneySignals.push("Paid / real-money gameplay");
      if (c.investorBacked) moneySignals.push(c.fundingDetails ?? "Investor-backed");

      let finalGrade = finalScored.grade;
      if (finalGrade === "A" && (!moneySignals.length || !c.decisionMaker || c.contacts.genericInbox)) {
        finalGrade = "B";
      }

      return { c, finalScored, finalGrade, moneySignals, ownWebsite: ownSite };
    }

    // Process in parallel batches of 8
    const ENRICH_BATCH = 8;
    for (let i = 0; i < toProcess.length && savedCount < run.count; i += ENRICH_BATCH) {
      if (await isStopped(runId)) return;

      const batch = toProcess.slice(i, Math.min(i + ENRICH_BATCH, toProcess.length));
      const results = await Promise.allSettled(batch.map((c) => enrichOne(c)));

      for (const r of results) {
        if (savedCount >= run.count) break;
        if (r.status !== "fulfilled" || !r.value) {
          if (r.status === "fulfilled" && !r.value) {
            // enrichOne returned null — candidate had no email or was grade F
            const idx = results.indexOf(r);
            if (idx >= 0) rejections.push({ name: batch[idx]?.name ?? "?", reason: "No email found or grade F", source: batch[idx]?.type ?? "?" });
          }
          continue;
        }

        const { c, finalScored, finalGrade, moneySignals, ownWebsite } = r.value;
        savedCount++;

        const signals = {
          activityVerified: finalScored.activityVerified,
          genrePasses: finalScored.genrePasses,
          notBlocklisted: true,
          hasFunding: c.investorBacked,
          hasOtherMoneySignal: moneySignals.length > 0,
          namedDecisionMaker: !!c.decisionMaker,
          publishedEmail: c.contacts.emailSource === "published",
          audienceSize: (c.ratingsCount ?? c.installCount ?? 0) >= 50000 ? "large" : (c.ratingsCount ?? c.installCount ?? 0) >= 5000 ? "medium" : "small",
          country: c.country,
          realMoneyGameplay: c.earnsRealMoney,
          breakdown: finalScored.breakdown,
          total: finalScored.score,
        };

        const segmentLabel = c.type === "roblox" ? "Roblox Studio" : c.type === "steam" ? "PC/Steam Developer" : "Mobile Developer";

        await prisma.leadFactoryLead.create({
          data: {
            runId,
            num: savedCount,
            company:         c.name.slice(0, 100),
            website:         ownWebsite ?? c.storeLink,
            whatItIs:        c.description.replace(/\n/g, " ").slice(0, 250),
            segment:         segmentLabel,
            grade:           finalGrade,
            score:           finalScored.score,
            country:         c.country,
            decisionMaker:   c.decisionMaker,
            dmRole:          c.decisionMakerTitle,
            dmEmail:         c.contacts.email,
            instagramHandle: c.contacts.instagram,
            xHandle:         c.contacts.twitter,
            linkedinUrl:     c.decisionMakerLinkedin ?? c.contacts.linkedin,
            bestChannel:     c.contacts.email ? (c.contacts.genericInbox ? "generic-inbox" : "email") : "direct",
            whyItFits:       Prisma.JsonNull,
            signals:         signals as unknown as Prisma.InputJsonValue,
            rawData: {
              source:            c.type,
              gameName:          c.gameName,
              storeLink:         c.storeLink,
              genre:             c.genre,
              chartRank:         c.chartRank,
              ratingsCount:      c.ratingsCount,
              installCount:      c.installCount,
              lastUpdateDate:    c.lastUpdateDate,
              updateProofUrl:    c.updateProofUrl,
              country:           c.country,
              earnsRealMoney:    c.earnsRealMoney,
              employees:         null,
              employeesVerified: false,
              investorBacked:    c.investorBacked,
              latestFunding:     c.fundingDetails,
              fundingProof:      c.fundingProofUrl,
              moneySignals,
              moneySignalProof:  c.fundingProofUrl ?? c.updateProofUrl,
              emailSource:       c.contacts.emailSource,
              genericInbox:      c.contacts.genericInbox,
              discord:           c.contacts.discord,
              contactLinkedin:   c.decisionMakerLinkedin,
              ownWebsite,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        await prisma.leadRun.update({
          where: { id: runId },
          data: {
            stage: `Saved ${savedCount} / ${run.count} leads`,
            stats: { pulled: preFilterCount, filtered: preFilterCount - candidates.length, saved: savedCount, rejectedTotal: rejections.length },
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
