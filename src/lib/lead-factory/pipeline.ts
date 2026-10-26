/**
 * Lead Factory Pipeline v3
 *
 * Sources:
 *   Steam   → SteamSpy top100in2weeks + top100forever → Steam appdetails
 *   Mobile  → iTunes RSS top-grossing/free (subcategory × country) → iTunes Lookup
 *   Roblox  → Seeded universe IDs → games.roblox.com/v1/games (public, no auth needed)
 *
 * Key design decisions (Phase 4 rebuild):
 *   - Email is SOFT (scored, never required to pass). Never fabricated.
 *   - Funding, employees, named DM are all SOFT — unknown ≠ fail.
 *   - HARD filters: blocklist, domain, genre, minimum audience size.
 *   - SearXNG removed as dependency (all public instances broken as of 2025).
 *   - Roblox chart API replaced with seeded universe ID list (chart endpoints 404'd).
 *   - Funnel report emitted to DB log after every run.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import cfg from "./config.json";
import { ROBLOX_SEED_UNIVERSE_IDS } from "./roblox-seeds";

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
  email:        string | null;
  emailSource:  "store" | "published" | "scraped" | null;
  genericInbox: boolean;
  instagram:    string | null;
  twitter:      string | null;
  discord:      string | null;
  linkedin:     string | null;
}

function emptyContacts(): Contacts {
  return { email: null, emailSource: null, genericInbox: false, instagram: null, twitter: null, discord: null, linkedin: null };
}

interface Candidate {
  type:         "roblox" | "steam" | "mobile";
  name:         string;
  website:      string;    // own website, not platform URL
  storeLink:    string;
  gameName:     string;
  description:  string;
  genre:        string;
  chartRank:    number | null;
  ratingsCount: number | null;
  playingCount: number | null;   // Roblox live CCU
  lastUpdateDate: string | null;
  updateProofUrl: string | null;
  country:      string | null;
  earnsRealMoney: boolean;
  decisionMaker:        string | null;
  decisionMakerTitle:   string | null;
  decisionMakerLinkedin: string | null;
  investorBacked:       boolean;
  fundingDetails:       string | null;
  fundingProofUrl:      string | null;
  contacts:     Contacts;
  rawData:      Record<string, unknown>;
}

// ─── Funnel tracking ──────────────────────────────────────────────────────────

interface FunnelStage {
  name:     string;
  in:       number;
  out:      number;
  rejected: number;
  reasons:  Map<string, number>;       // reason → count
  examples: Array<{ name: string; reason: string }>;
}

class Funnel {
  stages: FunnelStage[] = [];
  private current: FunnelStage | null = null;

  begin(name: string, count: number) {
    this.current = { name, in: count, out: 0, rejected: 0, reasons: new Map(), examples: [] };
    this.stages.push(this.current);
  }

  reject(name: string, reason: string) {
    if (!this.current) return;
    this.current.rejected++;
    const cat = this.categorise(reason);
    this.current.reasons.set(cat, (this.current.reasons.get(cat) ?? 0) + 1);
    if (this.current.examples.length < 3) this.current.examples.push({ name, reason });
  }

  pass(count: number) {
    if (!this.current) return;
    this.current.out = count;
  }

  private categorise(r: string): string {
    if (r.includes("blocklist") || r.includes("blocklisted")) return "company-blocklisted";
    if (r.includes("genre") || r.includes("Genre"))           return "rejected-genre";
    if (r.includes("rating"))                                  return "low-ratings";
    if (r.includes("playing") || r.includes("CCU"))            return "low-player-count";
    if (r.includes("update") || r.includes("stale"))           return "inactive";
    if (r.includes("previous run") || r.includes("seen"))      return "duplicate";
    if (r.includes("email") || r.includes("Email"))            return "no-email";
    if (r.includes("platform") || r.includes("domain"))        return "platform-domain";
    if (r.includes("Grade F"))                                  return "low-score";
    if (r.includes("coming_soon"))                              return "unreleased";
    return "other";
  }

  report(): string {
    const lines: string[] = ["=== FUNNEL REPORT ==="];
    for (const s of this.stages) {
      lines.push(`\n[${s.name}] in=${s.in} → out=${s.out} (rejected ${s.rejected})`);
      if (s.reasons.size > 0) {
        const top = [...s.reasons.entries()].sort(([,a],[,b]) => b - a).slice(0, 3);
        lines.push(`  Top reasons: ${top.map(([r,n]) => `${r}(${n})`).join(", ")}`);
      }
      if (s.examples.length > 0) {
        lines.push("  Examples:");
        for (const ex of s.examples) lines.push(`    • ${ex.name} — ${ex.reason}`);
      }
    }
    return lines.join("\n");
  }
}

// ─── Config-derived sets ──────────────────────────────────────────────────────

const COMPANY_BLOCKLIST = new Set(cfg.blocklist.companies.map((s) => s.toLowerCase()));
const DOMAIN_BLOCKLIST  = new Set(cfg.domain_blocklist.domains.map((d) => d.toLowerCase()));
const GENRE_REJECT_PRIMARY  = new Set(cfg.genre_reject.primary_genres.map((s) => s.toLowerCase()));
const GENRE_REJECT_KEYWORDS = cfg.genre_reject.title_keywords.map((k) => k.toLowerCase());
const GENERIC_EMAIL_PREFIXES = new Set(cfg.email.generic_prefixes.map((s) => s.toLowerCase()));
const BAD_HANDLES = new Set(cfg.handles.bad_handles.map((s) => s.toLowerCase()));

// ─── Domain helpers ────────────────────────────────────────────────────────────

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

/**
 * True only if the URL belongs to a platform we NEVER want as a lead's own website.
 * roblox.com is NOT in this check — Roblox profiles ARE valid as store links.
 */
function isOwnWebsiteBlocked(url: string): boolean {
  const domain = extractDomain(url);
  const platformDomains = new Set([
    "roblox.com", "steampowered.com", "steamcommunity.com",
    "apps.apple.com", "itunes.apple.com", "play.google.com",
    "github.com", "github.io", "discord.com", "discord.gg",
    "twitter.com", "x.com", "instagram.com", "facebook.com",
    "youtube.com", "linktr.ee", "wixsite.com", "squarespace.com",
    "wordpress.com",
  ]);
  if (platformDomains.has(domain)) return true;
  for (const blocked of platformDomains) {
    if (domain.endsWith("." + blocked)) return true;
  }
  return false;
}

/**
 * Blocklist check: use EXACT word-boundary match only.
 * "king" should not match "Kingdom Rush" — only standalone "King" / "King.com".
 */
function isCompanyBlocked(name: string): boolean {
  const n = name.toLowerCase().trim();
  for (const blocked of COMPANY_BLOCKLIST) {
    // Exact match
    if (n === blocked) return true;
    // Word-boundary match only (e.g. "king.com" matches "king.com" but not "kingdom")
    if (blocked.length > 4 && n.includes(blocked)) return true;
    // For short words (≤4 chars) only exact full-word match
    if (blocked.length <= 4) {
      const re = new RegExp(`(?:^|\\s)${blocked}(?:\\s|$|,)`, "i");
      if (re.test(n)) return true;
    }
  }
  return false;
}

// ─── Genre filter ──────────────────────────────────────────────────────────────

function isRejectedGenre(genre: string, title: string, description: string): boolean {
  const g = genre.toLowerCase();
  const t = title.toLowerCase();
  const d = description.toLowerCase().slice(0, 300);

  if (GENRE_REJECT_PRIMARY.has(g)) return true;

  for (const kw of GENRE_REJECT_KEYWORDS) {
    // Only reject if keyword appears in genre or as a complete word in title
    if (g.includes(kw)) return true;
    // In title: word-boundary match only
    const re = new RegExp(`\\b${kw.replace(/[-]/g, "[-]?")}\\b`, "i");
    if (re.test(t)) return true;
  }

  // Description: only strongest casino signals
  const strongReject = ["slot machine", "texas hold", "blackjack", "roulette", "poker chips", "match-3", "match 3", "triple match"];
  for (const kw of strongReject) {
    if (d.includes(kw)) return true;
  }

  return false;
}

// ─── Activity ──────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function isActivityStale(lastUpdateDate: string | null, maxDays: number): boolean {
  if (!lastUpdateDate) return false; // UNKNOWN ≠ stale — soft check
  const d = new Date(lastUpdateDate);
  if (isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() > maxDays * DAY_MS;
}

// ─── Email ─────────────────────────────────────────────────────────────────────

const EMAIL_RE = /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;

function classifyEmail(raw: string): { email: string; generic: boolean } | null {
  const m = raw.match(/^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
  if (!m) return null;
  const prefix = m[1].toLowerCase();
  const domain = m[2].toLowerCase();
  // Reject emails on blocked domains (gmail, discord, etc.)
  if (isDomainBlocked("https://" + domain)) return null;
  // Never accept fabricated emails
  if (!raw.includes("@")) return null;
  const generic = GENERIC_EMAIL_PREFIXES.has(prefix) ||
    [...GENERIC_EMAIL_PREFIXES].some((p) => prefix.startsWith(p + ".") || prefix.startsWith(p + "_"));
  return { email: raw.toLowerCase(), generic };
}

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

// ─── Website scraping (own site only) ─────────────────────────────────────────

const SCRAPE_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function scrapePageForEmail(url: string): Promise<{ email: string | null; generic: boolean }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": SCRAPE_UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.5" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { email: null, generic: false };
    const reader = res.body?.getReader();
    if (!reader) return { email: null, generic: false };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < 200_000) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.length;
    }
    reader.cancel().catch(() => {});
    const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");

    // Priority 1: mailto: links
    const mailtoMatches = [...html.matchAll(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi)];
    const mailtoEmails = mailtoMatches.map((m) => classifyEmail(m[1])).filter(Boolean) as Array<{ email: string; generic: boolean }>;
    const namedMailto = mailtoEmails.find((e) => !e.generic) ?? mailtoEmails[0];
    if (namedMailto) return namedMailto;

    // Priority 2: inline email pattern
    return extractEmail(html);
  } catch {
    return { email: null, generic: false };
  }
}

async function findEmailOnWebsite(ownWebsite: string): Promise<{ email: string | null; generic: boolean }> {
  if (!ownWebsite || isOwnWebsiteBlocked(ownWebsite)) return { email: null, generic: false };
  const base = ownWebsite.replace(/\/+$/, "");

  const home = await scrapePageForEmail(base);
  if (home.email && !home.generic) return home;

  const subpages = ["/contact", "/about", "/contact-us", "/press"];
  let best: { email: string; generic: boolean } | null = home.email ? (home as { email: string; generic: boolean }) : null;

  for (const path of subpages) {
    const r = await scrapePageForEmail(base + path);
    if (r.email && !r.generic) return r;
    if (r.email && !best) best = r as { email: string; generic: boolean };
  }

  return best ?? { email: null, generic: false };
}

// ─── Social handles (from href only, never from @word in text) ─────────────────

function extractSocialHandles(text: string): Pick<Contacts, "instagram" | "twitter" | "discord" | "linkedin"> {
  if (!text) return { instagram: null, twitter: null, discord: null, linkedin: null };

  const igMatch = text.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]{2,30})\/?(?:\s|$|[^a-zA-Z0-9_.])/i);
  const twMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([a-zA-Z0-9_]{2,30})\/?(?:\s|$|[^a-zA-Z0-9_])/i);
  const dcMatch = text.match(/(?:https?:\/\/)?discord\.gg\/([a-zA-Z0-9_-]{2,30})\/?(?:\s|$|[^a-zA-Z0-9_-])/i);
  const liMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|company)\/([a-zA-Z0-9_%\-]{2,80})\/?/i);

  const validHandle = (h: string | undefined): string | null => {
    if (!h) return null;
    const clean = h.replace(/[/?#].*$/, "").toLowerCase();
    if (BAD_HANDLES.has(clean) || clean.length < 2) return null;
    return h;
  };

  return {
    instagram: validHandle(igMatch?.[1]) ? `@${igMatch![1]}` : null,
    twitter:   validHandle(twMatch?.[1]) ? `@${twMatch![1]}` : null,
    discord:   dcMatch?.[1] ? `https://discord.gg/${dcMatch[1]}` : null,
    linkedin:  liMatch?.[1] ? `https://linkedin.com/company/${liMatch[1]}` : null,
  };
}

// ─── Segment label ─────────────────────────────────────────────────────────────

function buildSegmentLabel(c: Candidate): string {
  if (c.type === "roblox") {
    const t = c.gameName.toLowerCase();
    if (/\btycoon\b/.test(t))                           return "Tycoon (Roblox)";
    if (/\b(roleplay|rp|life)\b/.test(t))               return "Roleplay (Roblox)";
    if (/\bobby\b|\bobstacle\b/.test(t))                return "Obby (Roblox)";
    if (/\b(simulator|sim)\b/.test(t))                  return "Simulator (Roblox)";
    if (/\b(tower|defense)\b/.test(t))                  return "Tower Defense (Roblox)";
    if (/\b(battle|fight|war|shooter)\b/.test(t))       return "Action (Roblox)";
    if (/\b(horror|scary|survive)\b/.test(t))           return "Horror (Roblox)";
    if (/\b(adventure|quest|dungeon)\b/.test(t))        return "Adventure (Roblox)";
    if (/\b(racing|race|car|drift)\b/.test(t))          return "Racing (Roblox)";
    if (/\b(sport|soccer|football|basketball)\b/.test(t)) return "Sports (Roblox)";
    if (/\banime\b/.test(t))                            return "Anime (Roblox)";
    return "Roblox Studio";
  }

  if (c.type === "steam") {
    if (!c.genre || c.genre.toLowerCase() === "free to play") return "PC/Steam Developer";
    return `${c.genre} (PC/Steam)`;
  }

  if (c.type === "mobile") {
    if (!c.genre) return "Mobile Game Studio";
    const g = c.genre
      .replace(/^Games$/, "Mobile Game")
      .replace(/^Role Playing$/, "RPG");
    return `${g} (Mobile)`;
  }

  return "Game Studio";
}

// ─── Scoring ───────────────────────────────────────────────────────────────────
// NOTE: Grade F is only given if genre fails (hard check).
// Activity unknown → still passes (soft check — we never punish unknown data).

interface ScoreResult {
  score:             number;
  grade:             string;
  breakdown:         string;
  activityVerified:  boolean;
  genrePasses:       boolean;
}

function scoreCandidate(c: Candidate): ScoreResult {
  const sc = cfg.scoring;
  let score = 0;
  const parts: string[] = [];

  // Activity: SOFT — if we have a date AND it's recent, add points. Unknown = no points but no penalty.
  const maxAge = c.type === "roblox" ? cfg.activity.roblox_max_age_days : cfg.activity.max_age_days;
  const activityVerified = c.lastUpdateDate !== null && !isActivityStale(c.lastUpdateDate, maxAge);
  if (activityVerified) { score += sc.activity_verified; parts.push(`activity(${sc.activity_verified})`); }

  // Genre: HARD — grade F if genre fails
  const genrePasses = !isRejectedGenre(c.genre, c.gameName, c.description);

  // Email: SOFT — points for real email, partial for generic, 0 for missing (no rejection)
  if (c.contacts.email && !c.contacts.genericInbox) {
    score += sc.real_email_found; parts.push(`email(${sc.real_email_found})`);
  } else if (c.contacts.email && c.contacts.genericInbox) {
    score += Math.floor(sc.real_email_found / 2); parts.push(`generic_email(${Math.floor(sc.real_email_found / 2)})`);
  }

  // Named DM: SOFT
  if (c.decisionMaker) { score += sc.named_decision_maker; parts.push(`dm(${sc.named_decision_maker})`); }

  // Funding: SOFT
  if (c.investorBacked) { score += sc.funding_last_12mo; parts.push(`funding(${sc.funding_last_12mo})`); }

  // Audience
  const audience = c.playingCount ?? c.ratingsCount ?? 0;
  if (audience >= 50000) { score += sc.audience_large;  parts.push(`audience_large(${sc.audience_large})`); }
  else if (audience >= 5000) { score += sc.audience_medium; parts.push(`audience_medium(${sc.audience_medium})`); }
  else if (audience >= 500)  { score += Math.floor(sc.audience_medium / 2); parts.push(`audience_small(${Math.floor(sc.audience_medium / 2)})`); }

  // Country
  const goodCountries = new Set(["US", "GB", "CA", "AU", "DE", "FR", "NL", "SE", "NO", "DK", "FI"]);
  if (c.country && goodCountries.has(c.country.toUpperCase())) {
    score += sc.us_uk_ca_au_eu_country; parts.push(`country(${sc.us_uk_ca_au_eu_country})`);
  }

  if (c.earnsRealMoney) { score += sc.real_money_gameplay; parts.push(`real_money(${sc.real_money_gameplay})`); }

  score = Math.min(100, Math.max(0, score));
  const breakdown = parts.join(" + ") || "0";

  // Grade: F only if genre fails (hard check). Otherwise based on score.
  let grade: string;
  if (!genrePasses) {
    grade = "F";
  } else if (score >= sc.grade_a_threshold) {
    grade = "A";
  } else if (score >= sc.grade_b_threshold) {
    grade = "B";
  } else if (score >= sc.grade_c_threshold) {
    grade = "C";
  } else {
    grade = "D";
  }

  return { score, grade, breakdown, activityVerified, genrePasses };
}

// ─── Criteria parser ───────────────────────────────────────────────────────────

interface CriteriaFlags {
  sources:          Set<"roblox" | "steam" | "mobile">;
  requireFunding:   boolean;
  requireCountries: Set<string> | null;
  minRatings:       number | null;
  minPlayers:       number | null;
  extraContext:     string;
}

function parseCriteria(raw: string | null): CriteriaFlags {
  const t = (raw ?? "").toLowerCase();

  const negated = t
    .replace(/\b(no|not|without|exclude|skip|ignore|except)\s+(roblox|steam|mobile|ios|android|pc|app\s*store|apple)\b/g, " ")
    .replace(/\b(roblox|steam|mobile|ios|app\s*store)\s+(not|excluded|removed|skipped)\b/g, " ");

  const onlyRoblox = /\bonly\s+roblox\b|\broblox\s+only\b/.test(t);
  const onlySteam  = /\bonly\s+steam\b|\bsteam\s+only\b/.test(t);
  const onlyMobile = /\bonly\s+mobile\b|\bmobile\s+only\b|\bonly\s+(ios|app\s*store|apple)\b/.test(t);

  const wantsRoblox = /roblox/.test(negated);
  const wantsSteam  = /\bsteam\b|pc game|windows game/.test(negated);
  const wantsMobile = /\bmobile\b|ios|iphone|ipad|app store|apple/.test(negated);

  let sources: Set<"roblox" | "steam" | "mobile">;
  if      (onlyRoblox)  sources = new Set(["roblox"] as const);
  else if (onlySteam)   sources = new Set(["steam"]  as const);
  else if (onlyMobile)  sources = new Set(["mobile"] as const);
  else if (wantsRoblox || wantsSteam || wantsMobile) {
    sources = new Set<"roblox" | "steam" | "mobile">();
    if (wantsRoblox) sources.add("roblox");
    if (wantsSteam)  sources.add("steam");
    if (wantsMobile) sources.add("mobile");
  } else {
    sources = new Set(["roblox", "steam", "mobile"] as const);
  }

  const requireFunding = /\b(vc.backed|vc funded|venture.backed|venture funded|investor.backed|investor funded|seed funded|series [abc] funded)\b/.test(t);

  const requireCountries: Set<string> | null = (() => {
    if (/\b(us|usa|united states)\s+only\b|\bonly\s+(us|usa|united states)\b/.test(t)) return new Set(["US"]);
    if (/\b(uk|united kingdom)\s+only\b|\bonly\s+(uk|united kingdom)\b/.test(t))       return new Set(["GB"]);
    if (/\bcanada\s+only\b|\bonly\s+canada\b/.test(t))                                  return new Set(["CA"]);
    return null;
  })();

  const explicitLarge = /\b(millions? of players|top\s+10\b|top\s+5\b|#1 game|100k\+?\s+players)\b/.test(t);
  const minRatings = explicitLarge ? 50000 : null;
  const minPlayers = explicitLarge ? 5000  : null;

  const parts: string[] = [`sources=[${[...sources].join(",")}]`];
  if (requireFunding)   parts.push("requireFunding");
  if (requireCountries) parts.push(`countries=[${[...requireCountries].join(",")}]`);
  if (minRatings)       parts.push(`minRatings=${minRatings}`);
  if (minPlayers)       parts.push(`minPlayers=${minPlayers}`);

  return { sources, requireFunding, requireCountries, minRatings, minPlayers, extraContext: parts.join(" | ") };
}

// ─── Cross-run dedup ───────────────────────────────────────────────────────────

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

// ─── Roblox source ─────────────────────────────────────────────────────────────
// Uses seeded universe IDs since the public chart/list API (games/sorts, games/list)
// was deprecated by Roblox in 2024/2025. games.roblox.com/v1/games?universeIds=X
// still works without auth and returns current player counts.

interface RobloxGame {
  id:          number;
  rootPlaceId: number;
  name:        string;
  playing:     number;
  visits:      number;
  totalUpVotes: number;
  updated:     string;
  creator: { id: number; name: string; type: string };
}

async function robloxTopGames(
  minPlaying: number,
  take: number,
  funnel: Funnel,
  dbLog: (msg: string) => void,
): Promise<Candidate[]> {
  const HEADERS = {
    "User-Agent": SCRAPE_UA,
    Accept: "application/json",
    "Referer": "https://www.roblox.com/",
  };

  const seeds = ROBLOX_SEED_UNIVERSE_IDS;
  dbLog(`Roblox: fetching ${seeds.length} seed universe IDs in batches of 50`);

  // Batch into groups of 50 (API limit)
  const batches: number[][] = [];
  for (let i = 0; i < seeds.length; i += 50) batches.push(seeds.slice(i, i + 50));

  const games = new Map<number, RobloxGame>();

  for (const batch of batches) {
    const url = `https://games.roblox.com/v1/games?universeIds=${batch.join(",")}`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) }).catch(() => null);
    if (!res?.ok) {
      dbLog(`Roblox batch fetch failed: HTTP ${res?.status ?? "network-error"}`);
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await res.json().catch(() => ({})) as { data?: any[] };
    for (const g of body.data ?? []) {
      if (g.id && !games.has(g.id)) {
        games.set(g.id, {
          id:          g.id,
          rootPlaceId: g.rootPlaceId,
          name:        g.name ?? "",
          playing:     g.playing ?? 0,
          visits:      g.visits ?? 0,
          totalUpVotes: g.totalUpVotes ?? 0,
          updated:     g.updated ?? "",
          creator:     g.creator ?? { id: 0, name: "", type: "Group" },
        });
      }
    }
  }

  dbLog(`Roblox: fetched ${games.size} games, filtering by playing≥${minPlaying}`);

  const active = [...games.values()].filter((g) => g.playing >= minPlaying)
    .sort((a, b) => b.playing - a.playing)
    .slice(0, take * 2);

  dbLog(`Roblox: ${active.length} games with playing≥${minPlaying}`);

  funnel.begin("roblox-filter", active.length);
  const candidates: Candidate[] = [];

  for (const g of active) {
    const creatorName = g.creator.name;
    const creatorId   = g.creator.id;
    const creatorType = g.creator.type === "Group" ? "Group" : "User";

    if (isCompanyBlocked(creatorName)) {
      funnel.reject(creatorName, `Company blocklisted`);
      continue;
    }

    // Fetch creator profile for bio/website
    const profileUrl = creatorType === "Group"
      ? `https://www.roblox.com/groups/${creatorId}`
      : `https://www.roblox.com/users/${creatorId}/profile`;

    let bio = "";
    try {
      const profileApiUrl = creatorType === "Group"
        ? `https://groups.roblox.com/v1/groups/${creatorId}`
        : `https://users.roblox.com/v1/users/${creatorId}`;
      const pr = await fetch(profileApiUrl, { headers: HEADERS, signal: AbortSignal.timeout(6000) }).catch(() => null);
      if (pr?.ok) {
        const pd = await pr.json() as { description?: string };
        bio = pd.description ?? "";
      }
    } catch { /* best-effort */ }

    // Extract own website from bio
    const ownUrlMatch = bio.match(
      /https?:\/\/(?!(?:www\.)?(?:roblox|twitter|x|instagram|discord|youtube|twitch|tiktok|facebook|linktr)\.)([^\s<>"',]{4,80})/i
    );
    const ownWebsite = ownUrlMatch ? ownUrlMatch[0].replace(/[.,;)]+$/, "") : null;

    const { email, generic } = extractEmail(bio);
    const handles = extractSocialHandles(bio);

    candidates.push({
      type:         "roblox",
      name:         creatorName,
      website:      ownWebsite ?? profileUrl,
      storeLink:    `https://www.roblox.com/games/${g.rootPlaceId}`,
      gameName:     g.name,
      description:  `"${g.name}" · ${g.playing.toLocaleString()} playing · ${g.totalUpVotes.toLocaleString()} upvotes`,
      genre:        "Roblox",
      chartRank:    null,
      ratingsCount: g.totalUpVotes,
      playingCount: g.playing,
      lastUpdateDate: g.updated || new Date().toISOString(),
      updateProofUrl: `https://www.roblox.com/games/${g.rootPlaceId}`,
      country:      null,
      earnsRealMoney: false,
      contacts: { email, emailSource: email ? "published" : null, genericInbox: generic, ...handles },
      decisionMaker: null, decisionMakerTitle: null, decisionMakerLinkedin: null,
      investorBacked: false, fundingDetails: null, fundingProofUrl: null,
      rawData: { universeId: g.id, rootPlaceId: g.rootPlaceId, playing: g.playing, totalUpVotes: g.totalUpVotes, updated: g.updated, creatorId, creatorType, bio: bio.slice(0, 200) },
    });
  }

  funnel.pass(candidates.length);
  return candidates;
}

// ─── Steam source ──────────────────────────────────────────────────────────────

async function steamTopGames(funnel: Funnel, dbLog: (msg: string) => void): Promise<Candidate[]> {
  const [trendRes, allTimeRes] = await Promise.all([
    fetch("https://steamspy.com/api.php?request=top100in2weeks", { signal: AbortSignal.timeout(15000) }).catch(() => null),
    fetch("https://steamspy.com/api.php?request=top100forever",  { signal: AbortSignal.timeout(15000) }).catch(() => null),
  ]);

  type SpyGame = { appid: number; name: string; developer: string; publisher: string; owners: string };
  const mergedById = new Map<number, SpyGame>();
  for (const res of [trendRes, allTimeRes]) {
    if (!res?.ok) continue;
    const data = await res.json() as Record<string, SpyGame>;
    for (const g of Object.values(data)) if (g.appid) mergedById.set(g.appid, g);
  }

  if (!mergedById.size) {
    dbLog("Steam: SteamSpy returned 0 games — both endpoints failed");
    return [];
  }
  dbLog(`Steam: ${mergedById.size} games from SteamSpy`);

  const games = [...mergedById.values()].slice(0, 200);
  funnel.begin("steam-filter", games.length);
  const candidates: Candidate[] = [];
  const seenDevs = new Set<string>();

  await Promise.allSettled(games.map(async (game) => {
    const detUrl = `https://store.steampowered.com/api/appdetails?appids=${game.appid}&filters=basic,genres,developers,publishers,support_info,website,release_date`;
    const detRes = await fetch(detUrl, { signal: AbortSignal.timeout(10000) }).catch(() => null);
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
      };
    }>;

    const app = detData[String(game.appid)];
    if (!app?.success || !app.data) return;

    const devName = app.data.developers?.[0] ?? app.data.publishers?.[0] ?? game.developer;
    if (!devName) return;
    const key = devName.toLowerCase().trim();
    if (seenDevs.has(key)) return;
    seenDevs.add(key);

    if (isCompanyBlocked(devName) || isCompanyBlocked(app.data.publishers?.[0] ?? "")) {
      funnel.reject(devName, "Company blocklisted");
      return;
    }

    if (app.data.release_date?.coming_soon) {
      funnel.reject(devName, "coming_soon=true");
      return;
    }

    const primaryGenre = app.data.genres?.[0]?.description ?? "";
    const gameName     = app.data.name ?? game.name;
    const desc         = app.data.short_description ?? "";

    if (isRejectedGenre(primaryGenre, gameName, desc)) {
      funnel.reject(devName, `Rejected genre: "${primaryGenre}" / title: "${gameName}"`);
      return;
    }

    const ownWebsite = app.data.website && !isOwnWebsiteBlocked(app.data.website) ? app.data.website : null;
    const storeLink  = `https://store.steampowered.com/app/${game.appid}`;

    // Use Steam's own support_info.email as primary source (no scraping needed)
    const rawSupportEmail = app.data.support_info?.email?.trim() ?? null;
    let contactEmail: string | null = null;
    let contactGeneric = false;
    if (rawSupportEmail) {
      const { email, generic } = classifyEmail(rawSupportEmail) ?? { email: null, generic: false };
      if (email) { contactEmail = email; contactGeneric = generic; }
    }

    const handles = extractSocialHandles(desc + " " + (ownWebsite ?? ""));

    candidates.push({
      type:          "steam",
      name:          devName,
      website:       ownWebsite ?? storeLink,
      storeLink,
      gameName,
      description:   `"${gameName}"${primaryGenre ? ` · ${primaryGenre}` : ""}${desc ? ` · ${desc.slice(0, 180)}` : ""}`.trim(),
      genre:         primaryGenre,
      chartRank:     null,
      ratingsCount:  null,
      playingCount:  null,
      // SteamSpy top100in2weeks proves current activity — release date is not activity
      lastUpdateDate: new Date().toISOString(),
      updateProofUrl: storeLink,
      country:       null,
      earnsRealMoney: false,
      contacts: { email: contactEmail, emailSource: contactEmail ? "store" : null, genericInbox: contactGeneric, ...handles },
      decisionMaker: null, decisionMakerTitle: null, decisionMakerLinkedin: null,
      investorBacked: false, fundingDetails: null, fundingProofUrl: null,
      rawData: { appId: game.appid, gameName, ownersRange: game.owners, ...app.data },
    });
  }));

  funnel.pass(candidates.length);
  dbLog(`Steam: ${candidates.length} candidates after filter`);
  return candidates;
}

// ─── App Store source ──────────────────────────────────────────────────────────

interface ITunesRSSEntry {
  "im:name":   { label: string };
  "im:artist": { label: string };
  id:          { attributes: { "im:id": string }; label: string };
}

interface ITunesLookupResult {
  trackId?:                          number;
  sellerName?:                       string;
  artistName?:                       string;
  sellerUrl?:                        string;
  description?:                      string;
  currentVersionReleaseDate?:        string;
  releaseDate?:                      string;
  primaryGenreName?:                 string;
  userRatingCount?:                  number;
  userRatingCountForCurrentVersion?: number;
  trackName?:                        string;
  trackViewUrl?:                     string;
  price?:                            number;
  [key: string]: unknown;
}

type ItunesChartType = "topgrossingapplications" | "topfreeapplications";

async function fetchItunesChart(country: string, genreId: string, chartType: ItunesChartType = "topgrossingapplications", limit = 100): Promise<ITunesRSSEntry[]> {
  const url = `https://itunes.apple.com/${country}/rss/${chartType}/limit=${limit}/genre=${genreId}/json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) }).catch(() => null);
  if (!res?.ok) return [];
  try {
    const data = await res.json() as { feed?: { entry?: ITunesRSSEntry[] } };
    return data.feed?.entry ?? [];
  } catch { return []; }
}

async function fetchItunesLookup(ids: string[]): Promise<Map<string, ITunesLookupResult>> {
  const map = new Map<string, ITunesLookupResult>();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));

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

async function appStoreTopGames(funnel: Funnel, dbLog: (msg: string) => void): Promise<Candidate[]> {
  const countries    = cfg.sources.app_store_countries;
  const allowedSubs  = cfg.sources.app_store_allowed_subcategory_ids;
  const skipTopN     = cfg.sources.app_store_rank_skip_top;

  const appIdToMeta = new Map<string, { rank: number | null; country: string }>();

  // US main chart (topgrossing + topfree) — skip top skipTopN
  const [usGross, usFree] = await Promise.all([
    fetchItunesChart("us", "6014", "topgrossingapplications", 100),
    fetchItunesChart("us", "6014", "topfreeapplications",     100),
  ]);
  for (let i = 0; i < usGross.length; i++) {
    if (i < skipTopN) continue;
    const id = usGross[i].id.attributes["im:id"];
    if (!appIdToMeta.has(id)) appIdToMeta.set(id, { rank: i + 1, country: "US" });
  }
  for (const e of usFree) {
    const id = e.id.attributes["im:id"];
    if (!appIdToMeta.has(id)) appIdToMeta.set(id, { rank: null, country: "US" });
  }

  // Subcategory charts × countries
  await Promise.allSettled(
    countries.flatMap((country) =>
      allowedSubs.flatMap((subId) => [
        fetchItunesChart(country, subId, "topgrossingapplications", 100).then((entries) => {
          for (const e of entries) {
            const id = e.id.attributes["im:id"];
            if (!appIdToMeta.has(id)) appIdToMeta.set(id, { rank: null, country: country.toUpperCase() });
          }
        }),
        fetchItunesChart(country, subId, "topfreeapplications", 100).then((entries) => {
          for (const e of entries) {
            const id = e.id.attributes["im:id"];
            if (!appIdToMeta.has(id)) appIdToMeta.set(id, { rank: null, country: country.toUpperCase() });
          }
        }),
      ])
    )
  );

  dbLog(`App Store: ${appIdToMeta.size} unique app IDs collected`);
  if (!appIdToMeta.size) return [];

  const detailMap = await fetchItunesLookup([...appIdToMeta.keys()]);
  dbLog(`App Store: lookup returned ${detailMap.size} app details`);

  funnel.begin("mobile-filter", detailMap.size);
  const candidates: Candidate[] = [];
  const seenDevs = new Set<string>();

  for (const [appId, meta] of appIdToMeta) {
    const detail  = detailMap.get(appId);
    const devName = detail?.sellerName ?? detail?.artistName ?? "";
    if (!devName) continue;
    const key = devName.toLowerCase().trim();
    if (seenDevs.has(key)) { funnel.reject(devName, "Duplicate developer"); continue; }

    if (isCompanyBlocked(devName)) {
      funnel.reject(devName, "Company blocklisted");
      seenDevs.add(key);
      continue;
    }

    const gameName    = detail?.trackName ?? "";
    const primaryGenre = detail?.primaryGenreName ?? "";
    const desc        = detail?.description ?? "";

    if (isRejectedGenre(primaryGenre, gameName, desc)) {
      funnel.reject(devName, `Rejected genre: "${primaryGenre}" / title: "${gameName}"`);
      seenDevs.add(key);
      continue;
    }

    const ratingsCount = detail?.userRatingCount ?? detail?.userRatingCountForCurrentVersion ?? 0;
    const minRatings   = cfg.activity.min_ratings_mobile;
    if (ratingsCount < minRatings) {
      funnel.reject(devName, `Only ${ratingsCount} ratings (min ${minRatings})`);
      seenDevs.add(key);
      continue;
    }

    // Activity: SOFT — if date missing, keep it (unknown ≠ fail)
    const lastUpdate = detail?.currentVersionReleaseDate ?? detail?.releaseDate ?? null;
    if (lastUpdate && isActivityStale(lastUpdate, cfg.activity.max_age_days)) {
      funnel.reject(devName, `Last update ${lastUpdate} > ${cfg.activity.max_age_days} days ago`);
      seenDevs.add(key);
      continue;
    }

    const storeLink  = detail?.trackViewUrl ?? `https://apps.apple.com/us/app/id${appId}`;
    const rawSeller  = detail?.sellerUrl ?? null;
    const ownWebsite = rawSeller && !isOwnWebsiteBlocked(rawSeller) ? rawSeller : null;

    const { email: descEmail, generic: descGeneric } = extractEmail(desc);
    const handles = extractSocialHandles(desc + " " + (ownWebsite ?? ""));
    const earnsRealMoney = (detail?.price ?? 0) > 0 || ["Casino", "Sports", "Racing"].includes(primaryGenre);

    seenDevs.add(key);
    candidates.push({
      type:          "mobile",
      name:          devName,
      website:       ownWebsite ?? storeLink,
      storeLink,
      gameName,
      description:   `"${gameName}"${primaryGenre ? ` · ${primaryGenre}` : ""}${meta.rank ? ` · App Store #${meta.rank}` : ""}${desc ? ` · ${desc.slice(0, 160)}` : ""}`.trim(),
      genre:         primaryGenre,
      chartRank:     meta.rank,
      ratingsCount,
      playingCount:  null,
      lastUpdateDate: lastUpdate,
      updateProofUrl: storeLink,
      country:       meta.country,
      earnsRealMoney,
      contacts: { email: descEmail, emailSource: descEmail ? "published" : null, genericInbox: descGeneric, ...handles },
      decisionMaker: null, decisionMakerTitle: null, decisionMakerLinkedin: null,
      investorBacked: false, fundingDetails: null, fundingProofUrl: null,
      rawData: { appId, fromMainUS: meta.rank !== null, ...detail },
    });
  }

  funnel.pass(candidates.length);
  dbLog(`App Store: ${candidates.length} candidates after filter`);
  return candidates;
}

// ─── Main pipeline ─────────────────────────────────────────────────────────────

export async function processLeadRun(runId: string): Promise<void> {
  const run = await prisma.leadRun.findUnique({ where: { id: runId } });
  if (!run) return;

  const funnel = new Funnel();

  try {
    // ── PHASE 1: SETUP ─────────────────────────────────────────────────────────
    await setStatus(runId, "planning", "Initialising pipeline…");
    await log(runId, "planning", `Run started: criteria="${(run.criteria ?? "none").slice(0, 80)}" count=${run.count}`);

    await setStage(runId, "Loading seen companies from previous runs…");
    const seenDomains = await loadSeenDomains();
    await log(runId, "planning", `Cross-run deduplication: ${seenDomains.size} known domains`);

    if (await isStopped(runId)) return;

    // ── PHASE 2: DISCOVER ──────────────────────────────────────────────────────
    const flags = parseCriteria(run.criteria);
    await log(runId, "planning", `Criteria parsed: ${flags.extraContext || "no overrides — using all sources"}`);
    await setStatus(runId, "discovering", "Fetching charts…");

    const dbLog = (msg: string) => { log(runId, "discovering", msg).catch(() => {}); };

    const seenThisRun = new Set<string>();
    const candidates: Candidate[] = [];

    function tryAdd(c: Candidate) {
      const key = extractDomain(isOwnWebsiteBlocked(c.website) ? c.storeLink : c.website);
      if (seenThisRun.has(key)) { funnel.reject(c.name, "Duplicate within this run"); return; }
      if (seenDomains.has(key)) { funnel.reject(c.name, "Already seen in a previous run"); return; }
      seenThisRun.add(key);
      candidates.push(c);
    }

    if (flags.sources.has("roblox")) {
      const minPlaying = flags.minPlayers ?? cfg.activity.min_playing_roblox;
      await setStage(runId, `Fetching Roblox games (seed list, ≥${minPlaying} playing)…`);
      const robloxResults = await robloxTopGames(minPlaying, Math.max(run.count * 4, 100), funnel, dbLog);
      robloxResults.forEach(tryAdd);
      await log(runId, "discovering", `Roblox: ${candidates.filter((c) => c.type === "roblox").length} candidates after dedup`);
      if (await isStopped(runId)) return;
    }

    if (flags.sources.has("steam")) {
      await setStage(runId, "Fetching Steam top trending games…");
      const steamResults = await steamTopGames(funnel, dbLog);
      steamResults.forEach(tryAdd);
      await log(runId, "discovering", `Steam: ${candidates.filter((c) => c.type === "steam").length} candidates after dedup`);
      if (await isStopped(runId)) return;
    }

    if (flags.sources.has("mobile")) {
      await setStage(runId, "Fetching App Store charts…");
      const mobileResults = await appStoreTopGames(funnel, dbLog);
      mobileResults.forEach(tryAdd);
      await log(runId, "discovering", `App Store: ${candidates.filter((c) => c.type === "mobile").length} candidates after dedup`);
    }

    const preFilterCount = candidates.length;
    await log(runId, "discovering", `Total candidates: ${preFilterCount}`);
    await setStage(runId, `Discovered ${preFilterCount} unique candidates`);

    if (candidates.length === 0) {
      await log(runId, "discovering", funnel.report(), "warn");
      await setStatus(runId, "failed", "No candidates found. Check the funnel report in logs.");
      return;
    }

    if (await isStopped(runId)) return;

    // ── PHASE 2.5: HARD FILTER ─────────────────────────────────────────────────
    // HARD filters only — things we can always check from free data.
    // Soft things (email, funding, named DM) are NEVER rejection reasons here.
    await setStage(runId, "Applying hard filters…");
    funnel.begin("hard-filter", candidates.length);
    const hardFiltered: Candidate[] = [];

    for (const c of candidates) {
      if (isCompanyBlocked(c.name)) {
        funnel.reject(c.name, "Company name in blocklist");
        continue;
      }
      if (isRejectedGenre(c.genre, c.gameName, c.description)) {
        funnel.reject(c.name, `Rejected genre: "${c.genre}" title: "${c.gameName}"`);
        continue;
      }
      if (flags.requireCountries && c.country && !flags.requireCountries.has(c.country.toUpperCase())) {
        funnel.reject(c.name, `Country "${c.country}" not in criteria filter`);
        continue;
      }
      if (flags.minRatings && (c.ratingsCount ?? 0) > 0 && (c.ratingsCount ?? 0) < flags.minRatings) {
        funnel.reject(c.name, `Only ${c.ratingsCount} ratings (criteria requires ${flags.minRatings})`);
        continue;
      }
      hardFiltered.push(c);
    }

    funnel.pass(hardFiltered.length);
    await log(runId, "discovering", `After hard filter: ${hardFiltered.length} candidates`);

    if (hardFiltered.length === 0) {
      await log(runId, "discovering", funnel.report(), "warn");
      await setStatus(runId, "failed", "All candidates filtered out. See funnel report in logs.");
      return;
    }

    if (await isStopped(runId)) return;

    // ── PHASE 3: ENRICH + SCORE ────────────────────────────────────────────────
    await setStatus(runId, "researching", "Enriching and scoring leads…");

    // Sort: steam/mobile first (own website = better email hit rate), roblox last
    const typeOrder: Record<string, number> = { steam: 0, mobile: 1, roblox: 2 };
    hardFiltered.sort((a, b) => (typeOrder[a.type] ?? 2) - (typeOrder[b.type] ?? 2));

    const robloxCount = hardFiltered.filter((c) => c.type === "roblox").length;
    const steamCount  = hardFiltered.filter((c) => c.type === "steam").length;
    const mobileCount = hardFiltered.filter((c) => c.type === "mobile").length;
    await log(runId, "researching", `Starting enrichment: ${hardFiltered.length} candidates (roblox=${robloxCount} steam=${steamCount} mobile=${mobileCount})`);

    funnel.begin("enrichment", hardFiltered.length);
    let savedCount = 0;
    const toProcess = hardFiltered.slice(0, Math.min(hardFiltered.length, run.count * 8));

    async function enrichOne(c: Candidate): Promise<boolean> {
      // ── Email: scrape own website if we don't have one yet ────────────────────
      if (!c.contacts.email) {
        const ownSite = !isOwnWebsiteBlocked(c.website) ? c.website : null;
        if (ownSite) {
          const found = await findEmailOnWebsite(ownSite);
          if (found.email) {
            c.contacts.email = found.email;
            c.contacts.emailSource = "scraped";
            c.contacts.genericInbox = found.generic;
          }
        }
        // For Roblox with no own site — try fetching the profile URL to extract handles
        // (we already got email from bio; if none was there, leave it blank)
      }

      // ── Score (email is now soft — won't change grade unless genre fails) ─────
      const scored = scoreCandidate(c);
      if (scored.grade === "F") {
        funnel.reject(c.name, `Grade F — genrePasses=${scored.genrePasses}`);
        return false;
      }

      // ── Criteria: funding required ────────────────────────────────────────────
      if (flags.requireFunding && !c.investorBacked) {
        funnel.reject(c.name, "requireFunding set but studio not confirmed investor-backed");
        return false;
      }

      return true;
    }

    // Process in parallel batches of 8
    const BATCH = 8;
    for (let i = 0; i < toProcess.length && savedCount < run.count; i += BATCH) {
      if (await isStopped(runId)) return;

      const batch = toProcess.slice(i, Math.min(i + BATCH, toProcess.length));
      const results = await Promise.allSettled(batch.map((c) => enrichOne(c)));

      for (let j = 0; j < results.length; j++) {
        if (savedCount >= run.count) break;
        const r = results[j];
        const c = batch[j];

        if (r.status === "rejected" || (r.status === "fulfilled" && !r.value)) continue;

        const scored = scoreCandidate(c);
        const segmentLabel = buildSegmentLabel(c);
        const ownSite = !isOwnWebsiteBlocked(c.website) ? c.website : null;

        savedCount++;
        funnel.pass(savedCount);

        const moneySignals: string[] = [];
        if (c.chartRank !== null) moneySignals.push(`App Store chart rank ${c.chartRank}`);
        if (c.playingCount) moneySignals.push(`${c.playingCount.toLocaleString()} live players`);
        if (c.ratingsCount && c.ratingsCount > 0) moneySignals.push(`${c.ratingsCount.toLocaleString()} ratings`);
        if (c.earnsRealMoney) moneySignals.push("Paid / real-money gameplay");
        if (c.investorBacked) moneySignals.push(c.fundingDetails ?? "Investor-backed");

        const signals = {
          activityVerified: scored.activityVerified,
          genrePasses:      scored.genrePasses,
          notBlocklisted:   true,
          hasFunding:       c.investorBacked,
          hasEmail:         !!c.contacts.email,
          emailSource:      c.contacts.emailSource,
          genericInbox:     c.contacts.genericInbox,
          audienceSize: (c.playingCount ?? c.ratingsCount ?? 0) >= 50000 ? "large"
                      : (c.playingCount ?? c.ratingsCount ?? 0) >= 5000  ? "medium" : "small",
          country:          c.country,
          realMoneyGameplay: c.earnsRealMoney,
          breakdown:        scored.breakdown,
          total:            scored.score,
        };

        await prisma.leadFactoryLead.create({
          data: {
            runId,
            num:             savedCount,
            company:         c.name.slice(0, 100),
            website:         ownSite ?? c.storeLink,
            whatItIs:        c.description.replace(/\n/g, " ").slice(0, 250),
            segment:         segmentLabel,
            grade:           scored.grade,
            score:           scored.score,
            country:         c.country,
            decisionMaker:   c.decisionMaker,
            dmRole:          c.decisionMakerTitle,
            dmEmail:         c.contacts.email,
            instagramHandle: c.contacts.instagram,
            xHandle:         c.contacts.twitter,
            linkedinUrl:     c.decisionMakerLinkedin ?? c.contacts.linkedin,
            bestChannel:     c.contacts.email
              ? (c.contacts.genericInbox ? "generic-inbox" : "email")
              : (c.contacts.instagram ? "instagram" : c.contacts.twitter ? "twitter" : "direct"),
            whyItFits:       Prisma.JsonNull,
            signals:         signals as unknown as Prisma.InputJsonValue,
            rawData: {
              source:         c.type,
              gameName:       c.gameName,
              storeLink:      c.storeLink,
              genre:          c.genre,
              chartRank:      c.chartRank,
              ratingsCount:   c.ratingsCount,
              playingCount:   c.playingCount,
              lastUpdateDate: c.lastUpdateDate,
              updateProofUrl: c.updateProofUrl,
              country:        c.country,
              earnsRealMoney: c.earnsRealMoney,
              investorBacked: c.investorBacked,
              latestFunding:  c.fundingDetails,
              fundingProof:   c.fundingProofUrl,
              moneySignals,
              emailSource:    c.contacts.emailSource,
              genericInbox:   c.contacts.genericInbox,
              discord:        c.contacts.discord,
              ownWebsite:     ownSite,
              playerCount:    c.playingCount,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        await prisma.leadRun.update({
          where: { id: runId },
          data: {
            stage: `Saved ${savedCount} / ${run.count} leads`,
            stats: { pulled: preFilterCount, filtered: preFilterCount - hardFiltered.length, saved: savedCount },
          },
        });
      }
    }

    // ── DONE ───────────────────────────────────────────────────────────────────
    await log(runId, "completed", funnel.report());
    await log(runId, "completed", `✓ ${savedCount} leads saved from ${preFilterCount} candidates.`);

    await prisma.leadRun.update({
      where: { id: runId },
      data: {
        status: savedCount > 0 ? "completed" : "failed",
        stage:  savedCount > 0 ? null : "Pipeline ran but no leads were saved — check funnel report in logs",
        stats:  { pulled: preFilterCount, saved: savedCount },
      },
    });

  } catch (err) {
    const msg = String(err).slice(0, 400);
    await log(runId, "failed", msg, "error").catch(() => {});
    await prisma.leadRun.update({ where: { id: runId }, data: { status: "failed", stage: msg } }).catch(() => {});
  }
}
