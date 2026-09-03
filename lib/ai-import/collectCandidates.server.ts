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
  cheer: [
    "직캠",
    "fancam",
    "치어리더",
    "cheer",
    "응원",
    "댄스",
    "dance",
    "shorts",
    "세로",
  ],
  kpop: [
    "직캠",
    "fancam",
    "focus",
    "stage",
    "performance",
    "shorts",
    "dance",
    "live",
    "세로",
  ],
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

type RankedCandidate = YoutubeVideo & {
  category: AiImportCategory;
  subject: Subject;
  subjectMatchScore: number;
  heuristicScore: number;
  ai: AiCandidateJudgment;
  finalScore: number;
};

type CollectorOptions = {
  triggerType: "manual" | "cron";
  maxQueue?: number;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return sorted[middle];
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(
    0,
    Math.min(
      sorted.length - 1,
      Math.round((sorted.length - 1) * percentileValue),
    ),
  );
  return sorted[index];
}

function percentileRank(value: number, sorted: number[]) {
  if (sorted.length <= 1) return 50;
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (sorted[middle] <= value) low = middle + 1;
    else high = middle;
  }
  return Math.round(((low - 1) / (sorted.length - 1)) * 100);
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
  if (normalizedAlias.length < 2) return false;
  return normalizeLoose(text).includes(normalizedAlias);
}

function getSubjectMatchScore(video: YoutubeVideo, subject: Subject) {
  const aliases = Array.from(
    new Set(
      [subject.nameKo, subject.nameEn, subject.nameZhTw, ...subject.aliases]
        .map((value) => value.trim())
        .filter((value) => value.length >= 2),
    ),
  );

  if (aliases.some((alias) => aliasMatchesText(video.title, alias))) {
    return 100;
  }

  if (
    aliases.some((alias) =>
      aliasMatchesText(video.description.slice(0, 800), alias),
    )
  ) {
    return 72;
  }

  return 0;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  if (items.length === 0) return [] as R[];
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker(),
    ),
  );

  return results;
}

async function loadSubjects(supabase: SupabaseClient): Promise<Subject[]> {
  const { data: subjectRows, error } = await supabase
    .from("subjects")
    .select("id, type, category, slug, name_ko, name_en, name_zh_tw")
    .eq("active", true)
    .in("category", CATEGORIES);

  if (error) throw new Error(`Failed to load subjects: ${error.message}`);

  const rows = (subjectRows ?? []).filter(
    (row) => row.category === "kpop" || row.category === "cheer",
  );
  const ids = rows.map((row) => String(row.id));
  const aliasesBySubject = new Map<string, string[]>();

  for (let index = 0; index < ids.length; index += 200) {
    const chunk = ids.slice(index, index + 200);
    const { data: aliasRows, error: aliasError } = await supabase
      .from("subject_aliases")
      .select("subject_id, alias")
      .in("subject_id", chunk);

    if (aliasError) {
      throw new Error(`Failed to load subject aliases: ${aliasError.message}`);
    }

    for (const row of aliasRows ?? []) {
      if (typeof row.subject_id !== "string" || typeof row.alias !== "string") {
        continue;
      }
      const list = aliasesBySubject.get(row.subject_id) ?? [];
      list.push(row.alias);
      aliasesBySubject.set(row.subject_id, list);
    }
  }

  const statsBySubject = new Map<
    string,
    { workCount: number; latestPublishedAt: string | null }
  >();

  for (let index = 0; index < ids.length; index += 200) {
    const chunk = ids.slice(index, index + 200);
    const { data: statsRows, error: statsError } = await supabase
      .from("ai_import_subject_stats")
      .select("subject_id, work_count, latest_published_at")
      .in("subject_id", chunk);

    if (statsError) {
      throw new Error(`Failed to load subject stats: ${statsError.message}`);
    }

    for (const row of statsRows ?? []) {
      if (typeof row.subject_id !== "string") continue;
      statsBySubject.set(row.subject_id, {
        workCount: Number(row.work_count ?? 0),
        latestPublishedAt:
          typeof row.latest_published_at === "string"
            ? row.latest_published_at
            : null,
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

function computeSubjectPriority(subject: Subject, dateKey: string) {
  const recencyDays = daysAgo(subject.latestPublishedAt);
  const activityBonus =
    recencyDays <= 7
      ? 40
      : recencyDays <= 21
        ? 30
        : recencyDays <= 60
          ? 18
          : recencyDays <= 120
            ? 8
            : 0;

  const coverageBonus =
    subject.workCount === 0
      ? 24
      : subject.workCount < 20
        ? 20
        : subject.workCount < 60
          ? 14
          : subject.workCount < 120
            ? 7
            : 0;

  const provenBonus = Math.min(28, Math.sqrt(subject.workCount) * 1.8);
  const rotationBonus = simpleHash(`${dateKey}:${subject.id}`) % 24;
  return Math.round(activityBonus + coverageBonus + provenBonus + rotationBonus);
}

function selectSubjects(subjects: Subject[]) {
  const dateKey = new Date().toISOString().slice(0, 10);
  const selected: Subject[] = [];

  for (const category of CATEGORIES) {
    const categorySubjects = subjects
      .filter((subject) => subject.category === category)
      .map(
        (subject): Subject => ({
          ...subject,
          priorityScore: computeSubjectPriority(subject, dateKey),
        }),
      )
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

  if (error) {
    throw new Error(`Failed to build ${category} style profile: ${error.message}`);
  }

  const durations = (data ?? [])
    .map((row) => Number(row.duration_seconds))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 600);

  const markerCounts = TITLE_MARKERS[category].map((marker) => ({
    marker,
    count: (data ?? []).filter((row) =>
      typeof row.title === "string"
        ? row.title.toLowerCase().includes(marker.toLowerCase())
        : false,
    ).length,
  }));

  const commonTitleMarkers = markerCounts
    .filter(({ count }) => count >= Math.max(5, (data ?? []).length * 0.025))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(({ marker }) => marker);

  return {
    category,
    sampleSize: data?.length ?? 0,
    medianDurationSeconds: median(durations) || 30,
    p25DurationSeconds: percentile(durations, 0.25) || 15,
    p75DurationSeconds: percentile(durations, 0.75) || 90,
    commonTitleMarkers,
  };
}

function buildSearchQuery(subject: Subject) {
  const segments: string[] = [];

  if (subject.nameKo) {
    segments.push(
      subject.category === "cheer"
        ? `${subject.nameKo} 치어리더 직캠`
        : `${subject.nameKo} 직캠`,
    );
  }

  if (subject.category === "cheer" && subject.nameZhTw) {
    segments.push(`${subject.nameZhTw} 啦啦隊`);
  }

  if (subject.nameEn) {
    segments.push(
      subject.category === "cheer"
        ? `${subject.nameEn} cheerleader fancam`
        : `${subject.nameEn} fancam`,
    );
  }

  const base = segments.slice(0, 3).join(" | ");
  return `${base} ${EXCLUDED_SEARCH_TERMS.join(" ")}`.trim();
}

async function searchYouTubeForSubject(subject: Subject) {
  if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY is not configured.");

  const query = buildSearchQuery(subject);
  const publishedAfter = new Date(
    Date.now() - LOOKBACK_DAYS * 86_400_000,
  ).toISOString();

  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(SEARCH_RESULTS_PER_SUBJECT),
    order: "date",
    videoDuration: "short",
    videoEmbeddable: "true",
    publishedAfter,
    key: YOUTUBE_API_KEY,
  });

  if (subject.category === "kpop") {
    params.set("relevanceLanguage", "ko");
    params.set("regionCode", "KR");
  }

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `YouTube search failed (${response.status}): ${text.slice(0, 180)}`,
    );
  }

  const payload = await response.json();
  const ids = (payload.items ?? [])
    .map((item: { id?: { videoId?: string } }) => item.id?.videoId)
    .filter((id: unknown): id is string => typeof id === "string");

  return Array.from(new Set(ids));
}

function parseDuration(duration: string) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    Number(match[1] ?? 0) * 3600 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0)
  );
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

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      throw new Error(`YouTube video details failed (${response.status}).`);
    }

    const payload = await response.json();

    for (const item of payload.items ?? []) {
      const thumbnail =
        item.snippet?.thumbnails?.maxres?.url ||
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url ||
        "";

      videos.set(item.id, {
        id: item.id,
        title: item.snippet?.title ?? "Untitled video",
        description: item.snippet?.description ?? "",
        thumbnail,
        publishedAt: item.snippet?.publishedAt ?? "",
        durationSeconds: parseDuration(item.contentDetails?.duration ?? "PT0S"),
        viewCount: Number(item.statistics?.viewCount ?? 0),
        likeCount: Number(item.statistics?.likeCount ?? 0),
        channelId: item.snippet?.channelId ?? "",
        channelTitle: item.snippet?.channelTitle ?? "",
        embeddable: item.status?.embeddable !== false,
      });
    }
  }

  return videos;
}

async function loadExistingSourceIds(
  supabase: SupabaseClient,
  sourceIds: string[],
) {
  const existing = new Set<string>();

  for (let index = 0; index < sourceIds.length; index += 200) {
    const chunk = sourceIds.slice(index, index + 200);
    const [{ data: works, error: worksError }, { data: queued, error: queueError }] =
      await Promise.all([
        supabase
          .from("works")
          .select("source_id")
          .eq("source", "youtube")
          .in("source_id", chunk),
        supabase
          .from("ai_import_candidates")
          .select("source_id")
          .eq("source", "youtube")
          .in("source_id", chunk),
      ]);

    if (worksError) throw new Error(`Existing work lookup failed: ${worksError.message}`);
    if (queueError) throw new Error(`Existing queue lookup failed: ${queueError.message}`);

    for (const row of [...(works ?? []), ...(queued ?? [])]) {
      if (typeof row.source_id === "string") existing.add(row.source_id);
    }
  }

  return existing;
}

function scoreDuration(duration: number, profile: CategoryStyleProfile) {
  if (duration <= 0 || duration > 240) return 0;
  const medianDuration = Math.max(8, profile.medianDurationSeconds);
  const distance = Math.abs(Math.log((duration + 5) / (medianDuration + 5)));
  return Math.round(clamp(100 - distance * 58));
}

function scoreFreshness(publishedAt: string) {
  const age = daysAgo(publishedAt);
  if (age <= 2) return 100;
  if (age <= 5) return 94;
  if (age <= 10) return 86;
  if (age <= 14) return 78;
  if (age <= 21) return 68;
  return 45;
}

function scoreStyleMarkers(title: string, profile: CategoryStyleProfile) {
  if (profile.commonTitleMarkers.length === 0) return 55;
  const lower = title.toLowerCase();
  const matches = profile.commonTitleMarkers.filter((marker) =>
    lower.includes(marker.toLowerCase()),
  ).length;
  return Math.round(clamp(45 + matches * 22));
}

function applyHeuristicScores(
  drafts: Array<YoutubeVideo & { subject: Subject; subjectMatchScore: number }>,
  profiles: Record<AiImportCategory, CategoryStyleProfile>,
) {
  const velocities = drafts
    .map((draft) => draft.viewCount / Math.max(0.5, daysAgo(draft.publishedAt)))
    .sort((a, b) => a - b);
  const likeRatios = drafts
    .map((draft) =>
      draft.viewCount > 0 ? draft.likeCount / draft.viewCount : 0,
    )
    .sort((a, b) => a - b);

  return drafts.map((draft) => {
    const profile = profiles[draft.subject.category];
    const velocity = draft.viewCount / Math.max(0.5, daysAgo(draft.publishedAt));
    const likeRatio = draft.viewCount > 0 ? draft.likeCount / draft.viewCount : 0;
    const durationScore = scoreDuration(draft.durationSeconds, profile);
    const freshnessScore = scoreFreshness(draft.publishedAt);
    const velocityScore = percentileRank(velocity, velocities);
    const likeScore = percentileRank(likeRatio, likeRatios);
    const markerScore = scoreStyleMarkers(draft.title, profile);

    const heuristicScore = Math.round(
      durationScore * 0.25 +
        freshnessScore * 0.25 +
        velocityScore * 0.25 +
        likeScore * 0.1 +
        draft.subjectMatchScore * 0.1 +
        markerScore * 0.05,
    );

    return {
      ...draft,
      category: draft.subject.category,
      heuristicScore: Math.round(clamp(heuristicScore)),
    };
  });
}

function limitBeforeAi<T extends { subject: Subject; heuristicScore: number }>(
  candidates: T[],
) {
  const perSubject = new Map<string, number>();
  const output: T[] = [];

  for (const candidate of [...candidates].sort(
    (a, b) => b.heuristicScore - a.heuristicScore,
  )) {
    const current = perSubject.get(candidate.subject.id) ?? 0;
    if (current >= 35) continue;
    perSubject.set(candidate.subject.id, current + 1);
    output.push(candidate);
    if (output.length >= PRE_AI_LIMIT) break;
  }

  return output;
}

function selectForQueue(candidates: RankedCandidate[], maxQueue: number) {
  const eligible = [...candidates]
    .filter((candidate) => {
      if (candidate.ai.action === "reject") return false;
      if (candidate.ai.contentType === "mv" || candidate.ai.contentType === "news") {
        return false;
      }
      const threshold = candidate.ai.action === "keep" ? 68 : 74;
      return candidate.finalScore >= threshold;
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  const selected: RankedCandidate[] = [];
  const selectedIds = new Set<string>();
  const subjectCounts = new Map<string, number>();
  const channelCounts = new Map<string, number>();

  function canAdd(candidate: RankedCandidate) {
    return (
      !selectedIds.has(candidate.id) &&
      (subjectCounts.get(candidate.subject.id) ?? 0) < MAX_PER_SUBJECT &&
      (channelCounts.get(candidate.channelId) ?? 0) < MAX_PER_CHANNEL
    );
  }

  function add(candidate: RankedCandidate) {
    selected.push(candidate);
    selectedIds.add(candidate.id);
    subjectCounts.set(
      candidate.subject.id,
      (subjectCounts.get(candidate.subject.id) ?? 0) + 1,
    );
    channelCounts.set(
      candidate.channelId,
      (channelCounts.get(candidate.channelId) ?? 0) + 1,
    );
  }

  for (const category of CATEGORIES) {
    let categoryCount = 0;
    for (const candidate of eligible) {
      if (candidate.category !== category || !canAdd(candidate)) continue;
      add(candidate);
      categoryCount += 1;
      if (categoryCount >= SOFT_CATEGORY_TARGET || selected.length >= maxQueue) break;
    }
  }

  if (selected.length < maxQueue) {
    for (const candidate of eligible) {
      if (!canAdd(candidate)) continue;
      add(candidate);
      if (selected.length >= maxQueue) break;
    }
  }

  return selected;
}

async function createRun(
  supabase: SupabaseClient,
  triggerType: "manual" | "cron",
) {
  const { data, error } = await supabase
    .from("ai_import_runs")
    .insert({ trigger_type: triggerType, status: "running" })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create import run: ${error.message}`);
  return String(data.id);
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

  const stats: Record<string, unknown> = {
    runId,
    batchKey,
    lookbackDays: LOOKBACK_DAYS,
    maxQueue,
  };

  try {
    const subjects = await loadSubjects(supabase);
    const selectedSubjects = selectSubjects(subjects);
    const profileEntries = await Promise.all(
      CATEGORIES.map(async (category) => [
        category,
        await buildStyleProfile(supabase, category),
      ] as const),
    );
    const profiles = Object.fromEntries(profileEntries) as Record<
      AiImportCategory,
      CategoryStyleProfile
    >;

    stats.styleProfiles = profiles;
    stats.selectedSubjects = selectedSubjects.map((subject) => ({
      id: subject.id,
      category: subject.category,
      name: subject.nameKo || subject.nameEn,
      workCount: subject.workCount,
      latestPublishedAt: subject.latestPublishedAt,
      priorityScore: subject.priorityScore,
    }));

    const searchResults = await mapWithConcurrency(
      selectedSubjects,
      4,
      async (subject) => {
        try {
          return {
            subject,
            ids: await searchYouTubeForSubject(subject),
            error: null as string | null,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Search failed";
          console.error("AI IMPORT SUBJECT SEARCH ERROR:", subject.nameKo, message);
          return { subject, ids: [] as string[], error: message };
        }
      },
    );

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
      const emptyResult = { ...stats, queuedCount: 0 };
      await finishRun(supabase, runId, "success", emptyResult);
      return emptyResult;
    }

    const details = await loadYouTubeDetails(rawIds);
    const existingSourceIds = await loadExistingSourceIds(supabase, rawIds);
    const drafts: Array<
      YoutubeVideo & { subject: Subject; subjectMatchScore: number }
    > = [];

    for (const [videoId, subjectsForVideo] of hitsByVideoId) {
      if (existingSourceIds.has(videoId)) continue;
      const video = details.get(videoId);
      if (
        !video ||
        !video.embeddable ||
        video.durationSeconds <= 0 ||
        video.durationSeconds > 240
      ) {
        continue;
      }

      let bestSubject: Subject | null = null;
      let bestMatchScore = 0;

      for (const subject of subjectsForVideo) {
        const matchScore = getSubjectMatchScore(video, subject);
        if (
          matchScore > bestMatchScore ||
          (matchScore === bestMatchScore &&
            matchScore > 0 &&
            subject.priorityScore > (bestSubject?.priorityScore ?? -1))
        ) {
          bestSubject = subject;
          bestMatchScore = matchScore;
        }
      }

      if (!bestSubject || bestMatchScore === 0) continue;
      drafts.push({
        ...video,
        subject: bestSubject,
        subjectMatchScore: bestMatchScore,
      });
    }

    stats.newMatchedVideoCount = drafts.length;

    const heuristicCandidates = applyHeuristicScores(drafts, profiles);
    const aiCandidatesSource = limitBeforeAi(heuristicCandidates);
    stats.aiAnalyzedCandidateCount = aiCandidatesSource.length;

    const aiInputs: CandidateForAi[] = aiCandidatesSource.map((candidate) => ({
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
    const judgments = new Map(aiResult.judgments.map((item) => [item.id, item]));
    stats.aiFallbackCount = aiResult.fallbackCount;

    const ranked: RankedCandidate[] = [];
    for (const candidate of aiCandidatesSource) {
      const ai = judgments.get(candidate.id);
      if (!ai) continue;
      const finalScore = Math.round(
        clamp(ai.score * 0.7 + candidate.heuristicScore * 0.3),
      );
      ranked.push({ ...candidate, ai, finalScore });
    }

    const selectedForQueue = selectForQueue(ranked, maxQueue);
    const rows = selectedForQueue.map((candidate) => ({
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
        .upsert(rows, {
          onConflict: "source,source_id",
          ignoreDuplicates: true,
        })
        .select("id");

      if (insertError) {
        throw new Error(`Failed to queue candidates: ${insertError.message}`);
      }
      insertedCount = inserted?.length ?? 0;
    }

    const queuedByCategory = selectedForQueue.reduce(
      (counts, candidate) => {
        counts[candidate.category] += 1;
        return counts;
      },
      { kpop: 0, cheer: 0 },
    );

    Object.assign(stats, {
      eligibleAfterAiCount: ranked.filter((candidate) => {
        if (candidate.ai.action === "reject") return false;
        if (candidate.ai.contentType === "mv" || candidate.ai.contentType === "news") {
          return false;
        }
        const threshold = candidate.ai.action === "keep" ? 68 : 74;
        return candidate.finalScore >= threshold;
      }).length,
      selectedForQueueCount: selectedForQueue.length,
      queuedCount: insertedCount,
      queuedByCategory,
      topQueued: selectedForQueue.slice(0, 15).map((candidate) => ({
        sourceId: candidate.id,
        category: candidate.category,
        subject: candidate.subject.nameKo || candidate.subject.nameEn,
        title: candidate.title,
        score: candidate.finalScore,
      })),
    });

    await finishRun(supabase, runId, "success", stats);
    return stats;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI import collector failed.";
    await finishRun(supabase, runId, "failed", stats, message);
    throw error;
  }
}
