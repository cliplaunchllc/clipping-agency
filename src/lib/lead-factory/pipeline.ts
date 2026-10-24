/**
 * Lead Factory Pipeline — chart/rank-based discovery, zero keyword searches
 *
 * Sources:
 *   - Roblox Games API    → top games with 1,000+ live concurrent players
 *   - Steam Store API     → top sellers + new releases (last 24 months)
 *   - Apple App Store     → top-grossing Games chart, ranks 50–200
 *
 * Contact enrichment (not discovery):
 *   - SearXNG             → email / social lookup per passing lead
 *
 * No keyword app-store searches. No GitHub. No YouTube keyword search.
 * Planning + scoring: rule-based — no AI, no API key, no account needed.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function setStatus(runId: string, status: string, stage?: string) {
  await prisma.leadRun.update({ where: { id: runId }, data: { status, ...(stage !== undefined ? { stage } : {}) } });
}

async function setStage(runId: string, stage: string) {
  await prisma.leadRun.update({ where: { id: runId }, data: { stage } });
}

async function log(runId: string, stage: string, message: string, level: "info" | "warn" | "error" = "info") {
  await prisma.leadRunLog.create({ data: { runId, stage, message, level } }).catch(() => {});
}

async function trackCost(runId: string, provider: string, op: string, units: number, cost: number) {
  await prisma.leadRunCost.create({ data: { runId, provider, operation: op, units, cost } }).catch(() => {});
  await prisma.leadRun.update({
    where: { id: runId },
    data: { totalCost: { increment: cost } },
  }).catch(() => {});
}

async function isStopped(runId: string): Promise<boolean> {
  const r = await prisma.leadRun.findUnique({ where: { id: runId }, select: { status: true } });
  return r?.status === "stopped";
}

// ─── Zero-dependency planning — no AI needed ─────────────────────────────────
// Extracts keywords from the user prompt and mixes them with a pre-built query
// bank to generate diverse search queries across all sources.

const STOP_WORDS = new Set([
  "the","and","for","that","with","have","this","from","they","will","been",
  "are","but","not","you","all","can","was","one","our","out","get","has",
  "how","its","may","now","she","too","use","who","your","more","also","into",
  "than","then","when","some","such","only","over","just","like","after","about",
  "very","well","back","even","much","most","make","long","time","look","come",
  "take","know","give","want","keep","find","tell","feel","turn","hand","place",
  "game","games","studio","developer","company","want","need","find","looking",
  "short","form","video","clip","clips","every","must","include","return","each",
]);

function extractKeywords(prompt: string, max = 6): string[] {
  return prompt.toLowerCase()
    .split(/[\s,;.!?()\[\]{}"']+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
    .filter((w, i, a) => a.indexOf(w) === i) // deduplicate
    .slice(0, max);
}

// Discovery is chart/rank-based — no keyword queries needed.
// This function only derives segment labels used during scoring.
function generatePlan(prompt: string, _count: number): Plan {
  const kw = extractKeywords(prompt);
  const segments = [
    kw.some((k) => ["roblox", "rbx"].includes(k)) ? "Roblox Studio" : "Roblox Developer",
    kw.some((k) => ["steam", "pc"].includes(k))    ? "PC Game Studio" : "Indie Game Studio",
    kw.some((k) => ["mobile", "ios", "android"].includes(k)) ? "Mobile Game Publisher" : "Mobile Game Developer",
    "Online PvP Studio",
  ];
  return {
    segments,
    sources: ["Roblox Top CCU", "Steam Featured", "App Store Top Grossing"],
  };
}

// ─── Size filter — always-on, blocks mega-companies and AAA studios ───────────
// These leads are unreachable for a small clipping agency. Filtered out before
// scoring so they never waste quota.

const MEGA_COMPANY_NAMES = [
  // Major publishers / parent companies
  "nintendo", "hasbro", "activision", "electronic arts", "ea sports", "ea games",
  "ubisoft", "blizzard", "blizzard entertainment", "valve corporation", "riot games",
  "epic games", "take-two interactive", "2k games", "2k sports", "bethesda",
  "bethesda softworks", "rockstar games", "rockstar north", "sony interactive",
  "sony computer entertainment", "microsoft game studios", "xbox game studios",
  "square enix", "capcom", "bandai namco", "sega", "konami", "naughty dog",
  "bungie", "insomniac games", "treyarch", "infinity ward", "respawn entertainment",
  "dice", "bioware", "obsidian entertainment", "double fine", "cd projekt",
  "cd projekt red", "techland", "paradox interactive", "505 games",
  "deep silver", "thq nordic", "warhorse studios", "giants software",
  // Mega mobile
  "supercell", "king digital", "zynga", "netmarble", "nexon", "ncsoft",
  "mihoyo", "hoyoverse", "cognosphere", "tencent games", "netease games",
  "gameloft", "jam city", "scopely", "playtika",
  // Mega Roblox games (the studios behind them are corporations)
  "adopt me", "blox fruits", "brookhaven", "arsenal roblox",
  // Famous titles that are mega-brands (not the indie dev we want)
  "counter-strike", "counter strike", "call of duty", "world of warcraft",
  "fortnite", "league of legends", "valorant", "apex legends",
  "overwatch", "hearthstone", "diablo", "genshin impact", "honkai",
  "pokemon", "zelda", "mario", "halo", "fifa", "madden", "nba 2k",
  // Media conglomerates that make games as a side business
  "disney interactive", "warner bros. games", "wb games",
  "universal games", "lego games", "dreamworks",
];

// Upper size limits for non-Roblox sources.
// Roblox studios are allowed at any size — large Roblox devs are still
// reachable and actively look for content partnerships.
const SIZE_CEILING = {
  youtubeSubs: 5_000_000, // 5M+ = media company, not a creator looking for help
};

// ─── Activity filter — always-on, removes dead/abandoned projects ─────────────
// Every lead must show signs of active development or live users.

const ACTIVE_WINDOW_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months

function isInactive(c: Candidate): boolean {
  if (c.type === "mobile") {
    // Chart-sourced apps are active by definition (on the grossing chart right now).
    // Only apply the staleness check for any non-chart app that might slip through.
    const raw = c.rawData as { currentVersionReleaseDate?: string; releaseDate?: string; chartRank?: number };
    if (!raw.chartRank) {
      const dateStr = raw.currentVersionReleaseDate ?? raw.releaseDate;
      if (dateStr) {
        const updated = new Date(dateStr);
        if (!isNaN(updated.getTime()) && Date.now() - updated.getTime() > ACTIVE_WINDOW_MS) return true;
      }
    }
  }

  if (c.type === "roblox") {
    // Both CCU and upvotes at essentially zero = abandoned game
    const raw = c.rawData as { playerCount?: number; totalUpVotes?: number };
    const ccu   = raw.playerCount  ?? 0;
    const votes = raw.totalUpVotes ?? 0;
    if (ccu === 0 && votes < 50) return true;
  }

  if (c.type === "steam") {
    // coming_soon: true = unreleased, no active player base yet
    const raw = c.rawData as { coming_soon?: boolean };
    if (raw.coming_soon === true) return true;
  }

  if (c.type === "web") {
    // GitHub org profiles expose pushed_at — skip orgs dormant for 2+ years
    const raw = c.rawData as { pushed_at?: string; updated_at?: string };
    const dateStr = raw.pushed_at ?? raw.updated_at;
    if (dateStr) {
      const pushed = new Date(dateStr);
      if (!isNaN(pushed.getTime()) && Date.now() - pushed.getTime() > ACTIVE_WINDOW_MS) return true;
    }
  }

  return false;
}

function isTooLarge(c: Candidate): boolean {
  const name = c.name.toLowerCase();
  const desc = c.description.toLowerCase().slice(0, 200);

  // Blocklist match on name
  if (MEGA_COMPANY_NAMES.some((n) => name === n || name.includes(n))) return true;

  // Blocklist match in description (only first 200 chars — company self-description)
  if (MEGA_COMPANY_NAMES.some((n) => n.length > 6 && desc.includes(n))) return true;

  // YouTube ceiling only — Roblox has no size cap
  if (c.type === "youtube") {
    const raw = c.rawData as { subCount?: number };
    if ((raw.subCount ?? 0) > SIZE_CEILING.youtubeSubs) return true;
  }

  return false;
}

// ─── Criteria parsing — translates free-text requirements into scoring signals ──
// Handles phrases like "active downloads", "VC backed", "must have instagram", etc.

interface CriteriaSignals {
  // Per-type score boosts (additive)
  boostMobile:  number;
  boostYoutube: number;
  boostRoblox:  number;
  boostSteam:   number;
  boostWeb:     number;
  // Contact boosts
  bonusEmail:     number;
  bonusLinkedin:  number;
  bonusSocial:    number;   // instagram or twitter
  bonusDiscord:   number;
  // Engagement amplifier — multiplies existing CCU/sub bonuses
  engagementMult: number;
  // Hard filters — candidates that fail are skipped
  requireEmail:    boolean;
  requireSocial:   boolean;
  requireLinkedin: boolean;
  requireRealSite: boolean; // must have own domain, not just a platform URL
  // Tighter YouTube ceiling when user asks for small/indie
  youtubeSubsCeiling: number;
}

const PLATFORM_DOMAINS = ["roblox.com", "youtube.com", "twitter.com", "instagram.com", "linkedin.com", "apple.com", "steampowered.com"];

function parseCriteria(text: string): CriteriaSignals {
  const t = text.toLowerCase();
  const s: CriteriaSignals = {
    boostMobile: 0, boostYoutube: 0, boostRoblox: 0, boostSteam: 0, boostWeb: 0,
    bonusEmail: 0, bonusLinkedin: 0, bonusSocial: 0, bonusDiscord: 0,
    engagementMult: 1,
    requireEmail: false, requireSocial: false, requireLinkedin: false, requireRealSite: false,
    youtubeSubsCeiling: SIZE_CEILING.youtubeSubs,
  };

  // ── Size constraints — tighten ceilings when user explicitly wants small/indie ──
  if (/indie|small.{0,15}(company|studio|dev|team)|not.{0,15}(big|large|huge|massive)|no.{0,15}(big|large|huge|corporate)|avoid.{0,15}(big|large|corporate)|accessible|micro studio|solo dev/.test(t)) {
    s.youtubeSubsCeiling = Math.min(s.youtubeSubsCeiling, 500_000); // under 500k subs
  }

  // ── Downloads / active installs ──
  if (/download|install|app store|play store|active app/.test(t)) {
    s.boostMobile  += 25;
    s.boostSteam   += 10;
    s.engagementMult = Math.max(s.engagementMult, 1.4);
  }

  // ── VC / funded / capital / investors ──
  if (/\bvc\b|venture capital|vc[- ]backed|backed by|funded|investor|investment|capital|series [abcde]|seed round|raised/.test(t)) {
    s.boostWeb      += 20;
    s.bonusLinkedin += 20; // funded companies almost always have LinkedIn
    s.requireRealSite = true; // funded companies have their own domain
  }

  // ── Active player base / high engagement ──
  if (/active player|active user|concurrent|daily active|high engagement|popular|trending|viral|large audience/.test(t)) {
    s.engagementMult = Math.max(s.engagementMult, 1.5);
    s.boostRoblox  += 10;
    s.boostYoutube += 10;
  }

  // ── Subscriber/view thresholds ──
  if (/subscriber|view|audience|creator|youtuber/.test(t)) {
    s.boostYoutube += 20;
  }

  // ── Platform-specific boosts ──
  if (/\broblox\b/.test(t))                          s.boostRoblox  += 25;
  if (/\byoutube\b|youtuber/.test(t))                s.boostYoutube += 20;
  if (/\bsteam\b|pc game|indie game/.test(t))        s.boostSteam   += 20;
  if (/\bmobile\b|ios|android|phone/.test(t))        s.boostMobile  += 20;
  if (/startup|company|studio|agency|brand/.test(t)) s.boostWeb     += 10;

  // ── Contact requirements ──
  if (/must have email|require email|need.{0,8}email|has.{0,8}email|with email/.test(t)) {
    s.requireEmail = true;
    s.bonusEmail   = 20;
  }
  if (/instagram|social media|social presence|social following/.test(t)) {
    s.bonusSocial += 15;
    if (/must have instagram|require instagram|need.{0,8}instagram/.test(t)) s.requireSocial = true;
  }
  if (/linkedin|professional|b2b|decision maker|decision-maker/.test(t)) {
    s.bonusLinkedin += 15;
    if (/must have linkedin|require linkedin/.test(t)) s.requireLinkedin = true;
  }
  if (/discord|community/.test(t)) {
    s.bonusDiscord += 10;
  }

  // ── Real website (not just a platform profile) ──
  if (/real website|own website|company website|their own site|website/.test(t)) {
    s.requireRealSite = true;
  }

  return s;
}

function meetsHardCriteria(c: Candidate, signals: CriteriaSignals): boolean {
  if (signals.requireEmail    && !c.contacts.email)     return false;
  if (signals.requireSocial   && !c.contacts.instagram && !c.contacts.twitter) return false;
  if (signals.requireLinkedin && !c.contacts.linkedin)  return false;
  if (signals.requireRealSite && PLATFORM_DOMAINS.some((d) => c.website.includes(d))) return false;

  // Criteria-specific YouTube ceiling (tighter when user asks for small/indie)
  if (c.type === "youtube") {
    const raw = c.rawData as { subCount?: number };
    if ((raw.subCount ?? 0) > signals.youtubeSubsCeiling) return false;
  }

  return true;
}

// ─── Zero-dependency scoring — no AI needed ───────────────────────────────────
// Scores candidates using platform signals: CCU, review count, subscribers, etc.

type Analysis = {
  company: string; website: string; whatItIs: string; segment: string;
  decisionMaker: string | null; dmRole: string | null; dmEmail: string | null;
  instagramHandle: string | null; xHandle: string | null;
  linkedinUrl: string | null; discordUrl: string | null;
  grade: string; score: number; whyItFits: string; bestChannel: string;
};

function scoreCandidate(c: Candidate, segments: string[], signals?: CriteriaSignals): Analysis {
  let score = 40;

  // Contact signals
  if (c.contacts.email)     score += 15;
  if (c.contacts.instagram) score += 5;
  if (c.contacts.twitter)   score += 3;
  if (c.contacts.linkedin)  score += 7;

  // Source-specific quality signals
  if (c.type === "roblox") {
    const raw = c.rawData as { playerCount?: number; totalUpVotes?: number };
    const ccu   = (raw.playerCount  ?? 0) as number;
    const votes = (raw.totalUpVotes ?? 0) as number;
    const engMult = signals?.engagementMult ?? 1;
    score += Math.round((ccu > 10000 ? 25 : ccu > 1000 ? 18 : ccu > 100 ? 10 : ccu > 10 ? 5 : 0) * engMult);
    score += votes > 100000 ? 10 : votes > 10000 ? 6 : votes > 1000 ? 3 : 0;
  } else if (c.type === "steam") {
    score += 20; // Steam support email present = qualified lead
  } else if (c.type === "mobile") {
    score += 15;
    if (c.description.length > 150) score += 5; // rich description = active app
  } else if (c.type === "youtube") {
    const raw  = c.rawData as { subCount?: number };
    const subs = (raw.subCount ?? 0) as number;
    const engMult = signals?.engagementMult ?? 1;
    score += Math.round((subs > 1000000 ? 25 : subs > 100000 ? 20 : subs > 10000 ? 12 : subs > 1000 ? 6 : 0) * engMult);
  } else if (c.type === "web") {
    score += 10;
    const raw = c.rawData as { followers?: number };
    if (raw.followers) score += Math.min(10, Math.floor(raw.followers / 100));
  }

  // ── Criteria-driven boosts ────────────────────────────────────────────────
  if (signals) {
    if (c.type === "mobile")  score += signals.boostMobile;
    if (c.type === "youtube") score += signals.boostYoutube;
    if (c.type === "roblox")  score += signals.boostRoblox;
    if (c.type === "steam")   score += signals.boostSteam;
    if (c.type === "web")     score += signals.boostWeb;

    if (c.contacts.email)    score += signals.bonusEmail;
    if (c.contacts.linkedin) score += signals.bonusLinkedin;
    if (c.contacts.instagram || c.contacts.twitter) score += signals.bonusSocial;
    if (c.contacts.discord)  score += signals.bonusDiscord;

    // Penalise platform-only profiles when a real website is required
    if (signals.requireRealSite && PLATFORM_DOMAINS.some((d) => c.website.includes(d))) {
      score -= 30;
    }
  }

  score = Math.min(100, Math.max(0, score));
  const grade = score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";

  const segmentMap: Record<string, string> = {
    roblox: segments.find((s) => s.toLowerCase().includes("roblox")) ?? "Roblox Developer",
    steam:  segments.find((s) => s.toLowerCase().includes("pc") || s.toLowerCase().includes("indie")) ?? "Indie Game Studio",
    mobile: segments.find((s) => s.toLowerCase().includes("mobile")) ?? "Mobile Game Developer",
    youtube: segments.find((s) => s.toLowerCase().includes("creator") || s.toLowerCase().includes("content")) ?? "Gaming Creator",
    web:    segments.find((s) => s.toLowerCase().includes("studio")) ?? "Game Studio",
  };

  const bestChannel = c.contacts.email ? "email"
    : c.contacts.instagram ? "instagram"
    : c.contacts.discord   ? "discord"
    : c.contacts.twitter   ? "direct"
    : "direct";

  return {
    company:         c.name.trim().slice(0, 100),
    website:         c.website,
    whatItIs:        c.description.replace(/\n/g, " ").slice(0, 140) || `${segmentMap[c.type]} creating games`,
    segment:         segmentMap[c.type] ?? segments[0] ?? "Game Developer",
    decisionMaker:   null,
    dmRole:          null,
    dmEmail:         c.contacts.email,
    instagramHandle: c.contacts.instagram,
    xHandle:         c.contacts.twitter,
    linkedinUrl:     c.contacts.linkedin,
    discordUrl:      c.contacts.discord,
    grade,
    score,
    whyItFits:       `${segmentMap[c.type] ?? "Game developer"} that can grow their player base with short-form video clips`,
    bestChannel,
  };
}

// ─── Contact extraction ───────────────────────────────────────────────────────

interface Contacts {
  email: string | null;
  instagram: string | null;
  twitter: string | null;
  linkedin: string | null;
  discord: string | null;
}

function extractContacts(text: string): Contacts {
  if (!text) return { email: null, instagram: null, twitter: null, linkedin: null, discord: null };

  const emailMatch   = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const igMatch      = text.match(/(?:instagram\.com\/|instagram[:\s]+@?|ig[:\s]+@?)([a-zA-Z0-9_.]{2,30})/i);
  const twMatch      = text.match(/(?:twitter\.com\/|x\.com\/|twitter[:\s]+@?|x[:\s]+@?)([a-zA-Z0-9_]{2,30})/i);
  const liMatch      = text.match(/linkedin\.com\/(?:in|company)\/([a-zA-Z0-9_%\-]+)/i);
  const discordMatch = text.match(/(?:discord\.gg\/|discord[:\s]+)([a-zA-Z0-9_\-]+)/i);

  return {
    email:     emailMatch   ? emailMatch[0]                                   : null,
    instagram: igMatch      ? `@${igMatch[1]}`                                : null,
    twitter:   twMatch      ? `@${twMatch[1]}`                                : null,
    linkedin:  liMatch      ? `https://linkedin.com/in/${liMatch[1]}`         : null,
    discord:   discordMatch ? `https://discord.gg/${discordMatch[1]}`         : null,
  };
}

// ─── Candidate type ───────────────────────────────────────────────────────────

interface Candidate {
  type: "youtube" | "web" | "roblox" | "steam" | "mobile";
  name: string;
  website: string;
  description: string;
  contacts: Contacts;
  rawData: Record<string, unknown>;
}

const emptyContacts = (): Contacts => ({ email: null, instagram: null, twitter: null, linkedin: null, discord: null });

function mergeContacts(a: Contacts, b: Contacts): Contacts {
  return {
    email:     a.email     ?? b.email,
    instagram: a.instagram ?? b.instagram,
    twitter:   a.twitter   ?? b.twitter,
    linkedin:  a.linkedin  ?? b.linkedin,
    discord:   a.discord   ?? b.discord,
  };
}

function hasContacts(c: Contacts): boolean {
  return !!(c.email || c.instagram || c.twitter || c.linkedin);
}

// ─── Roblox (FREE — no key required) ─────────────────────────────────────────

interface RobloxGame {
  creatorId: number;
  creatorName: string;
  creatorType: string;
  name: string;
  placeId: number;
  playerCount: number;
  totalUpVotes: number;
}

async function robloxFetchUserDescription(userId: number): Promise<string> {
  const res = await fetch(`https://users.roblox.com/v1/users/${userId}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  if (!res?.ok) return "";
  const data = await res.json() as { description?: string };
  return data.description ?? "";
}

async function robloxFetchGroupDescription(groupId: number): Promise<string> {
  const res = await fetch(`https://groups.roblox.com/v1/groups/${groupId}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  if (!res?.ok) return "";
  const data = await res.json() as { description?: string };
  return data.description ?? "";
}

// ─── Roblox top games by live players (no keyword) ────────────────────────────
// Pages through Roblox's popular games list and keeps only games with
// minCCU+ concurrent players. This is the "Rolimons / top CCU" equivalent.

async function robloxTopGames(minCCU = 1000, take = 150): Promise<Candidate[]> {
  const seenCreators = new Map<number, RobloxGame>();
  let cursor = "";
  let pages = 0;

  while (seenCreators.size < take && pages < 6) {
    const url = `https://games.roblox.com/v1/games/list?model.gameFilter=0&model.genreFilter=all&model.maxRows=100${cursor ? `&model.cursor=${encodeURIComponent(cursor)}` : ""}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    }).catch(() => null);
    if (!res?.ok) break;

    const data = await res.json() as { games?: RobloxGame[]; nextPageCursor?: string };
    const games = data.games ?? [];

    for (const g of games) {
      if (g.playerCount >= minCCU && !seenCreators.has(g.creatorId)) {
        seenCreators.set(g.creatorId, g);
      }
    }

    cursor = data.nextPageCursor ?? "";
    pages++;
    // Games list is roughly sorted by popularity; once CCU drops below threshold stop early
    if (games.length > 0 && games[games.length - 1].playerCount < minCCU * 0.5) break;
    if (!cursor) break;
  }

  const entries = [...seenCreators.entries()].slice(0, take);
  const profileResults = await Promise.allSettled(
    entries.map(async ([creatorId, g]) => {
      const desc = g.creatorType === "Group"
        ? await robloxFetchGroupDescription(creatorId)
        : await robloxFetchUserDescription(creatorId);
      return { creatorId, g, desc };
    })
  );

  const candidates: Candidate[] = [];
  for (const r of profileResults) {
    if (r.status !== "fulfilled") continue;
    const { creatorId, g, desc } = r.value;
    const profileUrl = g.creatorType === "Group"
      ? `https://www.roblox.com/groups/${creatorId}`
      : `https://www.roblox.com/users/${creatorId}/profile`;
    candidates.push({
      type: "roblox",
      name: g.creatorName,
      website: profileUrl,
      description: `Roblox ${g.creatorType === "Group" ? "studio" : "developer"}. Game: "${g.name}" · ${g.playerCount} concurrent players · ${g.totalUpVotes} upvotes.${desc ? ` Bio: ${desc.slice(0, 200)}` : ""}`,
      contacts: extractContacts(desc),
      rawData: { ...g, profileDesc: desc } as unknown as Record<string, unknown>,
    });
  }
  return candidates;
}

// ─── Steam featured: top sellers + new releases (no keyword) ─────────────────
// Pulls Steam's official top_sellers and new_releases lists, filters to
// games released within maxAgeMonths. Skips coming_soon titles.

async function steamFeaturedGames(maxAgeMonths = 24): Promise<Candidate[]> {
  const res = await fetch("https://store.steampowered.com/api/getfeaturedcategories?cc=us&l=en", {
    signal: AbortSignal.timeout(12000),
  }).catch(() => null);
  if (!res?.ok) return [];

  const data = await res.json() as {
    top_sellers?:  { items?: Array<{ id: number; name: string }> };
    new_releases?: { items?: Array<{ id: number; name: string }> };
    coming_soon?:  { items?: Array<{ id: number; name: string }> };
  };

  const seen = new Set<number>();
  const queue: Array<{ id: number; name: string; source: string }> = [];
  for (const g of data.top_sellers?.items  ?? []) { if (!seen.has(g.id)) { seen.add(g.id); queue.push({ ...g, source: "Top Seller" }); } }
  for (const g of data.new_releases?.items ?? []) { if (!seen.has(g.id)) { seen.add(g.id); queue.push({ ...g, source: "New Release" }); } }
  for (const g of data.coming_soon?.items  ?? []) { if (!seen.has(g.id)) { seen.add(g.id); queue.push({ ...g, source: "Upcoming" }); } }

  const cutoff = new Date(Date.now() - maxAgeMonths * 30 * 24 * 60 * 60 * 1000);
  const candidates: Candidate[] = [];
  const seenDevs = new Set<string>();

  await Promise.allSettled(queue.map(async (game) => {
    const detUrl = `https://store.steampowered.com/api/appdetails?appids=${game.id}&filters=basic,developers,publishers,support_info,website,release_date`;
    const detRes = await fetch(detUrl, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!detRes?.ok) return;

    const detData = await detRes.json() as Record<string, {
      success: boolean;
      data?: {
        developers?: string[];
        publishers?: string[];
        short_description?: string;
        website?: string;
        support_info?: { url?: string; email?: string };
        release_date?: { coming_soon: boolean; date: string };
      };
    }>;
    const app = detData[String(game.id)];
    if (!app?.success || !app.data) return;

    // For top sellers, enforce the age window; new releases and upcoming are already recent
    if (game.source === "Top Seller" && app.data.release_date?.date) {
      const rel = new Date(app.data.release_date.date);
      if (!isNaN(rel.getTime()) && rel < cutoff) return;
    }

    const devName = app.data.developers?.[0] ?? app.data.publishers?.[0];
    if (!devName) return;
    const key = devName.toLowerCase().trim();
    if (seenDevs.has(key)) return;
    seenDevs.add(key);

    candidates.push({
      type: "steam",
      name: devName,
      website: app.data.website ?? `https://store.steampowered.com/app/${game.id}`,
      description: `Steam developer (${game.source}). Game: "${game.name}". ${app.data.short_description?.slice(0, 250) ?? ""}`.trim(),
      contacts: { email: app.data.support_info?.email ?? null, instagram: null, twitter: null, linkedin: null, discord: null },
      rawData: { appId: game.id, gameName: game.name, coming_soon: app.data.release_date?.coming_soon ?? false, source: game.source, ...app.data },
    });
  }));

  return candidates;
}

// ─── App Store top-grossing chart (ranks 50–200, no keyword) ─────────────────
// Uses Apple's RSS feed for top-grossing Games, skips ranks 1–49 (too large),
// then batch-looks up full metadata via the iTunes Lookup API.

async function appStoreChartSearch(rankStart = 50, rankEnd = 200): Promise<Candidate[]> {
  const limit = Math.min(rankEnd, 200);
  const rssUrl = `https://rss.applemarketingtools.com/api/v2/us/apps/top-grossing/${limit}/games.json`;
  const rssRes = await fetch(rssUrl, { signal: AbortSignal.timeout(12000) }).catch(() => null);
  if (!rssRes?.ok) return [];

  const rssData = await rssRes.json() as {
    feed?: { results?: Array<{ id: string; name: string; artistName: string; url: string }> };
  };
  const chartItems = (rssData.feed?.results ?? []).slice(rankStart - 1);
  if (!chartItems.length) return [];

  // Batch iTunes lookup for full metadata (description, sellerUrl, update date)
  const ids = chartItems.map((r) => r.id).join(",");
  const lookupRes = await fetch(`https://itunes.apple.com/lookup?id=${ids}&country=us`, {
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);

  const detailMap = new Map<string, Record<string, unknown>>();
  if (lookupRes?.ok) {
    const lookupData = await lookupRes.json() as { results?: Array<Record<string, unknown>> };
    for (const d of lookupData.results ?? []) {
      if (d.trackId) detailMap.set(String(d.trackId), d);
    }
  }

  const candidates: Candidate[] = [];
  const seenDevs = new Set<string>();

  chartItems.forEach((r, idx) => {
    const detail = detailMap.get(r.id) ?? {};
    const devName = String(detail.sellerName ?? r.artistName);
    const key = devName.toLowerCase().trim();
    if (!key || seenDevs.has(key)) return;
    seenDevs.add(key);

    const rank = rankStart + idx;
    const descText = String(detail.description ?? "");

    candidates.push({
      type: "mobile",
      name: devName,
      website: String(detail.sellerUrl ?? r.url),
      description: `Mobile game studio (App Store Top Grossing #${rank}). Game: "${r.name}".${descText ? ` ${descText.slice(0, 200)}` : ""}`,
      contacts: extractContacts(descText),
      rawData: { ...r, ...detail, chartRank: rank, chartType: "top-grossing" },
    });
  });

  return candidates;
}

// ─── SearXNG (free, open-source meta-search — no key, no account) ────────────
// Aggregates Google + Bing + DuckDuckGo. Falls through public instances.

const SEARX_INSTANCES = [
  "https://searx.be",
  "https://search.inetol.net",
  "https://searxng.site",
  "https://opnxng.com",
  "https://search.bus-hit.me",
];

interface WebResult { title: string; link: string; snippet: string }

async function braveSearch(query: string): Promise<WebResult[]> {
  for (const base of SEARX_INSTANCES) {
    try {
      const url = `${base}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=en`;
      const res = await fetch(url, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json() as { results?: Array<{ title: string; url: string; content?: string }> };
      const results = data.results ?? [];
      if (!results.length) continue;
      return results.slice(0, 10).map((r) => ({ title: r.title, link: r.url, snippet: r.content ?? "" }));
    } catch { /* try next instance */ }
  }
  return [];
}

// Pull contact info out of Brave results for a specific lead
async function serperContactEnrich(name: string, website: string): Promise<{ contacts: Contacts; snippets: string }> {
  const query = `"${name}" instagram OR linkedin OR email OR twitter contact`;
  const results = await braveSearch(query);
  const combined = results.map((r) => `${r.title} ${r.snippet} ${r.link}`).join(" ");
  const contacts = extractContacts(combined);

  for (const r of results) {
    if (!contacts.instagram && r.link.includes("instagram.com/")) {
      const m = r.link.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
      if (m) contacts.instagram = `@${m[1]}`;
    }
    if (!contacts.linkedin && r.link.includes("linkedin.com/")) {
      const m = r.link.match(/linkedin\.com\/(?:in|company)\/([a-zA-Z0-9_%\-]+)/);
      if (m) contacts.linkedin = `https://linkedin.com/in/${m[1]}`;
    }
  }

  void website;
  return { contacts, snippets: combined.slice(0, 600) };
}

// Dedicated email search using Brave — two targeted queries
async function serperEmailSearch(name: string, website: string): Promise<string | null> {
  const r1 = await braveSearch(`"${name}" email contact`);
  const text1 = r1.map((r) => `${r.title} ${r.snippet} ${r.link}`).join(" ");
  const m1 = text1.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (m1) return m1[0];

  try {
    const domain = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
    const r2 = await braveSearch(`site:${domain} email OR contact`);
    const text2 = r2.map((r) => `${r.title} ${r.snippet} ${r.link}`).join(" ");
    const m2 = text2.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (m2) return m2[0];
  } catch { /* invalid URL */ }

  return null;
}

// Last-resort: derive a likely contact email from the website domain
function inferEmailFromDomain(website: string): string | null {
  try {
    const domain = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
    // Skip platform URLs — these aren't the company's own domain
    const platformDomains = ["roblox.com", "steampowered.com", "store.steampowered.com", "apple.com", "youtube.com", "twitter.com", "instagram.com", "linkedin.com"];
    if (platformDomains.some((p) => domain.endsWith(p))) return null;
    if (!domain.includes(".") || domain.split(".").length < 2) return null;
    return `contact@${domain}`;
  } catch {
    return null;
  }
}

// ─── Plan type ────────────────────────────────────────────────────────────────

interface Plan {
  segments: string[];
  sources: string[];
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function processLeadRun(runId: string): Promise<void> {
  const run = await prisma.leadRun.findUnique({ where: { id: runId } });
  if (!run) return;

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 1: PLANNING (rule-based — no AI, no key required)
    // ──────────────────────────────────────────────────────────────────────────
    await setStatus(runId, "planning", "Building search strategy…");
    await log(runId, "planning", `Run started: "${run.prompt.slice(0, 80)}"  mode=${run.mode}  count=${run.count}`);

    const plan = generatePlan(run.prompt, run.count);

    // Parse criteria into scoring signals (empty object if no criteria set)
    const criteriaSignals: CriteriaSignals | undefined = run.criteria?.trim()
      ? parseCriteria(run.criteria)
      : undefined;

    if (criteriaSignals) {
      await log(runId, "planning", `Criteria applied: "${run.criteria!.slice(0, 100)}"`);
    }

    await prisma.leadRun.update({ where: { id: runId }, data: { plan: plan as unknown as Prisma.InputJsonValue } });
    await log(runId, "planning", `Sources: ${plan.sources.join("  ·  ")}`);

    if (await isStopped(runId)) return;

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 2: DISCOVERING
    // ──────────────────────────────────────────────────────────────────────────
    await setStatus(runId, "discovering", "Searching for leads…");

    const seen = new Set<string>();
    const candidates: Candidate[] = [];

    const addCandidate = (c: Candidate) => {
      const key = c.website.replace(/https?:\/\/(www\.)?/, "").toLowerCase().replace(/\/$/, "");
      if (!seen.has(key) && key.length > 3) {
        seen.add(key);
        candidates.push(c);
      }
    };
    const addMany = (list: Candidate[]) => list.forEach(addCandidate);

    // ── Roblox: top games with 1,000+ live players ────────────────────────────
    await setStage(runId, "Fetching Roblox top games (1,000+ live players)…");
    addMany(await robloxTopGames(1000, Math.max(run.count * 3, 150)));
    await log(runId, "discovering", `Roblox: ${candidates.filter((c) => c.type === "roblox").length} studios`);
    if (await isStopped(runId)) return;

    // ── Steam: top sellers + new releases (last 24 months) ───────────────────
    await setStage(runId, "Fetching Steam top sellers & new releases…");
    addMany(await steamFeaturedGames(24));
    await log(runId, "discovering", `Steam: ${candidates.filter((c) => c.type === "steam").length} developers`);
    if (await isStopped(runId)) return;

    // ── App Store: top-grossing chart ranks 50–200 ────────────────────────────
    await setStage(runId, "Fetching App Store top-grossing chart (ranks 50–200)…");
    addMany(await appStoreChartSearch(50, 200));
    await log(runId, "discovering", `App Store: ${candidates.filter((c) => c.type === "mobile").length} studios`);

    await setStage(runId, `Found ${candidates.length} total candidates across all sources`);
    await log(runId, "discovering", `Total: ${candidates.length} candidates`);

    if (candidates.length === 0) {
      await setStatus(runId, "failed", "No candidates found. Check that external APIs are reachable.");
      return;
    }

    if (await isStopped(runId)) return;

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 2.5: SIZE FILTER + DOMAIN INFERENCE
    // Remove mega-companies / AAA studios before scoring. These are unreachable
    // for a small agency regardless of what the prompt says.
    // ──────────────────────────────────────────────────────────────────────────
    const beforeFilter = candidates.length;
    const filtered = candidates.filter((c) => !isTooLarge(c) && !isInactive(c));
    // Replace candidates array in-place
    candidates.length = 0;
    candidates.push(...filtered);
    const removedCount = beforeFilter - candidates.length;
    if (removedCount > 0) {
      await log(runId, "discovering", `Filtered out ${removedCount} inactive / large companies`);
    }

    // Domain inference for email
    for (const c of candidates) {
      if (!c.contacts.email) {
        const inferred = inferEmailFromDomain(c.website);
        if (inferred) c.contacts.email = inferred;
      }
    }

    if (await isStopped(runId)) return;

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 3: SCORE (parallel Haiku) → ENRICH (Serper only on passing leads)
    // Haiku runs 10 at a time. Serper enrichment only fires for leads that
    // passed scoring — keeps cost proportional to saved leads, not candidates.
    // ──────────────────────────────────────────────────────────────────────────
    await setStatus(runId, "researching", `Analyzing leads…`);

    let savedCount = 0;
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const processCap = run.count * 3; // enough headroom to fill quota after filtering
    const toProcess = shuffled.slice(0, Math.min(shuffled.length, processCap));

    const BATCH = 20; // process in batches to update progress periodically

    for (let i = 0; i < toProcess.length && savedCount < run.count; i += BATCH) {
      if (await isStopped(runId)) return;

      const batch = toProcess.slice(i, Math.min(i + BATCH, toProcess.length));

      // Score the whole batch — synchronous, instant, no AI needed
      const batchResults = batch.map((c) => {
        const a = scoreCandidate(c, plan.segments, criteriaSignals);
        return { c, a };
      });

      // Process scored results — enrich only passing leads
      for (const { c, a } of batchResults) {
        if (savedCount >= run.count) break;
        if (run.mode === "bulk" && a.grade === "F") continue;

        // Hard criteria filter — skip candidates that don't meet required conditions
        if (criteriaSignals && !meetsHardCriteria(c, criteriaSignals)) continue;

        // Serper email enrichment — only runs for leads that passed scoring
        let finalEmail = a.dmEmail || c.contacts.email || null;
        if (!finalEmail && true) {
          const found = await serperEmailSearch(c.name, c.website);
          await trackCost(runId, "brave", "email_enrich", 2, 0);
          if (found) {
            finalEmail = found;
            c.contacts.email = found;
          }
        }
        // Last resort: contact enrichment via Serper general search
        if (!finalEmail && true) {
          const { contacts } = await serperContactEnrich(c.name, c.website);
          await trackCost(runId, "brave", "contact_enrich", 1, 0);
          finalEmail = contacts.email;
          if (contacts.email) c.contacts = mergeContacts(c.contacts, contacts);
        }

        if (!finalEmail) continue; // still no email — skip

        savedCount++;

        await prisma.leadFactoryLead.create({
          data: {
            runId,
            num: savedCount,
            company:         a.company         || c.name,
            website:         a.website         || c.website,
            whatItIs:        a.whatItIs        || null,
            segment:         a.segment         || plan.segments[0] || null,
            decisionMaker:   a.decisionMaker   || null,
            dmRole:          a.dmRole          || null,
            dmEmail:         finalEmail,
            instagramHandle: a.instagramHandle || c.contacts.instagram || null,
            xHandle:         a.xHandle         || c.contacts.twitter   || null,
            grade:  ["A", "B", "C", "D", "F"].includes(a.grade) ? a.grade : "C",
            score:  typeof a.score === "number" ? Math.max(0, Math.min(100, a.score)) : 50,
            whyItFits: a.whyItFits
              ? { reason: a.whyItFits, channel: a.bestChannel, linkedin: a.linkedinUrl, discord: a.discordUrl }
              : Prisma.JsonNull,
            bestChannel: a.bestChannel || null,
            rawData: { ...c.rawData, contacts: c.contacts } as unknown as Prisma.InputJsonValue,
          },
        });

        await prisma.leadRun.update({
          where: { id: runId },
          data: {
            stage: `Saved ${savedCount} / ${run.count} leads`,
            stats: { discovered: candidates.length, processed: Math.min(i + BATCH, toProcess.length), saved: savedCount },
          },
        });
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DONE
    // ──────────────────────────────────────────────────────────────────────────
    await prisma.leadRun.update({
      where: { id: runId },
      data: {
        status: "completed",
        stage: null,
        stats: { discovered: candidates.length, saved: savedCount },
      },
    });

    await log(runId, "completed", `✓ ${savedCount} leads saved from ${candidates.length} candidates`);

  } catch (err) {
    const msg = String(err).slice(0, 300);
    await log(runId, "failed", msg, "error");
    await prisma.leadRun.update({ where: { id: runId }, data: { status: "failed", stage: msg } }).catch(() => {});
  }
}
