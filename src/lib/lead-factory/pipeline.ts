/**
 * Lead Factory Pipeline
 *
 * Sources (cheapest to free):
 *   - Roblox Games API    → FREE  (no key, public API)
 *   - Steam Store API     → FREE  (no key, public API)
 *   - iTunes Search API   → FREE  (no key, Apple public API)
 *   - YouTube Data API v3 → FREE  (10K units/day, needs YOUTUBE_API_KEY)
 *   - Serper.dev          → $0.001/search (Google results, needs SERPER_API_KEY)
 *   - Claude Haiku        → $0.00025/1K input + $0.00125/1K output
 *
 * Approximate cost:
 *   bulk  → ~$0.008/lead   (~$0.20 for 25)
 *   deep  → ~$0.032/lead   (~$0.80 for 25)
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

// ─── Candidate type ───────────────────────────────────────────────────────────

interface Candidate {
  type: "youtube" | "web" | "roblox" | "steam" | "mobile";
  name: string;
  website: string;
  description: string;
  email: string | null;
  rawData: Record<string, unknown>;
}

// ─── YouTube ──────────────────────────────────────────────────────────────────

interface YTChannel {
  channelId: string;
  title: string;
  description: string;
  subscriberCount: number;
  customUrl: string;
  country: string;
  email: string | null;
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
  return (data.items ?? []).map((i) => {
    const desc = i.snippet.description ?? "";
    const emailMatch = desc.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return {
      channelId: i.id,
      title: i.snippet.title,
      description: desc.slice(0, 300),
      subscriberCount: parseInt(i.statistics?.subscriberCount ?? "0"),
      customUrl: i.snippet.customUrl ?? "",
      country: i.snippet.country ?? "",
      email: emailMatch ? emailMatch[0] : null,
    };
  });
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

async function robloxSearch(query: string, max = 30): Promise<Candidate[]> {
  const url = `https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(query)}&model.gameFilter=0&model.genreFilter=all&model.maxRows=${max}`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!res?.ok) return [];

  const data = await res.json() as { games?: RobloxGame[] };
  const games = data.games ?? [];

  // Deduplicate by creatorId — only one entry per developer
  const seenCreators = new Map<number, true>();
  const candidates: Candidate[] = [];

  for (const g of games) {
    if (seenCreators.has(g.creatorId)) continue;
    seenCreators.set(g.creatorId, true);

    const profileUrl = g.creatorType === "Group"
      ? `https://www.roblox.com/groups/${g.creatorId}`
      : `https://www.roblox.com/users/${g.creatorId}/profile`;

    candidates.push({
      type: "roblox",
      name: g.creatorName,
      website: profileUrl,
      description: `Roblox ${g.creatorType === "Group" ? "studio" : "developer"}. Game: "${g.name}" · ${g.playerCount} concurrent players · ${g.totalUpVotes} upvotes`,
      email: null,
      rawData: g as unknown as Record<string, unknown>,
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

  // Fetch developer info for each game (parallel, best-effort)
  const candidates: Candidate[] = [];
  const seenDevs = new Set<string>();

  await Promise.allSettled(
    games.map(async (game) => {
      const detUrl = `https://store.steampowered.com/api/appdetails?appids=${game.id}&filters=basic,developers,publishers`;
      const detRes = await fetch(detUrl, { signal: AbortSignal.timeout(8000) }).catch(() => null);
      if (!detRes?.ok) return;

      const detData = await detRes.json() as Record<string, {
        success: boolean;
        data?: {
          developers?: string[];
          publishers?: string[];
          short_description?: string;
          website?: string;
        };
      }>;
      const app = detData[String(game.id)];
      if (!app?.success || !app.data) return;

      const devName = app.data.developers?.[0] ?? app.data.publishers?.[0];
      if (!devName) return;

      const key = devName.toLowerCase().trim();
      if (seenDevs.has(key)) return;
      seenDevs.add(key);

      candidates.push({
        type: "steam",
        name: devName,
        website: app.data.website ?? `https://store.steampowered.com/app/${game.id}`,
        description: `Steam game developer. Game: "${game.name}". ${app.data.short_description?.slice(0, 250) ?? ""}`.trim(),
        email: null,
        rawData: { appId: game.id, gameName: game.name, ...app.data },
      });
    })
  );

  return candidates;
}

// ─── iTunes / App Store (FREE — no key required) ──────────────────────────────

async function itunesSearch(query: string, max = 30): Promise<Candidate[]> {
  // genreId 6014 = Games
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

    candidates.push({
      type: "mobile",
      name: r.sellerName,
      website: r.sellerUrl ?? r.trackViewUrl,
      description: `Mobile game developer (App Store). Game: "${r.trackName}".${r.description ? ` ${r.description.slice(0, 200)}` : ""}`,
      email: null,
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

    // ── Roblox (free, always runs) ──
    await setStage(runId, "Searching Roblox games…");
    for (const q of plan.robloxQueries) {
      if (await isStopped(runId)) return;
      const results = await robloxSearch(q, 30);
      addMany(results);
      await setStage(runId, `Roblox: ${candidates.filter((c) => c.type === "roblox").length} developers found…`);
    }
    await log(runId, "discovering", `Roblox: ${candidates.filter((c) => c.type === "roblox").length} developers`);

    if (await isStopped(runId)) return;

    // ── Steam (free, always runs) ──
    await setStage(runId, "Searching Steam…");
    for (const q of plan.steamQueries) {
      if (await isStopped(runId)) return;
      const results = await steamSearch(q, 15);
      addMany(results);
      await setStage(runId, `Steam: ${candidates.filter((c) => c.type === "steam").length} developers found…`);
    }
    await log(runId, "discovering", `Steam: ${candidates.filter((c) => c.type === "steam").length} developers`);

    if (await isStopped(runId)) return;

    // ── iTunes / App Store (free, always runs) ──
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
          addCandidate({
            type: "youtube",
            name: ch.title,
            website: ch.customUrl ? `https://youtube.com/${ch.customUrl}` : `https://youtube.com/channel/${ch.channelId}`,
            description: ch.description,
            email: ch.email,
            rawData: ch as unknown as Record<string, unknown>,
          });
        }
      }
      await log(runId, "discovering", `YouTube: ${candidates.filter((c) => c.type === "youtube").length} channels`);
    }

    if (await isStopped(runId)) return;

    // ── Serper / Google (needs SERPER_API_KEY) ──
    if (hasSerper) {
      await setStage(runId, "Searching Google…");
      for (const q of plan.webQueries) {
        if (await isStopped(runId)) return;
        const results = await serper(q);
        await trackCost(runId, "serper", "search", 1, 0.001);
        for (const r of results) {
          try {
            const host = new URL(r.link.startsWith("http") ? r.link : `https://${r.link}`).hostname;
            addCandidate({
              type: "web",
              name: r.title.replace(/ [-|].*/, "").trim(),
              website: r.link,
              description: r.snippet,
              email: null,
              rawData: { ...r, host },
            });
          } catch {
            // skip invalid URLs
          }
        }
      }
      await log(runId, "discovering", `Web: ${candidates.filter((c) => c.type === "web").length} results`);
    }

    await setStage(runId, `Found ${candidates.length} total candidates across all sources`);
    await log(runId, "discovering", `Total: ${candidates.length} candidates (Roblox + Steam + Mobile + YouTube + Web)`);

    if (candidates.length === 0) {
      await setStatus(runId, "failed", "No candidates found. Check that external APIs are reachable.");
      return;
    }

    if (await isStopped(runId)) return;

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 3: RESEARCH + SCORE
    // ──────────────────────────────────────────────────────────────────────────
    await setStatus(runId, "researching", `Analyzing ${Math.min(candidates.length, run.count * 2)} leads…`);

    let savedCount = 0;
    // Shuffle to get a mix of sources rather than all Roblox first
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

      const analyzePrompt = `Analyze this lead for a video/clipping agency that makes short-form clips for game companies and creators.

Looking for: "${run.prompt}"
${run.offer ? `Our offer: "${run.offer}"` : ""}

Lead type: ${sourceLabel}
Name: ${c.name}
URL: ${c.website}
About: ${c.description.slice(0, 300)}
${c.email ? `Email found: ${c.email}` : ""}
${run.mode === "deep" ? `Extra data: ${JSON.stringify(c.rawData).slice(0, 400)}` : ""}

Return ONLY this JSON:
{
  "company": "clean name",
  "website": "best URL for this lead",
  "whatItIs": "1 sentence description",
  "segment": "segment label",
  "decisionMaker": "owner/developer name or null",
  "dmRole": "title or null",
  "dmEmail": "email or null",
  "instagramHandle": "@handle or null",
  "xHandle": "@handle or null",
  "grade": "A|B|C|D|F",
  "score": 0-100,
  "whyItFits": "why this lead needs video clips",
  "bestChannel": "instagram|email|youtube|direct|roblox|discord"
}

Grade: A=perfect fit (active game, needs promo content), B=good fit, C=possible, D=weak, F=skip`;

      try {
        const res = await haiku(analyzePrompt);
        await trackCost(runId, "anthropic", "analyze", res.inTok + res.outTok, res.inTok * HAIKU_IN + res.outTok * HAIKU_OUT);

        const a = parseJSON<{
          company: string; website: string; whatItIs: string; segment: string;
          decisionMaker: string | null; dmRole: string | null; dmEmail: string | null;
          instagramHandle: string | null; xHandle: string | null;
          grade: string; score: number; whyItFits: string; bestChannel: string;
        }>(res.text, null as never);

        if (!a) continue;
        if (run.mode === "bulk" && a.grade === "F") continue;

        savedCount++;

        await prisma.leadFactoryLead.create({
          data: {
            runId,
            num: savedCount,
            company: a.company || c.name,
            website: a.website || c.website,
            whatItIs: a.whatItIs || null,
            segment: a.segment || plan.segments[0] || null,
            decisionMaker: a.decisionMaker || null,
            dmRole: a.dmRole || null,
            dmEmail: a.dmEmail || c.email || null,
            instagramHandle: a.instagramHandle || null,
            xHandle: a.xHandle || null,
            grade: ["A", "B", "C", "D", "F"].includes(a.grade) ? a.grade : "C",
            score: typeof a.score === "number" ? Math.max(0, Math.min(100, a.score)) : 50,
            whyItFits: a.whyItFits ? { reason: a.whyItFits, channel: a.bestChannel } : Prisma.JsonNull,
            bestChannel: a.bestChannel || null,
            rawData: c.rawData as Prisma.InputJsonValue,
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
