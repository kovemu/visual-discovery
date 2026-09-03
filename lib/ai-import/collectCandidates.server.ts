import type { SupabaseClient } from "@supabase/supabase-js";

import {
  scoreCandidatesWithAi,
  type AiCandidateJudgment,
  type AiImportCategory,
  type CandidateForAi,
  type CategoryStyleProfile,
} from "@/lib/ai-import/scoreCandidates.server";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const CATEGORIES: AiImportCategory[] = ["kpop", "cheer"];
const SUBJECTS_PER_CATEGORY = 12;
const SEARCH_RESULTS_PER_SUBJECT = 25;
const LOOKBACK_DAYS = 21;
const PRE_AI_LIMIT = 260;
const MAX_QUEUE = 200;
const SOFT_CATEGORY_TARGET = 100;
const MAX_PER_SUBJECT = 20;
const MAX_PER_CHANNEL = 28;

const TITLE_MARKERS: Record<AiImportCategory, string[]> = {
  cheer: ["직캠", "fancam", "치어리더", "cheer", "응원", "댄스", "dance", "shorts", "세로"],
  kpop: ["직캠", "fancam", "focus", "stage", "performance", "shorts", "dance", "live", "세로"],
};

const EXCLUDED_SEARCH_TERMS = [
  "-KBS",
  "-SBS",
  "-MBC",
  "-Mnet",
  "-M2",
  '-"ALL THE K-POP"',
];

type Subject = {
  id: string;
  type: string;
  category: AiImportCategory;
  slug: string;
  nameKo: string;
  nameEn: string;
  nameZhTw: string;
  aliases: string[];
  workCount: number;
  latestPublishedAt: string | null;
  priorityScore: number;
};

type YoutubeVideo = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  channelId: string;
  channelTitle: string;
  embeddable: boolean;
};

type CandidateDraft = YoutubeVideo & {
  subject: Subject;
  subjectMatchScore: number;
  heuristicScore: number;
  category: AiImportCategory;
};

type RankedCandidate = CandidateDraft & {
  ai: AiCandidateJudgment;
  finalScore: number;
};

type CollectorOptions = {
  triggerType: "manual" | "cron";
  maxQueue?: number;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * ratio)));
  return sorted[index];
}

function percentileRank(value: number, sorted: number[]) {
  if (sorted.length <= 1) return 50;
  let count = 0;
  for (const item of sorted) {
    if (item <= value) count += 1;
  }
  return Math.round(((count - 1) / (sorted.length - 1)) * 100);
}

function simpleHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function daysAgo(date: string | null | undefined) {
  if (!date) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - timestamp) / 86_400_000);
}

function normalizeLoose(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_\-–—·.'"`~!@#$%^&*()+=[\]{}:;,.?/\\|<>]+/g, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasMatchesText(text: string, alias: string) {
  const cleanAlias = alias.trim();
  if (cleanAlias.length < 2) return false;

  const isAscii = /^[\x00-\x7F]+$/.test(cleanAlias);
  if (isAscii && cleanAlias.replace(/\s/g, "").length <= 4) {
    const expression = new RegExp(
      `(^|[^a-z0-9])${escapeRegExp(cleanAlias.toLowerCase())}([^a-z0-9]|$)`,
      "i",
    );
    return expression.test(text.toLowerCase());
  }

  const normalizedAlias = normalizeLoose(cleanAlias);
  return normalizedAlias.length >= 2 && normalizeLoose(text).includes(normalizedAlias);
}

function subjectMatchScore(video: YoutubeVideo, subject: Subject) {
  const aliases = Array.from(
    new Set(
      [subject.nameKo, subject.nameEn, subject.nameZhTw, ...subject.aliases]
        .map((value) => value.trim())
        .filter((value) => value.length >= 2),
    ),
  );

  if (aliases.some((alias) => aliasMatchesText(video.title, alias))) return 100;
  if (aliases.some((alias) => aliasMatchesText(video.description.slice(0, 800), alias))) return 72;
  return 0;
}

async function loadSubjects(supabase: SupabaseClient): Promise<Subject[]> {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, type, category, slug, name_ko, name_en, name_zh_tw")
    .eq("active", true)
    .in("category", CATEGORIES);

  if (error) throw new Error(`Failed to load subjects: ${error.message}`);

  const rows = ((data ?? []) as any[]).filter(
    (row) => row.category === "kpop" || row.category === "cheer",
  );
  const ids: string[] = rows.map((row) => String(row.id));
  const aliasesBySubject = new Map<string, string[]>();
  const statsBySubject = new Map<string, { workCount: number; latestPublishedAt: string | null }>();

  for (let index = 0; index < ids.length; index += 200) {
    const chunk = ids.slice(index, index + 200);
    const [{ data: aliases, error: aliasError }, { data: stats, error: statsError }] = await Promise.all([
      supabase.from("subject_aliases").select("subject_id, alias").in("subject_id", chunk),
      supabase.from("ai_import_subject_stats").select("subject_id, work_count, latest_published_at").in("subject_id", chunk),
    ]);

    if (aliasError) throw new Error(`Failed to load subject aliases: ${aliasError.message}`);
    if (statsError) throw new Error(`Failed to load subject stats: ${statsError.message}`);

    for (const row of (aliases ?? []) as any[]) {
      const subjectId = String(row.subject_id ?? "");
      const alias = typeof row.alias === "string" ? row.alias : "";
      if (!subjectId || !alias) continue;
      const list = aliasesBySubject.get(subjectId) ?? [];
      list.push(alias);
      aliasesBySubject.set(subjectId, list);
    }

    for (const row of (stats ?? []) as any[]) {
      const subjectId = String(row.subject_id ?? "");
      if (!subjectId) continue;
      statsBySubject.set(subjectId, {
        workCount: Number(row.work_count ?? 0),
        latestPublishedAt: typeof row.latest_published_at === "string" ? row.latest_published_at : null,
      });
    }
  }

  return rows.map((row): Subject => {
    const id = String(row.id);
    const stats = statsBySubject.get(id);
    return {
      id,
      type: typeof row.type === "string" ? row.type : "other",
      category: row.category as AiImportCategory,
      slug: typeof row.slug === "string" ? row.slug : "",
      nameKo: typeof row.name_ko === "string" ? row.name_ko : "",
      nameEn: typeof row.name_en === "string" ? row.name_en : "",
      nameZhTw: typeof row.name_zh_tw === "string" ? row.name_zh_tw : "",
      aliases: aliasesBySubject.get(id) ?? [],
      workCount: stats?.workCount ?? 0,
      latestPublishedAt: stats?.latestPublishedAt ?? null,
      priorityScore: 0,
    };
  });
}

function priorityForSubject(subject: Subject, dateKey: string) {
  const age = daysAgo(subject.latestPublishedAt);
  const activity = age <= 7 ? 40 : age <= 21 ? 30 : age <= 60 ? 18 : age <= 120 ? 8 : 0;
  const coverage = subject.workCount === 0 ? 24 : subject.workCount < 20 ? 20 : subject.workCount < 60 ? 14 : subject.workCount < 120 ? 7 : 0;
  const proven = Math.min(28, Math.sqrt(subject.workCount) * 1.8);
  const rotation = simpleHash(`${dateKey}:${subject.id}`) % 24;
  return Math.round(activity + coverage + proven + rotation);
}

function selectSubjects(subjects: Subject[]) {
  const dateKey = new Date().toISOString().slice(0, 10);
  const selected: Subject[] = [];

  for (const category of CATEGORIES) {
    const categorySubjects = subjects
      .filter((subject) => subject.category === category)
      .map((subject): Subject => ({ ...subject, priorityScore: priorityForSubject(subject, dateKey) }))
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, SUBJECTS_PER_CATEGORY);
    selected.push(...categorySubjects);
  }

  return selected;
}

async function buildStyleProfile(
  supabase: SupabaseClient,
  category: AiImportCategory,
): Promise<CategoryStyleProfile> {
  const { data, error } = await supabase
    .from("discover_works_effective")
    .select("title, duration_seconds")
    .eq("effective_category", category)
    .eq("discover_eligible", true)
    .eq("source", "youtube")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(1000);

  if (error) throw new Error(`Failed to build ${category} style profile: ${error.message}`);

  const rows = (data ?? []) as any[];
  const durations = rows
    .map((row) => Number(row.duration_seconds))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 600);

  const markerCounts = TITLE_MARKERS[category]
    .map((marker) => ({
      marker,
      count: rows.filter((row) => String(row.title ?? "").toLowerCase().includes(marker.toLowerCase())).length,
    }))
    .filter(({ count }) => count >= Math.max(5, rows.length * 0.025))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(({ marker }) => marker);

  return {
    category,
    sampleSize: rows.length,
    medianDurationSeconds: median(durations) || 30,
    p25DurationSeconds: percentile(durations, 0.25) || 15,
    p75DurationSeconds: percentile(durations, 0.75) || 90,
    commonTitleMarkers: markerCounts,
  };
}

function buildSearchQuery(subject: Subject) {
  const segments: string[] = [];
  if (subject.nameKo) {
    segments.push(subject.category === "cheer" ? `${subject.nameKo} 치어리더 직캠` : `${subject.nameKo} 직캠`);
  }
  if (subject.category === "cheer" && subject.nameZhTw) segments.push(`${subject.nameZhTw} 啦啦隊`);
  if (subject.nameEn) {
    segments.push(subject.category === "cheer" ? `${subject.nameEn} cheerleader fancam` : `${subject.nameEn} fancam`);
  }
  return `${segments.slice(0, 3).join(" | ")} ${EXCLUDED_SEARCH_TERMS.join(" ")}`.trim();
}

async function searchYouTubeForSubject(subject: Subject): Promise<string[]> {
  if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY is not configured.");

  const params = new URLSearchParams({
    part: "snippet",
    q: buildSearchQuery(subject),
    type: "video",
    maxResults: String(SEARCH_RESULTS_PER_SUBJECT),
    order: "date",
    videoDuration: "short",
    videoEmbeddable: "true",
    publishedAfter: new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString(),
    key: YOUTUBE_API_KEY,
  });

  if (subject.category === "kpop") {
    params.set("relevanceLanguage", "ko");
    params.set("regionCode", "KR");
  }

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`YouTube search failed (${response.status}): ${body.slice(0, 160)}`);
  }

  const payload: any = await response.json();
  const ids: string[] = [];
  for (const item of payload.items ?? []) {
    const id = item?.id?.videoId;
    if (typeof id === "string" && id) ids.push(id);
  }
  return Array.from(new Set(ids));
}

function parseDuration(value: string) {
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

async function loadYouTubeDetails(videoIds: string[]) {
  if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY is not configured.");
  const videos = new Map<string, YoutubeVideo>();

  for (let index = 0; index < videoIds.length; index += 50) {
    const batch = videoIds.slice(index, index + 50);
    const params = new URLSearchParams({
      part: "snippet,contentDetails,statistics,status",
      id: batch.join(","),
      key: YOUTUBE_API_KEY,
    });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`YouTube video details failed (${response.status}).`);

    const payload: any = await response.json();
    for (const item of payload.items ?? []) {
      const id = typeof item?.id === "string" ? item.id : "";
      if (!id) continue;
      const thumbnail =
        item.snippet?.thumbnails?.maxres?.url ||
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url ||
        "";
      videos.set(id, {
        id,
        title: String(item.snippet?.title ?? "Untitled video"),
        description: String(item.snippet?.description ?? ""),
        thumbnail: String(thumbnail),
        publishedAt: String(item.snippet?.publishedAt ?? ""),
        durationSeconds: parseDuration(String(item.contentDetails?.duration ?? "PT0S")),
        viewCount: Number(item.statistics?.viewCount ?? 0),
        likeCount: Number(item.statistics?.likeCount ?? 0),
        channelId: String(item.snippet?.channelId ?? ""),
        channelTitle: String(item.snippet?.channelTitle ?? ""),
        embeddable: item.status?.embeddable !== false,
      });
    }
  }

  return videos;
}

async function loadExistingSourceIds(supabase: SupabaseClient, sourceIds: string[]) {
  const existing = new Set<string>();
  for (let index = 0; index < sourceIds.length; index += 200) {
    const chunk = sourceIds.slice(index, index + 200);
    const [{ data: works, error: worksError }, { data: queued, error: queueError }] = await Promise.all([
      supabase.from("works").select("source_id").eq("source", "youtube").in("source_id", chunk),
      supabase.from("ai_import_candidates").select("source_id").eq("source", "youtube").in("source_id", chunk),
    ]);
    if (worksError) throw new Error(`Existing work lookup failed: ${worksError.message}`);
    if (queueError) throw new Error(`Existing queue lookup failed: ${queueError.message}`);
    for (const row of [...((works ?? []) as any[]), ...((queued ?? []) as any[])]) {
      if (typeof row.source_id === "string") existing.add(row.source_id);
    }
  }
  return existing;
}

function durationScore(duration: number, profile: CategoryStyleProfile) {
  if (duration <= 0 || duration > 240) return 0;
  const target = Math.max(8, profile.medianDurationSeconds);
  return Math.round(clamp(100 - Math.abs(Math.log((duration + 5) / (target + 5))) * 58));
}

function freshnessScore(publishedAt: string) {
  const age = daysAgo(publishedAt);
  if (age <= 2) return 100;
  if (age <= 5) return 94;
  if (age <= 10) return 86;
  if (age <= 14) return 78;
  if (age <= 21) return 68;
  return 45;
}

function markerScore(title: string, profile: CategoryStyleProfile) {
  if (profile.commonTitleMarkers.length === 0) return 55;
  const lower = title.toLowerCase();
  const matches = profile.commonTitleMarkers.filter((marker) => lower.includes(marker.toLowerCase())).length;
  return Math.round(clamp(45 + matches * 22));
}

function applyHeuristics(
  drafts: Array<YoutubeVideo & { subject: Subject; subjectMatchScore: number }>,
  profiles: Record<AiImportCategory, CategoryStyleProfile>,
): CandidateDraft[] {
  const velocities = drafts
    .map((draft) => draft.viewCount / Math.max(0.5, daysAgo(draft.publishedAt)))
    .sort((a, b) => a - b);
  const ratios = drafts
    .map((draft) => (draft.viewCount > 0 ? draft.likeCount / draft.viewCount : 0))
    .sort((a, b) => a - b);

  return drafts.map((draft) => {
    const profile = profiles[draft.subject.category];
    const velocity = draft.viewCount / Math.max(0.5, daysAgo(draft.publishedAt));
    const ratio = draft.viewCount > 0 ? draft.likeCount / draft.viewCount : 0;
    const score =
      durationScore(draft.durationSeconds, profile) * 0.25 +
      freshnessScore(draft.publishedAt) * 0.25 +
      percentileRank(velocity, velocities) * 0.25 +
      percentileRank(ratio, ratios) * 0.1 +
      draft.subjectMatchScore * 0.1 +
      markerScore(draft.title, profile) * 0.05;

    return {
      ...draft,
      category: draft.subject.category,
      heuristicScore: Math.round(clamp(score)),
    };
  });
}

function preAiLimit(candidates: CandidateDraft[]) {
  const subjectCounts = new Map<string, number>();
  const output: CandidateDraft[] = [];
  for (const candidate of [...candidates].sort((a, b) => b.heuristicScore - a.heuristicScore)) {
    const count = subjectCounts.get(candidate.subject.id) ?? 0;
    if (count >= 35) continue;
    subjectCounts.set(candidate.subject.id, count + 1);
    output.push(candidate);
    if (output.length >= PRE_AI_LIMIT) break;
  }
  return output;
}

function queueSelection(candidates: RankedCandidate[], maxQueue: number) {
  const eligible = candidates
    .filter((candidate) => {
      if (candidate.ai.action === "reject") return false;
      if (candidate.ai.contentType === "mv" || candidate.ai.contentType === "news") return false;
      return candidate.finalScore >= (candidate.ai.action === "keep" ? 68 : 74);
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  const selected: RankedCandidate[] = [];
  const selectedIds = new Set<string>();
  const subjectCounts = new Map<string, number>();
  const channelCounts = new Map<string, number>();

  const canAdd = (candidate: RankedCandidate) =>
    !selectedIds.has(candidate.id) &&
    (subjectCounts.get(candidate.subject.id) ?? 0) < MAX_PER_SUBJECT &&
    (channelCounts.get(candidate.channelId) ?? 0) < MAX_PER_CHANNEL;

  const add = (candidate: RankedCandidate) => {
    selected.push(candidate);
    selectedIds.add(candidate.id);
    subjectCounts.set(candidate.subject.id, (subjectCounts.get(candidate.subject.id) ?? 0) + 1);
    channelCounts.set(candidate.channelId, (channelCounts.get(candidate.channelId) ?? 0) + 1);
  };

  for (const category of CATEGORIES) {
    let count = 0;
    for (const candidate of eligible) {
      if (candidate.category !== category || !canAdd(candidate)) continue;
      add(candidate);
      count += 1;
      if (count >= SOFT_CATEGORY_TARGET || selected.length >= maxQueue) break;
    }
  }

  for (const candidate of eligible) {
    if (selected.length >= maxQueue) break;
    if (canAdd(candidate)) add(candidate);
  }

  return selected;
}

async function createRun(supabase: SupabaseClient, triggerType: "manual" | "cron") {
  const { data, error } = await supabase
    .from("ai_import_runs")
    .insert({ trigger_type: triggerType, status: "running" })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create import run: ${error.message}`);
  return String((data as any).id);
}

async function finishRun(
  supabase: SupabaseClient,
  runId: string,
  status: "success" | "failed",
  stats: Record<string, unknown>,
  errorMessage?: string,
) {
  const { error } = await supabase
    .from("ai_import_runs")
    .update({
      status,
      stats,
      error_message: errorMessage ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) console.error("AI IMPORT RUN FINISH ERROR:", error);
}

export async function collectAiImportCandidates(
  supabase: SupabaseClient,
  options: CollectorOptions,
) {
  if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY is not configured.");

  const runId = await createRun(supabase, options.triggerType);
  const maxQueue = Math.max(1, Math.min(options.maxQueue ?? MAX_QUEUE, MAX_QUEUE));
  const batchKey = `${options.triggerType}-${new Date().toISOString()}`;
  const stats: Record<string, unknown> = { runId, batchKey, lookbackDays: LOOKBACK_DAYS, maxQueue };

  try {
    const subjects = await loadSubjects(supabase);
    const selectedSubjects = selectSubjects(subjects);
    const [kpopProfile, cheerProfile] = await Promise.all([
      buildStyleProfile(supabase, "kpop"),
      buildStyleProfile(supabase, "cheer"),
    ]);
    const profiles: Record<AiImportCategory, CategoryStyleProfile> = {
      kpop: kpopProfile,
      cheer: cheerProfile,
    };

    stats.styleProfiles = profiles;
    stats.selectedSubjects = selectedSubjects.map((subject) => ({
      id: subject.id,
      category: subject.category,
      name: subject.nameKo || subject.nameEn,
      workCount: subject.workCount,
      latestPublishedAt: subject.latestPublishedAt,
      priorityScore: subject.priorityScore,
    }));

    const searchResults: Array<{ subject: Subject; ids: string[]; error: string | null }> = [];
    for (let index = 0; index < selectedSubjects.length; index += 4) {
      const group = selectedSubjects.slice(index, index + 4);
      const resultGroup = await Promise.all(
        group.map(async (subject) => {
          try {
            return { subject, ids: await searchYouTubeForSubject(subject), error: null };
          } catch (error) {
            const message = error instanceof Error ? error.message : "Search failed";
            console.error("AI IMPORT SUBJECT SEARCH ERROR:", subject.nameKo, message);
            return { subject, ids: [] as string[], error: message };
          }
        }),
      );
      searchResults.push(...resultGroup);
    }

    const hitsByVideoId = new Map<string, Subject[]>();
    let searchErrorCount = 0;
    for (const result of searchResults) {
      if (result.error) searchErrorCount += 1;
      for (const id of result.ids) {
        const hits = hitsByVideoId.get(id) ?? [];
        hits.push(result.subject);
        hitsByVideoId.set(id, hits);
      }
    }

    const rawIds = Array.from(hitsByVideoId.keys());
    stats.searchedSubjectCount = selectedSubjects.length;
    stats.searchErrorCount = searchErrorCount;
    stats.rawSearchVideoCount = rawIds.length;

    if (rawIds.length === 0) {
      const result = { ...stats, queuedCount: 0 };
      await finishRun(supabase, runId, "success", result);
      return result;
    }

    const details = await loadYouTubeDetails(rawIds);
    const existing = await loadExistingSourceIds(supabase, rawIds);
    const rawDrafts: Array<YoutubeVideo & { subject: Subject; subjectMatchScore: number }> = [];

    for (const [videoId, subjectsForVideo] of hitsByVideoId.entries()) {
      if (existing.has(videoId)) continue;
      const video = details.get(videoId);
      if (!video || !video.embeddable || video.durationSeconds <= 0 || video.durationSeconds > 240) continue;

      let bestSubject: Subject | null = null;
      let bestScore = 0;
      for (const subject of subjectsForVideo) {
        const score = subjectMatchScore(video, subject);
        if (
          score > bestScore ||
          (score === bestScore && score > 0 && subject.priorityScore > (bestSubject?.priorityScore ?? -1))
        ) {
          bestSubject = subject;
          bestScore = score;
        }
      }
      if (!bestSubject || bestScore === 0) continue;
      rawDrafts.push({ ...video, subject: bestSubject, subjectMatchScore: bestScore });
    }

    stats.newMatchedVideoCount = rawDrafts.length;

    const candidates = preAiLimit(applyHeuristics(rawDrafts, profiles));
    stats.aiAnalyzedCandidateCount = candidates.length;

    const aiInputs: CandidateForAi[] = candidates.map((candidate) => ({
      id: candidate.id,
      category: candidate.category,
      subjectName: candidate.subject.nameKo || candidate.subject.nameEn,
      title: candidate.title,
      description: candidate.description.slice(0, 450),
      channelTitle: candidate.channelTitle,
      publishedAt: candidate.publishedAt,
      durationSeconds: candidate.durationSeconds,
      viewCount: candidate.viewCount,
      likeCount: candidate.likeCount,
      heuristicScore: candidate.heuristicScore,
    }));

    const aiResult = await scoreCandidatesWithAi(aiInputs, profiles);
    const judgments = new Map<string, AiCandidateJudgment>();
    for (const judgment of aiResult.judgments) judgments.set(judgment.id, judgment);
    stats.aiFallbackCount = aiResult.fallbackCount;

    const ranked: RankedCandidate[] = [];
    for (const candidate of candidates) {
      const ai = judgments.get(candidate.id);
      if (!ai) continue;
      ranked.push({
        ...candidate,
        ai,
        finalScore: Math.round(clamp(ai.score * 0.7 + candidate.heuristicScore * 0.3)),
      });
    }

    const selected = queueSelection(ranked, maxQueue);
    const rows = selected.map((candidate) => ({
      category: candidate.category,
      source: "youtube",
      source_id: candidate.id,
      source_url: `https://www.youtube.com/watch?v=${candidate.id}`,
      title: candidate.title,
      description: candidate.description || null,
      thumbnail_url: candidate.thumbnail || null,
      published_at: candidate.publishedAt || null,
      duration_seconds: candidate.durationSeconds,
      view_count: candidate.viewCount,
      like_count: candidate.likeCount,
      channel_id: candidate.channelId || null,
      channel_title: candidate.channelTitle || null,
      target_artist_id: null,
      subject_id: candidate.subject.id,
      subject_name: candidate.subject.nameKo || candidate.subject.nameEn,
      heuristic_score: candidate.heuristicScore,
      ai_score: candidate.finalScore,
      ai_reason: candidate.ai.reason,
      ai_content_type: candidate.ai.contentType,
      score_breakdown: {
        heuristicScore: candidate.heuristicScore,
        aiModelScore: candidate.ai.score,
        finalScore: candidate.finalScore,
        aiAction: candidate.ai.action,
        subjectMatchScore: candidate.subjectMatchScore,
        subjectPriorityScore: candidate.subject.priorityScore,
      },
      status: "pending",
      batch_key: batchKey,
    }));

    let insertedCount = 0;
    if (rows.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("ai_import_candidates")
        .upsert(rows, { onConflict: "source,source_id", ignoreDuplicates: true })
        .select("id");
      if (insertError) throw new Error(`Failed to queue candidates: ${insertError.message}`);
      insertedCount = (inserted ?? []).length;
    }

    let queuedKpop = 0;
    let queuedCheer = 0;
    for (const candidate of selected) {
      if (candidate.category === "kpop") queuedKpop += 1;
      else queuedCheer += 1;
    }

    stats.eligibleAfterAiCount = ranked.filter((candidate) => {
      if (candidate.ai.action === "reject") return false;
      if (candidate.ai.contentType === "mv" || candidate.ai.contentType === "news") return false;
      return candidate.finalScore >= (candidate.ai.action === "keep" ? 68 : 74);
    }).length;
    stats.selectedForQueueCount = selected.length;
    stats.queuedCount = insertedCount;
    stats.queuedByCategory = { kpop: queuedKpop, cheer: queuedCheer };
    stats.topQueued = selected.slice(0, 15).map((candidate) => ({
      sourceId: candidate.id,
      category: candidate.category,
      subject: candidate.subject.nameKo || candidate.subject.nameEn,
      title: candidate.title,
      score: candidate.finalScore,
    }));

    await finishRun(supabase, runId, "success", stats);
    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI import collector failed.";
    await finishRun(supabase, runId, "failed", stats, message);
    throw error;
  }
}
