#!/usr/bin/env ts-node
/**
 * Lead Factory API Health Check
 * Usage: npx ts-node --project tsconfig.worker.json scripts/health-check.ts
 *
 * Tests every external source the pipeline depends on.
 * Caches raw responses to ./scripts/.health-cache/ so reruns don't re-hit APIs.
 * Never prints API key values.
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";

const CACHE_DIR = path.join(__dirname, ".health-cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const SCRAPE_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Result {
  source: string;
  endpoint: string;
  keyRequired: boolean;
  keyPresent: boolean;
  status: "OK" | "FAIL" | "BLOCKED" | "RATE-LIMITED" | "DEPRECATED" | "SKIP";
  httpCode: number | null;
  responseTimeMs: number | null;
  sample: string;
  fixNeeded: string;
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

function cacheKey(url: string): string {
  return url.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 120) + ".json";
}

function readCache(url: string): { code: number; body: string; ms: number } | null {
  const file = path.join(CACHE_DIR, cacheKey(url));
  if (!fs.existsSync(file)) return null;
  const age = Date.now() - fs.statSync(file).mtimeMs;
  if (age > 3600_000) return null; // expire after 1 hour
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeCache(url: string, data: { code: number; body: string; ms: number }) {
  const file = path.join(CACHE_DIR, cacheKey(url));
  fs.writeFileSync(file, JSON.stringify(data));
}

// ─── Fetch with cache ─────────────────────────────────────────────────────────

async function fetchUrl(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string>; useCache?: boolean } = {}
): Promise<{ code: number; body: string; ms: number }> {
  const { timeoutMs = 10_000, headers = {}, useCache = true } = opts;

  if (useCache) {
    const cached = readCache(url);
    if (cached) return cached;
  }

  const start = Date.now();
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const reqHeaders = {
      "User-Agent": SCRAPE_UA,
      Accept: "application/json, text/html, */*",
      ...headers,
    };

    const timer = setTimeout(() => {
      resolve({ code: -1, body: "TIMEOUT", ms: timeoutMs });
    }, timeoutMs);

    const lib = urlObj.protocol === "https:" ? https : require("http");
    const req = lib.get(
      { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, headers: reqHeaders },
      (res: any) => {
        clearTimeout(timer);
        const chunks: Buffer[] = [];
        res.on("data", (d: Buffer) => chunks.push(d));
        res.on("end", () => {
          const ms = Date.now() - start;
          const body = Buffer.concat(chunks).toString("utf8").slice(0, 2000);
          const result = { code: res.statusCode ?? 0, body, ms };
          if (useCache && res.statusCode === 200) writeCache(url, result);
          resolve(result);
        });
      }
    );
    req.on("error", (e: Error) => {
      clearTimeout(timer);
      resolve({ code: -1, body: e.message, ms: Date.now() - start });
    });
  });
}

function shortSample(body: string, maxLen = 120): string {
  return body.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function classify(
  code: number,
  body: string
): Pick<Result, "status" | "fixNeeded"> {
  if (code === -1) return { status: "FAIL", fixNeeded: body.includes("TIMEOUT") ? "Request timed out — endpoint may be slow or blocked" : `Network error: ${body.slice(0, 80)}` };
  if (code === 200) {
    if (body.includes("Access denied") || body.includes("cf-challenge") || body.includes("Just a moment")) return { status: "BLOCKED", fixNeeded: "Cloudflare or WAF blocking server IP — need proxy or alternative endpoint" };
    if (body.includes('"error"') && body.includes('"Unauthorized"')) return { status: "BLOCKED", fixNeeded: "Requires authentication" };
    return { status: "OK", fixNeeded: "" };
  }
  if (code === 401 || code === 403) return { status: "BLOCKED", fixNeeded: "Auth required or IP blocked" };
  if (code === 429) return { status: "RATE-LIMITED", fixNeeded: "Rate limited — add backoff and retry" };
  if (code === 404) return { status: "FAIL", fixNeeded: "Endpoint 404 — may be deprecated or URL changed" };
  if (code === 410) return { status: "DEPRECATED", fixNeeded: "Endpoint gone (410) — find replacement" };
  if (code >= 500) return { status: "FAIL", fixNeeded: `Server error ${code}` };
  return { status: "FAIL", fixNeeded: `HTTP ${code}` };
}

// ─── Individual source tests ──────────────────────────────────────────────────

async function checkSteamSpy(): Promise<Result[]> {
  const results: Result[] = [];

  for (const [label, req] of [
    ["SteamSpy top100in2weeks", "https://steamspy.com/api.php?request=top100in2weeks"],
    ["SteamSpy top100forever", "https://steamspy.com/api.php?request=top100forever"],
  ] as [string, string][]) {
    const r = await fetchUrl(req);
    let sample = "empty";
    let extra = classify(r.code, r.body);
    if (r.code === 200) {
      try {
        const data = JSON.parse(r.body);
        const keys = Object.keys(data);
        if (keys.length > 0) {
          const first = data[keys[0]];
          sample = `${keys.length} games · first: ${first?.name ?? "?"} (appid ${first?.appid ?? "?"})`;
        } else {
          extra = { status: "FAIL", fixNeeded: "Returned empty object — endpoint may have changed" };
          sample = "empty JSON object";
        }
      } catch {
        extra = { status: "FAIL", fixNeeded: "JSON parse failed" };
        sample = shortSample(r.body);
      }
    }
    results.push({
      source: "SteamSpy",
      endpoint: req,
      keyRequired: false,
      keyPresent: false,
      ...extra,
      httpCode: r.code,
      responseTimeMs: r.ms,
      sample,
      fixNeeded: extra.fixNeeded,
    });
  }

  return results;
}

async function checkSteamAppDetails(): Promise<Result> {
  // Test with a known game: Baldur's Gate 3 (appid 1086940)
  const url = "https://store.steampowered.com/api/appdetails?appids=1086940&filters=basic,genres,developers,support_info,website,release_date";
  const r = await fetchUrl(url);
  let sample = shortSample(r.body);
  const extra = classify(r.code, r.body);
  if (r.code === 200) {
    try {
      const data = JSON.parse(r.body);
      const app = data["1086940"];
      if (app?.success) {
        sample = `"${app.data?.name}" · dev: ${app.data?.developers?.[0]} · website: ${app.data?.website ?? "none"} · support: ${app.data?.support_info?.email ?? "none"}`;
      } else {
        sample = "success=false";
      }
    } catch { /* keep raw */ }
  }
  return { source: "Steam App Details", endpoint: url, keyRequired: false, keyPresent: false, ...extra, httpCode: r.code, responseTimeMs: r.ms, sample, fixNeeded: extra.fixNeeded };
}

async function checkRobloxSorts(): Promise<Result> {
  const url = "https://games.roblox.com/v1/games/sorts?GameSortsContext=GamesDefaultSorts";
  const r = await fetchUrl(url, { headers: { Referer: "https://www.roblox.com/", Origin: "https://www.roblox.com" } });
  let sample = shortSample(r.body);
  const extra = classify(r.code, r.body);
  if (r.code === 200) {
    try {
      const data = JSON.parse(r.body);
      const sorts = data.sorts ?? [];
      sample = `${sorts.length} sort tokens · first: "${sorts[0]?.name ?? "?"}"`;
    } catch { /* keep raw */ }
  }
  return { source: "Roblox Sorts API", endpoint: url, keyRequired: false, keyPresent: false, ...extra, httpCode: r.code, responseTimeMs: r.ms, sample, fixNeeded: extra.fixNeeded };
}

async function checkRobloxGamesList(): Promise<Result> {
  const url = "https://games.roblox.com/v1/games/list?model.sortToken=&model.gameFilter=0&model.genreFilter=0&model.keyword=&model.maxRows=10";
  const r = await fetchUrl(url, { headers: { Referer: "https://www.roblox.com/", Origin: "https://www.roblox.com" } });
  let sample = shortSample(r.body);
  let extra = classify(r.code, r.body);
  if (r.code === 200) {
    try {
      const data = JSON.parse(r.body);
      const games = data.games ?? data.data ?? data.items ?? [];
      if (games.length > 0) {
        sample = `${games.length} games · first: "${games[0]?.name}" (${games[0]?.placeId ?? games[0]?.rootPlaceId ?? games[0]?.id}) · playing: ${games[0]?.playerCount ?? games[0]?.playing ?? "?"}`;
      } else {
        extra = { status: "BLOCKED", fixNeeded: "Returns empty games array — endpoint requires .ROBLOSECURITY session cookie. Use the Roblox Games API v2 or catalog API instead, or skip Roblox as a source." };
        sample = shortSample(r.body);
      }
    } catch { /* keep raw */ }
  }
  return { source: "Roblox Games List", endpoint: url, keyRequired: false, keyPresent: false, ...extra, httpCode: r.code, responseTimeMs: r.ms, sample, fixNeeded: extra.fixNeeded };
}

async function checkRobloxGamesV2(): Promise<Result> {
  // Try the v2 games endpoint which is more permissive
  const url = "https://games.roblox.com/v2/games?universeIds=1537690962";
  const r = await fetchUrl(url, { headers: { Referer: "https://www.roblox.com/" } });
  let sample = shortSample(r.body);
  const extra = classify(r.code, r.body);
  if (r.code === 200) {
    try {
      const data = JSON.parse(r.body);
      sample = `data: ${JSON.stringify(data).slice(0, 100)}`;
    } catch { /* keep raw */ }
  }
  return { source: "Roblox Games V2", endpoint: url, keyRequired: false, keyPresent: false, ...extra, httpCode: r.code, responseTimeMs: r.ms, sample, fixNeeded: extra.fixNeeded };
}

async function checkRolimons(): Promise<Result> {
  const url = "https://www.rolimons.com/gameapi/games";
  const r = await fetchUrl(url, { timeoutMs: 8000 });
  let sample = shortSample(r.body);
  const extra = classify(r.code, r.body);
  if (r.code === 200) {
    try {
      const data = JSON.parse(r.body);
      const gameIds = Object.keys(data.games ?? data ?? {});
      sample = `${gameIds.length} games`;
    } catch { sample = shortSample(r.body); }
  }
  return { source: "Rolimons Game API", endpoint: url, keyRequired: false, keyPresent: false, ...extra, httpCode: r.code, responseTimeMs: r.ms, sample, fixNeeded: extra.fixNeeded };
}

async function checkAppStoreRSS(): Promise<Result[]> {
  const results: Result[] = [];
  const charts: [string, string][] = [
    ["App Store RSS topgrossing games (US, genre=6014)", "https://itunes.apple.com/us/rss/topgrossingapplications/limit=10/genre=6014/json"],
    ["App Store RSS topfree games (US, genre=6014)", "https://itunes.apple.com/us/rss/topfreeapplications/limit=10/genre=6014/json"],
    ["App Store RSS subcategory Action (7001)", "https://itunes.apple.com/us/rss/topgrossingapplications/limit=10/genre=7001/json"],
  ];

  for (const [label, url] of charts) {
    const r = await fetchUrl(url);
    let sample = shortSample(r.body);
    const extra = classify(r.code, r.body);
    if (r.code === 200) {
      try {
        const data = JSON.parse(r.body);
        const entries = data.feed?.entry ?? [];
        if (entries.length > 0) {
          sample = `${entries.length} entries · first: "${entries[0]["im:name"]?.label}" by "${entries[0]["im:artist"]?.label}"`;
        } else {
          sample = "feed exists but 0 entries — chart may be empty or genre invalid";
        }
      } catch { /* keep raw */ }
    }
    results.push({ source: label, endpoint: url, keyRequired: false, keyPresent: false, ...extra, httpCode: r.code, responseTimeMs: r.ms, sample, fixNeeded: extra.fixNeeded });
  }
  return results;
}

async function checkItunesLookup(): Promise<Result> {
  // Clash of Clans (529479): known big mobile game
  const url = "https://itunes.apple.com/lookup?id=529479&country=us";
  const r = await fetchUrl(url);
  let sample = shortSample(r.body);
  const extra = classify(r.code, r.body);
  if (r.code === 200) {
    try {
      const data = JSON.parse(r.body);
      const result = data.results?.[0];
      if (result) {
        sample = `"${result.trackName}" by "${result.sellerName}" · updated: ${result.currentVersionReleaseDate ?? "unknown"} · ratings: ${result.userRatingCount ?? "?"} · sellerUrl: ${result.sellerUrl ?? "none"}`;
      }
    } catch { /* keep raw */ }
  }
  return { source: "iTunes Lookup API", endpoint: url, keyRequired: false, keyPresent: false, ...extra, httpCode: r.code, responseTimeMs: r.ms, sample, fixNeeded: extra.fixNeeded };
}

async function checkSearXNG(): Promise<Result[]> {
  const instances = [
    "https://searx.be",
    "https://search.inetol.net",
    "https://searxng.site",
    "https://opnxng.com",
    "https://search.bus-hit.me",
  ];

  const results: Result[] = [];
  for (const base of instances) {
    const url = `${base}/search?q=supercell+contact+email&format=json&categories=general&language=en`;
    const r = await fetchUrl(url, { timeoutMs: 8000 });
    let sample = shortSample(r.body);
    let extra = classify(r.code, r.body);

    if (r.code === 200) {
      try {
        const data = JSON.parse(r.body);
        const hits = (data.results ?? []).length;
        if (hits > 0) {
          sample = `${hits} results · first: "${data.results[0].title}"`;
        } else {
          extra = { status: "FAIL", fixNeeded: "Returns 200 but 0 results — instance may be degraded" };
          sample = "0 results";
        }
      } catch {
        extra = { status: "FAIL", fixNeeded: "JSON parse failed — may return HTML or be rate-limiting" };
        sample = shortSample(r.body);
      }
    }

    results.push({ source: `SearXNG (${base})`, endpoint: url, keyRequired: false, keyPresent: false, ...extra, httpCode: r.code, responseTimeMs: r.ms, sample, fixNeeded: extra.fixNeeded });
  }
  return results;
}

async function checkEnvKeys(): Promise<Result[]> {
  const keys = [
    { name: "ANTHROPIC_API_KEY", label: "Anthropic API (Claude)" },
    { name: "HUNTER_API_KEY", label: "Hunter.io (email lookup)" },
    { name: "APOLLO_API_KEY", label: "Apollo.io (contacts)" },
    { name: "CRUNCHBASE_API_KEY", label: "Crunchbase (funding data)" },
    { name: "APPMAGIC_API_KEY", label: "AppMagic (mobile analytics)" },
  ];

  return keys.map(({ name, label }) => ({
    source: label,
    endpoint: "(env check only)",
    keyRequired: true,
    keyPresent: !!process.env[name],
    status: process.env[name] ? "OK" : "SKIP",
    httpCode: null,
    responseTimeMs: null,
    sample: process.env[name] ? "Key present" : "Key not set — feature disabled",
    fixNeeded: process.env[name] ? "" : `Set ${name} in .env to enable this feature`,
  }));
}

// ─── Print table ──────────────────────────────────────────────────────────────

function padEnd(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function printTable(results: Result[]) {
  const cols = [
    { key: "source",       label: "Source",         w: 36 },
    { key: "status",       label: "Status",         w: 14 },
    { key: "httpCode",     label: "HTTP",           w: 6 },
    { key: "responseTimeMs", label: "Time(ms)",     w: 9 },
    { key: "keyRequired",  label: "Key?",           w: 5 },
    { key: "keyPresent",   label: "Present?",       w: 8 },
    { key: "sample",       label: "Sample",         w: 60 },
    { key: "fixNeeded",    label: "Fix",            w: 55 },
  ] as const;

  const sep = cols.map((c) => "-".repeat(c.w)).join("+");
  const header = cols.map((c) => padEnd(c.label, c.w)).join("|");
  console.log("\n" + sep);
  console.log(header);
  console.log(sep);

  for (const row of results) {
    const statusIcon = row.status === "OK" ? "✓ OK" : row.status === "SKIP" ? "– SKIP" : `✗ ${row.status}`;
    const line = cols.map((c) => {
      const v =
        c.key === "status" ? statusIcon :
        c.key === "keyRequired" ? (row.keyRequired ? "Yes" : "No") :
        c.key === "keyPresent" ? (row.keyPresent ? "Yes" : "No") :
        c.key === "httpCode" ? (row.httpCode === null ? "-" : String(row.httpCode)) :
        c.key === "responseTimeMs" ? (row.responseTimeMs === null ? "-" : String(row.responseTimeMs)) :
        String((row as any)[c.key] ?? "");
      return padEnd(v, c.w);
    }).join("|");
    console.log(line);
  }
  console.log(sep);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function printSummary(results: Result[]) {
  const ok    = results.filter((r) => r.status === "OK").length;
  const fail  = results.filter((r) => r.status === "FAIL").length;
  const blocked = results.filter((r) => r.status === "BLOCKED").length;
  const rl    = results.filter((r) => r.status === "RATE-LIMITED").length;
  const skip  = results.filter((r) => r.status === "SKIP").length;

  console.log(`\nSUMMARY: ${ok} OK · ${fail} FAIL · ${blocked} BLOCKED · ${rl} RATE-LIMITED · ${skip} SKIP (key not set)`);
  console.log("");

  const needsFix = results.filter((r) => r.fixNeeded);
  if (needsFix.length) {
    console.log("FIXES NEEDED:");
    for (const r of needsFix) {
      console.log(`  [${r.source}] ${r.fixNeeded}`);
    }
  } else {
    console.log("No fixes needed — all sources healthy!");
  }
  console.log("");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Lead Factory API Health Check ===");
  console.log(`Running at ${new Date().toISOString()}`);
  console.log(`Cache dir: ${CACHE_DIR} (TTL: 1 hour)\n`);

  const allResults: Result[] = [];

  process.stdout.write("Checking SteamSpy... ");
  allResults.push(...await checkSteamSpy());
  console.log("done");

  process.stdout.write("Checking Steam App Details... ");
  allResults.push(await checkSteamAppDetails());
  console.log("done");

  process.stdout.write("Checking Roblox Sorts API... ");
  allResults.push(await checkRobloxSorts());
  console.log("done");

  process.stdout.write("Checking Roblox Games List... ");
  allResults.push(await checkRobloxGamesList());
  console.log("done");

  process.stdout.write("Checking Roblox Games V2... ");
  allResults.push(await checkRobloxGamesV2());
  console.log("done");

  process.stdout.write("Checking Rolimons... ");
  allResults.push(await checkRolimons());
  console.log("done");

  process.stdout.write("Checking App Store RSS... ");
  allResults.push(...await checkAppStoreRSS());
  console.log("done");

  process.stdout.write("Checking iTunes Lookup... ");
  allResults.push(await checkItunesLookup());
  console.log("done");

  process.stdout.write("Checking SearXNG instances... ");
  allResults.push(...await checkSearXNG());
  console.log("done");

  process.stdout.write("Checking env keys... ");
  allResults.push(...await checkEnvKeys());
  console.log("done");

  printTable(allResults);
  printSummary(allResults);
}

main().catch((e) => { console.error("Health check failed:", e); process.exit(1); });
