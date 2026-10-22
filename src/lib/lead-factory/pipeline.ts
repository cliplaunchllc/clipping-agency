/**
 * Lead Factory Pipeline — 100% FREE APIs
 *
 * Sources (all free, no paid keys required):
 *   - Roblox Games API    → FREE  (no key)
 *   - Steam Store API     → FREE  (no key)
 *   - iTunes Search API   → FREE  (no key)
 *   - Invidious           → FREE  (open-source YouTube — no key, no quota)
 *   - GitHub Search API   → FREE  (no key: 60 req/hr · GITHUB_TOKEN: 5000 req/hr)
 *   - Brave Search API    → FREE  (2000 queries/month free · BRAVE_API_KEY)
 *   - Groq LLM            → FREE  (14,400 req/day · GROQ_API_KEY — llama-3.1-8b-instant)
 *
 * Approximate cost: $0 — all free tiers
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

// ─── Hugging Face Inference API (free, open-source models) ───────────────────
// Uses the Messages API (OpenAI-compatible) on HuggingFace serverless inference.
// Model: mistralai/Mistral-7B-Instruct-v0.3 — reliable JSON extraction, always free.
// Sign up free at huggingface.co → Settings → Access Tokens → New token (read).

async function haiku(prompt: string, _deep = false): Promise<{ text: string; inTok: number; outTok: number }> {
  const key = process.env.HF_TOKEN;
  if (!key) throw new Error("HF_TOKEN not set — add it in Railway Variables");

  const model = "mistralai/Mistral-7B-Instruct-v0.3";
  const url = `https://api-inference.huggingface.co/models/${model}/v1/chat/completions`;
  const body = JSON.stringify({
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1500,
    temperature: 0.2,
  });
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${key}` };

  // HuggingFace free tier cold-starts with 503 "Model is currently loading".
  // Retry up to 3 times with 15s waits before giving up.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(60000) }).catch(() => null);

    if (!res) throw new Error("HuggingFace request timed out after 60s");

    if (res.status === 503) {
      const body503 = await res.text().catch(() => "");
      const isLoading = body503.includes("loading") || body503.includes("currently");
      if (isLoading && attempt < 3) {
        await new Promise((r) => setTimeout(r, 15000)); // wait 15s for model to load
        continue;
      }
      throw new Error(`HuggingFace 503 (model unavailable): ${body503.slice(0, 120)}`);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      throw new Error(`HuggingFace error ${res.status}: ${errText.slice(0, 120)}`);
    }

    const data = await res.json() as {
      choices: [{ message: { content: string } }];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    return {
      text: data.choices[0]?.message?.content ?? "",
      inTok: data.usage?.prompt_tokens ?? 0,
      outTok: data.usage?.completion_tokens ?? 0,
    };
  }

  throw new Error("HuggingFace model failed to load after 3 attempts (45s)");
}

function parseJSON<T>(text: string, fallback: T): T {
  try {
    const clean = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(clean) as T;
  } catch {
    return fallback;
  }
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

// ─── Invidious (free open-source YouTube, no key required) ───────────────────
// Falls through multiple public instances until one responds.

const INVIDIOUS_INSTANCES = [
  "https://invidious.fdn.fr",
  "https://invidious.privacydev.net",
  "https://yt.artemislena.eu",
  "https://invidious.nerdvpn.de",
  "https://iv.melmac.space",
];

async function invidiousFetch<T>(path: string): Promise<T | null> {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return await res.json() as T;
    } catch { /* try next instance */ }
  }
  return null;
}

interface InvChannel {
  authorId: string;
  author: string;
  description?: string;
  subCount?: number;
  authorUrl?: string;
}

async function ytSearch(query: string, max = 25): Promise<InvChannel[]> {
  const path = `/api/v1/search?q=${encodeURIComponent(query)}&type=channel&fields=authorId,author,description,subCount,authorUrl`;
  const data = await invidiousFetch<InvChannel[]>(path);
  return (data ?? []).slice(0, max);
}

async function ytChannelDetail(channelId: string): Promise<InvChannel | null> {
  return invidiousFetch<InvChannel>(`/api/v1/channels/${channelId}?fields=authorId,author,description,subCount,authorUrl`);
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

async function robloxSearch(query: string, max = 30): Promise<Candidate[]> {
  const url = `https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(query)}&model.gameFilter=0&model.genreFilter=all&model.maxRows=${max}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!res?.ok) return [];

  const data = await res.json() as { games?: RobloxGame[] };
  const games = data.games ?? [];

  // Deduplicate by creatorId
  const seenCreators = new Map<number, RobloxGame>();
  for (const g of games) {
    if (!seenCreators.has(g.creatorId)) seenCreators.set(g.creatorId, g);
  }

  // Batch-fetch profiles for contact info (parallel, cap at 20 per query)
  const entries = [...seenCreators.entries()].slice(0, 10);
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

    const contacts = extractContacts(desc);

    candidates.push({
      type: "roblox",
      name: g.creatorName,
      website: profileUrl,
      description: `Roblox ${g.creatorType === "Group" ? "studio" : "developer"}. Game: "${g.name}" · ${g.playerCount} concurrent players · ${g.totalUpVotes} upvotes.${desc ? ` Bio: ${desc.slice(0, 200)}` : ""}`,
      contacts,
      rawData: { ...g, profileDesc: desc } as unknown as Record<string, unknown>,
    });
  }
  return candidates;
}

// ─── Steam (FREE — no key required) ──────────────────────────────────────────

async function steamSearch(query: string, max = 15): Promise<Candidate[]> {
  const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&cc=us&l=en`;
  const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!searchRes?.ok) return [];

  const searchData = await searchRes.json() as {
    items?: Array<{ id: number; name: string; type: string }>;
  };
  const games = (searchData.items ?? []).filter((i) => i.type === "game").slice(0, max);
  if (!games.length) return [];

  const candidates: Candidate[] = [];
  const seenDevs = new Set<string>();

  await Promise.allSettled(
    games.map(async (game) => {
      const detUrl = `https://store.steampowered.com/api/appdetails?appids=${game.id}&filters=basic,developers,publishers,support_info,website`;
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
        };
      }>;
      const app = detData[String(game.id)];
      if (!app?.success || !app.data) return;

      const devName = app.data.developers?.[0] ?? app.data.publishers?.[0];
      if (!devName) return;

      const key = devName.toLowerCase().trim();
      if (seenDevs.has(key)) return;
      seenDevs.add(key);

      const supportEmail = app.data.support_info?.email ?? null;
      const contacts: Contacts = {
        email: supportEmail,
        instagram: null,
        twitter: null,
        linkedin: null,
        discord: null,
      };

      candidates.push({
        type: "steam",
        name: devName,
        website: app.data.website ?? `https://store.steampowered.com/app/${game.id}`,
        description: `Steam game developer. Game: "${game.name}". ${app.data.short_description?.slice(0, 250) ?? ""}`.trim(),
        contacts,
        rawData: { appId: game.id, gameName: game.name, supportUrl: app.data.support_info?.url, ...app.data },
      });
    })
  );

  return candidates;
}

// ─── iTunes / App Store (FREE — no key required) ──────────────────────────────

async function itunesSearch(query: string, max = 30): Promise<Candidate[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=software&genreId=6014&limit=${max}&country=us`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!res?.ok) return [];

  const data = await res.json() as {
    results?: Array<{
      trackName: string;
      sellerName: string;
      sellerUrl?: string;
      trackViewUrl: string;
      description?: string;
    }>;
  };

  const seenSellers = new Set<string>();
  const candidates: Candidate[] = [];

  for (const r of data.results ?? []) {
    const key = r.sellerName.toLowerCase().trim();
    if (seenSellers.has(key) || !key) continue;
    seenSellers.add(key);

    const desc = `Mobile game developer (App Store). Game: "${r.trackName}".${r.description ? ` ${r.description.slice(0, 200)}` : ""}`;
    const contacts = extractContacts(r.description ?? "");

    candidates.push({
      type: "mobile",
      name: r.sellerName,
      website: r.sellerUrl ?? r.trackViewUrl,
      description: desc,
      contacts,
      rawData: r as unknown as Record<string, unknown>,
    });
  }
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

// ─── GitHub (FREE — 60 req/hr anonymous, 5000 req/hr with GITHUB_TOKEN) ───────

async function githubSearch(query: string, max = 20): Promise<Candidate[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Search GitHub orgs — game studios almost always use org accounts
  const searchUrl = `https://api.github.com/search/users?q=${encodeURIComponent(query + " type:org")}&per_page=${Math.min(max, 30)}`;
  const res = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!res?.ok) return [];

  const data = await res.json() as { items?: Array<{ login: string }> };
  const items = (data.items ?? []).slice(0, 10); // cap profile fetches to avoid rate limits

  const candidates: Candidate[] = [];
  await Promise.allSettled(items.map(async (user) => {
    const profileRes = await fetch(`https://api.github.com/users/${user.login}`, {
      headers,
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);
    if (!profileRes?.ok) return;

    const p = await profileRes.json() as {
      login: string; name?: string; email?: string; bio?: string;
      blog?: string; twitter_username?: string; html_url: string;
    };

    const website = (p.blog && p.blog.startsWith("http")) ? p.blog : p.html_url;
    const rawText = [p.bio, p.email, p.blog, p.twitter_username].filter(Boolean).join(" ");
    const contacts = extractContacts(rawText);
    if (p.email) contacts.email = p.email;
    if (p.twitter_username) contacts.twitter = `@${p.twitter_username}`;

    candidates.push({
      type: "web",
      name: p.name || p.login,
      website,
      description: `Game studio on GitHub. ${p.bio ?? ""}`.trim(),
      contacts,
      rawData: p as unknown as Record<string, unknown>,
    });
  }));

  return candidates;
}

// ─── Plan type ────────────────────────────────────────────────────────────────

interface Plan {
  youtubeQueries: string[];
  webQueries: string[];
  robloxQueries: string[];
  steamQueries: string[];
  mobileQueries: string[];
  githubQueries: string[];
  segments: string[];
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function processLeadRun(runId: string): Promise<void> {
  const run = await prisma.leadRun.findUnique({ where: { id: runId } });
  if (!run) return;

  const hasAI = !!process.env.HF_TOKEN;

  if (!hasAI) {
    await setStatus(runId, "failed", "HF_TOKEN not configured — get a free token at huggingface.co/settings/tokens");
    return;
  }

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 1: PLANNING
    // ──────────────────────────────────────────────────────────────────────────
    await setStatus(runId, "planning", "Building search strategy…");
    await log(runId, "planning", `Run started: "${run.prompt.slice(0, 80)}"  mode=${run.mode}  count=${run.count}`);

    // Scale query count based on how many leads are requested
    const qCount = run.count <= 50 ? 3 : run.count <= 200 ? 6 : run.count <= 500 ? 10 : 15;

    const planPrompt = `You're a lead researcher for a video clipping agency that creates short-form clips for game developers and creators.
Target audience: "${run.prompt}"
${run.offer ? `Our offer: "${run.offer}"` : ""}
Leads needed: ${run.count}

Generate a search plan as JSON only (no markdown). Each array must have exactly ${qCount} entries — use varied keywords to maximize unique results:
{
  "youtubeQueries": ["${qCount} distinct YouTube channel search strings for gaming creators"],
  "webQueries": ["${qCount} distinct search strings for game studios or developers"],
  "robloxQueries": ["${qCount} distinct Roblox game keyword searches like 'combat', 'simulator', 'tycoon', 'pvp', 'fps', 'roleplay'"],
  "steamQueries": ["${qCount} distinct Steam game searches like 'indie pvp', 'survival game', 'battle royale indie', 'roguelike'"],
  "mobileQueries": ["${qCount} distinct App Store game searches like 'mobile pvp', 'idle RPG', 'clicker', 'gacha', 'strategy'"],
  "githubQueries": ["${qCount} distinct GitHub org search strings like 'game studio', 'indie game developer', 'mobile game'"],
  "segments": ["3-5 segment labels like 'Roblox Developer', 'Indie Game Studio', 'Mobile Game Publisher'"]
}`;

    const planRes = await haiku(planPrompt, true); // use 70b for planning quality
    await trackCost(runId, "huggingface", "planning", planRes.inTok + planRes.outTok, 0);

    const plan = parseJSON<Plan>(planRes.text, {
      youtubeQueries: [`${run.prompt} gaming`],
      webQueries: [`${run.prompt} game developer`],
      robloxQueries: ["pvp", "simulator"],
      steamQueries: ["indie game"],
      mobileQueries: ["mobile game"],
      githubQueries: ["game studio"],
      segments: ["Game Developer"],
    });

    await prisma.leadRun.update({ where: { id: runId }, data: { plan: plan as unknown as Prisma.InputJsonValue } });
    await log(runId, "planning", [
      `YouTube: ${plan.youtubeQueries.length}`,
      `Web: ${plan.webQueries.length}`,
      `Roblox: ${plan.robloxQueries.length}`,
      `Steam: ${plan.steamQueries.length}`,
      `Mobile: ${plan.mobileQueries.length}`,
    ].join("  ·  ") + " queries");

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

    // Scale per-source fetch size with count (need ~3x candidates vs target to filter down)
    const robloxMax  = Math.min(Math.ceil(run.count * 3 / Math.max(plan.robloxQueries.length, 1)), 200);
    const steamMax   = Math.min(Math.ceil(run.count * 2 / Math.max(plan.steamQueries.length, 1)), 50);
    const itunesMax  = Math.min(Math.ceil(run.count * 3 / Math.max(plan.mobileQueries.length, 1)), 200);

    // ── Roblox (free, profile descriptions fetched for contacts) ──
    await setStage(runId, "Searching Roblox games…");
    for (const q of plan.robloxQueries) {
      if (await isStopped(runId)) return;
      const results = await robloxSearch(q, robloxMax);
      addMany(results);
      await setStage(runId, `Roblox: ${candidates.filter((c) => c.type === "roblox").length} developers found…`);
    }
    await log(runId, "discovering", `Roblox: ${candidates.filter((c) => c.type === "roblox").length} developers`);

    if (await isStopped(runId)) return;

    // ── Steam (free, support email extracted from appdetails) ──
    await setStage(runId, "Searching Steam…");
    for (const q of plan.steamQueries) {
      if (await isStopped(runId)) return;
      const results = await steamSearch(q, steamMax);
      addMany(results);
      await setStage(runId, `Steam: ${candidates.filter((c) => c.type === "steam").length} developers found…`);
    }
    await log(runId, "discovering", `Steam: ${candidates.filter((c) => c.type === "steam").length} developers`);

    if (await isStopped(runId)) return;

    // ── iTunes / App Store (free) ──
    await setStage(runId, "Searching App Store…");
    for (const q of plan.mobileQueries) {
      if (await isStopped(runId)) return;
      const results = await itunesSearch(q, itunesMax);
      addMany(results);
      await setStage(runId, `Mobile: ${candidates.filter((c) => c.type === "mobile").length} developers found…`);
    }
    await log(runId, "discovering", `Mobile: ${candidates.filter((c) => c.type === "mobile").length} developers`);

    if (await isStopped(runId)) return;

    // ── YouTube via Invidious (free, no key required) ──
    await setStage(runId, "Searching YouTube channels…");
    const perQuery = Math.ceil((run.count * 1.5) / Math.max(plan.youtubeQueries.length, 1));
    for (const q of plan.youtubeQueries) {
      if (await isStopped(runId)) return;
      const channels = await ytSearch(q, Math.min(perQuery + 5, 50));
      // Fetch full channel detail for description/sub count (in parallel, capped at 10)
      await Promise.allSettled(channels.slice(0, 10).map(async (ch) => {
        const detail = await ytChannelDetail(ch.authorId) ?? ch;
        const contacts = extractContacts(detail.description ?? "");
        addCandidate({
          type: "youtube",
          name: detail.author,
          website: `https://youtube.com/channel/${detail.authorId}`,
          description: (detail.description ?? "").slice(0, 300),
          contacts,
          rawData: detail as unknown as Record<string, unknown>,
        });
      }));
    }
    await log(runId, "discovering", `YouTube: ${candidates.filter((c) => c.type === "youtube").length} channels`);

    if (await isStopped(runId)) return;

    // ── Brave Search (free web results) ──
    if (true) {
      await setStage(runId, "Searching web…");
      for (const q of plan.webQueries) {
        if (await isStopped(runId)) return;
        const results = await braveSearch(q);
        await trackCost(runId, "brave", "search", 1, 0);
        for (const r of results) {
          try {
            const host = new URL(r.link.startsWith("http") ? r.link : `https://${r.link}`).hostname;
            const contacts = extractContacts(`${r.title} ${r.snippet}`);
            addCandidate({
              type: "web",
              name: r.title.replace(/ [-|].*/, "").trim(),
              website: r.link,
              description: r.snippet,
              contacts,
              rawData: { ...r, host },
            });
          } catch { /* skip invalid URLs */ }
        }
      }
      await log(runId, "discovering", `Web: ${candidates.filter((c) => c.type === "web").length} results`);
    }

    if (await isStopped(runId)) return;

    // ── GitHub orgs (free, no key required — GITHUB_TOKEN increases rate limit) ──
    await setStage(runId, "Searching GitHub…");
    for (const q of (plan.githubQueries ?? [])) {
      if (await isStopped(runId)) return;
      const results = await githubSearch(q, 20);
      addMany(results);
      await setStage(runId, `GitHub: ${candidates.filter((c) => c.type === "web").length} studios found…`);
    }
    await log(runId, "discovering", `GitHub: ${candidates.filter((c) => c.rawData?.html_url !== undefined).length} orgs`);

    await setStage(runId, `Found ${candidates.length} total candidates across all sources`);
    await log(runId, "discovering", `Total: ${candidates.length} candidates`);

    if (candidates.length === 0) {
      await setStatus(runId, "failed", "No candidates found. Check that external APIs are reachable.");
      return;
    }

    if (await isStopped(runId)) return;

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 2.5: FREE DOMAIN INFERENCE (no Serper cost here)
    // Serper enrichment happens POST-score — only on leads that actually pass.
    // ──────────────────────────────────────────────────────────────────────────
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

    const HAIKU_BATCH = 10; // parallel Haiku calls per batch

    type Analysis = {
      company: string; website: string; whatItIs: string; segment: string;
      decisionMaker: string | null; dmRole: string | null; dmEmail: string | null;
      instagramHandle: string | null; xHandle: string | null;
      linkedinUrl: string | null; discordUrl: string | null;
      grade: string; score: number; whyItFits: string; bestChannel: string;
    };

    for (let i = 0; i < toProcess.length && savedCount < run.count; i += HAIKU_BATCH) {
      if (await isStopped(runId)) return;

      const batch = toProcess.slice(i, Math.min(i + HAIKU_BATCH, toProcess.length));

      // Score the whole batch in parallel
      const batchResults = await Promise.allSettled(batch.map(async (c) => {
        const sourceLabel = {
          roblox: "Roblox developer",
          steam: "Steam game developer",
          mobile: "Mobile game developer",
          youtube: "YouTube creator",
          web: "company/creator",
        }[c.type];

        const contactBlock = [
          c.contacts.email     && `Email: ${c.contacts.email}`,
          c.contacts.instagram && `Instagram: ${c.contacts.instagram}`,
          c.contacts.twitter   && `Twitter/X: ${c.contacts.twitter}`,
          c.contacts.linkedin  && `LinkedIn: ${c.contacts.linkedin}`,
          c.contacts.discord   && `Discord: ${c.contacts.discord}`,
        ].filter(Boolean).join("\n");

        const analyzePrompt = `Analyze this lead for a video/clipping agency that makes short-form clips for game companies and creators.

Looking for: "${run.prompt}"
${run.offer ? `Our offer: "${run.offer}"` : ""}

Lead type: ${sourceLabel}
Name: ${c.name}
URL: ${c.website}
About: ${c.description.slice(0, 300)}
${contactBlock ? `Known contacts:\n${contactBlock}` : "No contacts yet."}
${run.mode === "deep" ? `Extra data: ${JSON.stringify(c.rawData).slice(0, 500)}` : ""}

Return ONLY this JSON (use null if unknown, do NOT guess emails):
{
  "company": "clean name",
  "website": "best URL for this lead",
  "whatItIs": "1 sentence description",
  "segment": "segment label",
  "decisionMaker": "owner/developer name if known, else null",
  "dmRole": "title or null",
  "dmEmail": "email only if confirmed above, else null",
  "instagramHandle": "@handle if confirmed above, else null",
  "xHandle": "@handle if confirmed above, else null",
  "linkedinUrl": "full linkedin URL if confirmed above, else null",
  "discordUrl": "discord invite if confirmed above, else null",
  "grade": "A|B|C|D|F",
  "score": 0-100,
  "whyItFits": "why this lead needs video clips",
  "bestChannel": "instagram|email|youtube|discord|direct"
}

Grade: A=perfect fit + has contact info, B=good fit, C=possible, D=weak, F=skip`;

        const res = await haiku(analyzePrompt, run.mode === "deep");
        await trackCost(runId, "huggingface", "analyze", res.inTok + res.outTok, 0);
        return { c, a: parseJSON<Analysis>(res.text, null as never) };
      }));

      // Process scored results — enrich with Serper only for passing leads
      for (const result of batchResults) {
        if (savedCount >= run.count) break;
        if (result.status !== "fulfilled") continue;

        const { c, a } = result.value;
        if (!a) continue;
        if (run.mode === "bulk" && a.grade === "F") continue;

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
            stats: { discovered: candidates.length, processed: Math.min(i + HAIKU_BATCH, toProcess.length), saved: savedCount },
          },
        });
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DONE
    // ──────────────────────────────────────────────────────────────────────────
    const final = await prisma.leadRun.findUnique({ where: { id: runId }, select: { totalCost: true } });

    await prisma.leadRun.update({
      where: { id: runId },
      data: {
        status: "completed",
        stage: null,
        stats: { discovered: candidates.length, saved: savedCount, totalCost: final?.totalCost ?? 0 },
      },
    });

    await log(runId, "completed", `✓ ${savedCount} leads · $${(final?.totalCost ?? 0).toFixed(4)} total cost`);

  } catch (err) {
    const msg = String(err).slice(0, 300);
    await log(runId, "failed", msg, "error");
    await prisma.leadRun.update({ where: { id: runId }, data: { status: "failed", stage: msg } }).catch(() => {});
  }
}
