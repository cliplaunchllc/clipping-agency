/**
 * Unit tests for lead factory filters.
 * Run with: npx ts-node --project tsconfig.worker.json src/lib/lead-factory/__tests__/pipeline.test.ts
 * (No jest needed — pure assertion-based)
 */

import cfg from "../config.json";

// ─── Copy helpers from pipeline (avoid import side-effects) ──────────────────

const COMPANY_BLOCKLIST = new Set(cfg.blocklist.companies.map((s) => s.toLowerCase()));
const DOMAIN_BLOCKLIST  = new Set(cfg.domain_blocklist.domains.map((d) => d.toLowerCase()));
const GENRE_REJECT_PRIMARY  = new Set(cfg.genre_reject.primary_genres.map((s) => s.toLowerCase()));
const GENRE_REJECT_KEYWORDS = cfg.genre_reject.title_keywords.map((k) => k.toLowerCase());
const GENERIC_EMAIL_PREFIXES = new Set(cfg.email.generic_prefixes.map((s) => s.toLowerCase()));
const BAD_HANDLES = new Set(cfg.handles.bad_handles.map((s) => s.toLowerCase()));

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`)
      .hostname.replace(/^www\./, "").toLowerCase();
  } catch { return url.toLowerCase().replace(/^www\./, ""); }
}

function isDomainBlocked(url: string): boolean {
  const domain = extractDomain(url);
  if (DOMAIN_BLOCKLIST.has(domain)) return true;
  for (const blocked of DOMAIN_BLOCKLIST) {
    if (domain.endsWith("." + blocked) || domain === blocked) return true;
  }
  return false;
}

function isOwnWebsiteBlocked(url: string): boolean {
  const domain = extractDomain(url);
  const platformDomains = new Set([
    "roblox.com", "steampowered.com", "steamcommunity.com",
    "apps.apple.com", "itunes.apple.com", "play.google.com",
    "github.com", "github.io", "discord.com", "discord.gg",
    "twitter.com", "x.com", "instagram.com", "facebook.com",
    "youtube.com", "linktr.ee", "wixsite.com", "squarespace.com", "wordpress.com",
  ]);
  if (platformDomains.has(domain)) return true;
  for (const blocked of platformDomains) {
    if (domain.endsWith("." + blocked)) return true;
  }
  return false;
}

function isCompanyBlocked(name: string): boolean {
  const n = name.toLowerCase().trim();
  for (const blocked of COMPANY_BLOCKLIST) {
    if (n === blocked) return true;
    if (blocked.length > 4 && n.includes(blocked)) return true;
    if (blocked.length <= 4) {
      const re = new RegExp(`(?:^|\\s)${blocked}(?:\\s|$|,)`, "i");
      if (re.test(n)) return true;
    }
  }
  return false;
}

function isRejectedGenre(genre: string, title: string, description: string): boolean {
  const g = genre.toLowerCase();
  const t = title.toLowerCase();
  const d = description.toLowerCase().slice(0, 300);

  if (GENRE_REJECT_PRIMARY.has(g)) return true;
  for (const kw of GENRE_REJECT_KEYWORDS) {
    if (g.includes(kw)) return true;
    const re = new RegExp(`\\b${kw.replace(/[-]/g, "[-]?")}\\b`, "i");
    if (re.test(t)) return true;
  }
  const strongReject = ["slot machine", "texas hold", "blackjack", "roulette", "poker chips", "match-3", "match 3", "triple match"];
  for (const kw of strongReject) { if (d.includes(kw)) return true; }
  return false;
}

function classifyEmail(raw: string): { email: string; generic: boolean } | null {
  const m = raw.match(/^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
  if (!m) return null;
  const prefix = m[1].toLowerCase();
  const domain = m[2].toLowerCase();
  if (isDomainBlocked("https://" + domain)) return null;
  const generic = GENERIC_EMAIL_PREFIXES.has(prefix) ||
    [...GENERIC_EMAIL_PREFIXES].some((p) => prefix.startsWith(p + ".") || prefix.startsWith(p + "_"));
  return { email: raw.toLowerCase(), generic };
}

function validHandle(h: string | undefined): string | null {
  if (!h) return null;
  const clean = h.replace(/[/?#].*$/, "").toLowerCase();
  if (BAD_HANDLES.has(clean) || clean.length < 2) return null;
  return h;
}

// ─── Test framework ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

console.log("\n=== Domain/Website Blocklist ===");
assert("github.com is blocked",              isDomainBlocked("https://github.com/foo/bar"));
assert("github.io is blocked",               isDomainBlocked("https://user.github.io"));
assert("roblox.com is blocked",              isDomainBlocked("https://www.roblox.com/groups/123"));
assert("apps.apple.com is blocked",          isDomainBlocked("https://apps.apple.com/us/app/foo/id123"));
assert("steampowered.com is blocked",        isDomainBlocked("https://store.steampowered.com/app/123"));
assert("cloudfront.net is blocked",          isDomainBlocked("https://d2mtkrho8gflik.cloudfront.net"));
assert("Real studio domain not blocked",     !isDomainBlocked("https://stardewvalley.net"));
assert("Real indie dev domain not blocked",  !isDomainBlocked("https://harebrained-schemes.com"));

console.log("\n=== Own Website Blocked (platform URLs) ===");
assert("github.com blocked as own website",      isOwnWebsiteBlocked("https://github.com/studiox"));
assert("roblox.com blocked as own website",      isOwnWebsiteBlocked("https://www.roblox.com/groups/123"));
assert("stardewvalley.net NOT blocked as own website", !isOwnWebsiteBlocked("https://stardewvalley.net"));

console.log("\n=== Company Blocklist ===");
assert("'voodoo' is blocked",            isCompanyBlocked("Voodoo"));
assert("'moon active' is blocked",       isCompanyBlocked("Moon Active"));
assert("'king.com' is blocked",          isCompanyBlocked("King.com"));
assert("'ea games' is blocked",          isCompanyBlocked("EA Games"));
assert("'rollic games' is blocked",      isCompanyBlocked("Rollic Games"));
assert("'playrix' is blocked",           isCompanyBlocked("Playrix"));

// CRITICAL: blocklist must NOT over-match
assert("'Kingdom Rush' NOT blocked by 'King'",   !isCompanyBlocked("Kingdom Rush"), "substring 'king' should not match 'Kingdom'");
assert("'Peak Performance' NOT blocked by 'peak games'", !isCompanyBlocked("Peak Performance Studio"), "");
assert("'Supercell' is blocked",         isCompanyBlocked("Supercell"));
assert("'ConcernedApe' NOT blocked",     !isCompanyBlocked("ConcernedApe"));
assert("'Harebrained Schemes' NOT blocked", !isCompanyBlocked("Harebrained Schemes"));

console.log("\n=== Genre Filter — must REJECT ===");
assert("'Casino' genre rejected",        isRejectedGenre("Casino", "Slot Master", ""));
assert("'Puzzle' genre rejected",        isRejectedGenre("Puzzle", "Block Puzzle", ""));
assert("'Solitaire Associations Journey' rejected",
  isRejectedGenre("Card", "Solitaire Associations Journey", ""));
assert("'Cashman Casino Slots' rejected",
  isRejectedGenre("Casino", "Cashman Casino Slots", ""));
assert("'Block Out! Color Sort Puzzle' rejected",
  isRejectedGenre("Puzzle", "Block Out! - Color Sort Puzzle", ""));
assert("'Blackjack' in description rejected",
  isRejectedGenre("Card", "Card Game", "Try blackjack and poker"));
assert("'match-3' in title rejected",
  isRejectedGenre("Puzzle", "Candy Match-3", ""));

console.log("\n=== Genre Filter — must PASS ===");
assert("'Pixel Gun 3D: Online Shooter' PASSES",
  !isRejectedGenre("Action", "Pixel Gun 3D: Online Shooter", ""));
assert("'Cover Fire: Gun Shooting games' PASSES",
  !isRejectedGenre("Action", "Cover Fire: Gun Shooting games", ""));
assert("'FR3 - Multiplayer Games' PASSES",
  !isRejectedGenre("Action", "FR3 - Multiplayer Games", ""));
assert("'Action' genre PASSES",
  !isRejectedGenre("Action", "Battle Arena", ""));
assert("'Role Playing' genre PASSES",
  !isRejectedGenre("Role Playing", "Anime RPG Simulator", ""));
assert("'Simulation' genre PASSES",
  !isRejectedGenre("Simulation", "Farm Simulator 2024", ""));
assert("'Roblox' genre PASSES",
  !isRejectedGenre("Roblox", "Blox Fruits Tycoon", ""));

console.log("\n=== Email Classifier — must REJECT ===");
assert("contact@github.com rejected",         classifyEmail("contact@github.com") === null);
assert("contact@facebook.com rejected",       classifyEmail("contact@facebook.com") === null);
assert("noreply@discord.com rejected",        classifyEmail("noreply@discord.com") === null);
// Fabricated/cloudfront
const cfResult = classifyEmail("contact@d2mtkrho8gflik.cloudfront.net");
assert("cloudfront email rejected",           cfResult === null);

console.log("\n=== Email Classifier — generic flag ===");
const stardewResult = classifyEmail("support@stardewvalley.net");
assert("support@stardewvalley.net classified as generic",
  stardewResult !== null && stardewResult.generic === true);

const namedResult = classifyEmail("eric@badrockgames.com");
assert("eric@badrockgames.com classified as non-generic",
  namedResult !== null && namedResult.generic === false);

const contactResult = classifyEmail("contact@stardewvalley.net");
assert("contact@stardewvalley.net classified as generic",
  contactResult !== null && contactResult.generic === true);

console.log("\n=== Social Handle Filter ===");
assert("'and' is a bad handle",    validHandle("and") === null);
assert("'https' is a bad handle",  validHandle("https") === null);
assert("'every' is a bad handle",  validHandle("every") === null);
assert("'game' is a bad handle",   validHandle("game") === null);
assert("'battleroyale' is valid",  validHandle("battleroyale") !== null);
assert("'harebrained' is valid",   validHandle("harebrained") !== null);
assert("'ak' is valid (len≥2)",    validHandle("ak") !== null);

// ─── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
