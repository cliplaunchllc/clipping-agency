/**
 * Lead Factory Pipeline
 *
 * Sources (cheapest to free):
 *   - Roblox Games API    → FREE  (no key, public API — includes profile contact enrichment)
 *   - Steam Store API     → FREE  (no key, public API)
 *   - iTunes Search API   → FREE  (no key, Apple public API)
 *   - YouTube Data API v3 → FREE  (10K units/day, needs YOUTUBE_API_KEY)
 *   - Serper.dev          → $0.001/search (Google — contact enrichment + web results)
 *   - Claude Haiku        → $0.00025/1K input + $0.00125/1K output
 *
 * Approximate cost:
 *   bulk  → ~$0.010/lead   (~$0.25 for 25)
 *   deep  → ~$0.035/lead   (~$0.88 for 25)
 */

import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Haiku pricing (per token) ────────────────────────────────────────────────
const HAIKU_IN  = 0.00000025;   // $0.25  / MTok
const HAIKU_OUT = 0.00000125;   // $1.25  / MTok

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

// ─── Claude Haiku ─────────────────────────────────────────────────────────────

async function haiku(prompt: string): Promise<{ text: string; inTok: number; outTok: number }> {
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });
  return {
    text: (res.content[0] as { text: string }).text,
    inTok: res.usage.input_tokens,
    outTok: res.usage.output_tokens,
  };
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

// ─── YouTube ──────────────────────────────────────────────────────────────────

interface YTChannel {
  channelId: string;
  title: string;
  description: string;
  subscriberCount: number;
  customUrl: string;
  country: string;
}

async function ytSearch(query: string, max = 25): Promise<Array<{ channelId: string; title: string; description: string }>> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=${max}&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!res?.ok) return [];
  const data = await res.json() as { items?: Array<{ id: { channelId: string }; snippet: { title: string; description: string } }> };
  return (data.items ?? []).map((i) => ({
    channelId: i.id.channelId,
    title: i.snippet.title,
    description: i.snippet.description?.slice(0, 200) ?? "",
  }));
}

async function ytDetails(ids: string[]): Promise<YTChannel[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || !ids.length) return [];
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${ids.slice(0, 50).join(",")}&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!res?.ok) return [];
  const data = await res.json() as {
    items?: Array<{
      id: string;
      snippet: { title: string; description: string; customUrl: string; country: string };
      statistics: { subscriberCount: string };
    }>;
  };
  return (data.items ?? []).map((i) => ({
    channelId: i.id,
    title: i.snippet.title,
    description: (i.snippet.description ?? "").slice(0, 300),
    subscriberCount: parseInt(i.statistics?.subscriberCount ?? "0"),
    customUrl: i.snippet.customUrl ?? "",
    country: i.snippet.country ?? "",
  }));
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
  const entries = [...seenCreators.entries()].slice(0, 20);
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

// ─── Serper (Google Search) ───────────────────────────────────────────────────

interface WebResult { title: string; link: string; snippet: string }

async function serper(query: string): Promise<WebResult[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: 10 }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!res?.ok) return [];
  const data = await res.json() as { organic?: Array<{ title: string; link: string; snippet: string }> };
  return (data.organic ?? []).map((r) => ({ title: r.title, link: r.link, snippet: r.snippet }));
}

// Pull contact info out of Serper results for a specific lead
async function serperContactEnrich(name: string, website: string): Promise<{ contacts: Contacts; snippets: string }> {
  const query = `"${name}" instagram OR linkedin OR email OR twitter contact`;
  const results = await serper(query);
  const combined = results.map((r) => `${r.title} ${r.snippet} ${r.link}`).join(" ");
  const contacts = extractContacts(combined);

  // Also check if any result links directly to Instagram/LinkedIn
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

  void website; // used for context but searching by name is more reliable
  return { contacts, snippets: combined.slice(0, 600) };
}

// ─── Plan type ────────────────────────────────────────────────────────────────

interface Plan {
  youtubeQueries: string[];
  webQueries: string[];
  robloxQueries: string[];
  steamQueries: string[];
  mobileQueries: string[];
  segments: string[];
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function processLeadRun(runId: string): Promise<void> {
  const run = await prisma.leadRun.findUnique({ where: { id: runId } });
  if (!run) return;

  const hasYT     = !!process.env.YOUTUBE_API_KEY;
  const hasSerper = !!process.env.SERPER_API_KEY;
  const hasAI     = !!process.env.ANTHROPIC_API_KEY;

  if (!hasAI) {
    await setStatus(runId, "failed", "ANTHROPIC_API_KEY not configured");
    return;
  }

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 1: PLANNING
    // ──────────────────────────────────────────────────────────────────────────
    await setStatus(runId, "planning", "Building search strategy…");
    await log(runId, "planning", `Run started: "${run.prompt.slice(0, 80)}"  mode=${run.mode}  count=${run.count}`);

    const planPrompt = `You're a lead researcher for a video clipping agency that creates short-form clips for game developers and creators.
Target audience: "${run.prompt}"
${run.offer ? `Our offer: "${run.offer}"` : ""}
Leads needed: ${run.count}

Generate a search plan as JSON only (no markdown):
{
  "youtubeQueries": ["2-4 YouTube channel search strings for gaming creators"],
  "webQueries": ["2-4 Google search strings for game studios or developers"],
  "robloxQueries": ["2-4 Roblox game keyword searches like 'combat', 'simulator', 'tycoon', 'pvp'"],
  "steamQueries": ["2-4 Steam game searches like 'indie pvp', 'survival game', 'battle royale indie'"],
  "mobileQueries": ["2-4 App Store game searches like 'mobile pvp game', 'idle RPG', 'clicker game'"],
  "segments": ["2-4 segment labels like 'Roblox Developer', 'Indie Game Studio', 'Mobile Game Publisher'"]
}`;

    const planRes = await haiku(planPrompt);
    await trackCost(runId, "anthropic", "planning", planRes.inTok + planRes.outTok, planRes.inTok * HAIKU_IN + planRes.outTok * HAIKU_OUT);

    const plan = parseJSON<Plan>(planRes.text, {
      youtubeQueries: [`${run.prompt} gaming`],
      webQueries: [`${run.prompt} game developer`],
      robloxQueries: ["pvp", "simulator"],
      steamQueries: ["indie game"],
      mobileQueries: ["mobile game"],
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

    // ── Roblox (free, profile descriptions fetched for contacts) ──
    await setStage(runId, "Searching Roblox games…");
    for (const q of plan.robloxQueries) {
      if (await isStopped(runId)) return;
      const results = await robloxSearch(q, 30);
      addMany(results);
      await setStage(runId, `Roblox: ${candidates.filter((c) => c.type === "roblox").length} developers found…`);
    }
    await log(runId, "discovering", `Roblox: ${candidates.filter((c) => c.type === "roblox").length} developers`);

    if (await isStopped(runId)) return;

    // ── Steam (free, support email extracted from appdetails) ──
    await setStage(runId, "Searching Steam…");
    for (const q of plan.steamQueries) {
      if (await isStopped(runId)) return;
      const results = await steamSearch(q, 15);
      addMany(results);
      await setStage(runId, `Steam: ${candidates.filter((c) => c.type === "steam").length} developers found…`);
    }
    await log(runId, "discovering", `Steam: ${candidates.filter((c) => c.type === "steam").length} developers`);

    if (await isStopped(runId)) return;

    // ── iTunes / App Store (free) ──
    await setStage(runId, "Searching App Store…");
    for (const q of plan.mobileQueries) {
      if (await isStopped(runId)) return;
      const results = await itunesSearch(q, 30);
      addMany(results);
      await setStage(runId, `Mobile: ${candidates.filter((c) => c.type === "mobile").length} developers found…`);
    }
    await log(runId, "discovering", `Mobile: ${candidates.filter((c) => c.type === "mobile").length} developers`);

    if (await isStopped(runId)) return;

    // ── YouTube (needs YOUTUBE_API_KEY) ──
    if (hasYT) {
      await setStage(runId, "Searching YouTube channels…");
      const perQuery = Math.ceil((run.count * 1.5) / plan.youtubeQueries.length);
      const allChannelIds: string[] = [];

      for (const q of plan.youtubeQueries) {
        if (await isStopped(runId)) return;
        const ch = await ytSearch(q, Math.min(perQuery + 5, 50));
        allChannelIds.push(...ch.map((c) => c.channelId));
      }

      for (let i = 0; i < allChannelIds.length; i += 50) {
        const batch = await ytDetails(allChannelIds.slice(i, i + 50));
        for (const ch of batch) {
          const contacts = extractContacts(ch.description);
          addCandidate({
            type: "youtube",
            name: ch.title,
            website: ch.customUrl ? `https://youtube.com/${ch.customUrl}` : `https://youtube.com/channel/${ch.channelId}`,
            description: ch.description,
            contacts,
            rawData: ch as unknown as Record<string, unknown>,
          });
        }
      }
      await log(runId, "discovering", `YouTube: ${candidates.filter((c) => c.type === "youtube").length} channels`);
    }

    if (await isStopped(runId)) return;

    // ── Serper / Google web results (needs SERPER_API_KEY) ──
    if (hasSerper) {
      await setStage(runId, "Searching Google…");
      for (const q of plan.webQueries) {
        if (await isStopped(runId)) return;
        const results = await serper(q);
        await trackCost(runId, "serper", "search", 1, 0.001);
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

    await setStage(runId, `Found ${candidates.length} total candidates across all sources`);
    await log(runId, "discovering", `Total: ${candidates.length} candidates`);

    if (candidates.length === 0) {
      await setStatus(runId, "failed", "No candidates found. Check that external APIs are reachable.");
      return;
    }

    if (await isStopped(runId)) return;

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 2.5: CONTACT ENRICHMENT
    // Uses Serper to find email/Instagram/LinkedIn for leads without contacts.
    // Capped at (run.count * 2) enrichments to keep cost predictable.
    // ──────────────────────────────────────────────────────────────────────────
    if (hasSerper) {
      await setStatus(runId, "researching", "Enriching contact info…");

      // Shuffle so we don't just enrich all Roblox — mix sources
      const shuffledForEnrich = [...candidates].sort(() => Math.random() - 0.5);
      const needsEnrich = shuffledForEnrich.filter((c) => !hasContacts(c.contacts));
      const enrichLimit = Math.min(needsEnrich.length, run.count * 2);

      let enriched = 0;
      for (const c of needsEnrich.slice(0, enrichLimit)) {
        if (await isStopped(runId)) return;
        const { contacts, snippets } = await serperContactEnrich(c.name, c.website);
        await trackCost(runId, "serper", "contact_enrich", 1, 0.001);

        if (hasContacts(contacts)) {
          c.contacts = mergeContacts(c.contacts, contacts);
          c.rawData.enrichSnippets = snippets;
          enriched++;
        }

        if (enriched % 5 === 0) {
          await setStage(runId, `Enriching contacts: ${enriched} found so far…`);
        }
      }

      await log(runId, "researching", `Contact enrichment: ${enriched} / ${enrichLimit} leads enriched`);
    }

    if (await isStopped(runId)) return;

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 3: RESEARCH + SCORE
    // ──────────────────────────────────────────────────────────────────────────
    await setStatus(runId, "researching", `Analyzing leads…`);

    let savedCount = 0;
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const toProcess = shuffled.slice(0, Math.min(shuffled.length, run.count * 3));

    for (let i = 0; i < toProcess.length && savedCount < run.count; i++) {
      if (i % 5 === 0 && await isStopped(runId)) return;

      const c = toProcess[i];
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
${contactBlock ? `Known contacts:\n${contactBlock}` : "No contacts found yet — infer what you can."}
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

      try {
        const res = await haiku(analyzePrompt);
        await trackCost(runId, "anthropic", "analyze", res.inTok + res.outTok, res.inTok * HAIKU_IN + res.outTok * HAIKU_OUT);

        const a = parseJSON<{
          company: string; website: string; whatItIs: string; segment: string;
          decisionMaker: string | null; dmRole: string | null; dmEmail: string | null;
          instagramHandle: string | null; xHandle: string | null;
          linkedinUrl: string | null; discordUrl: string | null;
          grade: string; score: number; whyItFits: string; bestChannel: string;
        }>(res.text, null as never);

        if (!a) continue;
        if (run.mode === "bulk" && a.grade === "F") continue;

        savedCount++;

        await prisma.leadFactoryLead.create({
          data: {
            runId,
            num: savedCount,
            company:        a.company        || c.name,
            website:        a.website        || c.website,
            whatItIs:       a.whatItIs       || null,
            segment:        a.segment        || plan.segments[0] || null,
            decisionMaker:  a.decisionMaker  || null,
            dmRole:         a.dmRole         || null,
            dmEmail:        a.dmEmail        || c.contacts.email || null,
            instagramHandle: a.instagramHandle || c.contacts.instagram || null,
            xHandle:        a.xHandle        || c.contacts.twitter || null,
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
            stats: { discovered: candidates.length, processed: i + 1, saved: savedCount },
          },
        });

      } catch (err) {
        await log(runId, "researching", `Skipped "${c.name}": ${String(err).slice(0, 100)}`, "warn");
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
