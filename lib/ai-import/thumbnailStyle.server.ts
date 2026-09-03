import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiImportCategory } from "@/lib/ai-import/scoreCandidates.server";

const FEATURE_WIDTH = 48;
const FEATURE_HEIGHT = 27;
const FEATURE_LENGTH = 42;
const MAX_IMAGE_BYTES = 3_000_000;
const IMAGE_TIMEOUT_MS = 7_000;
const HISTORY_LIMIT = 320;
const HISTORY_PER_BUCKET = 60;
const HISTORY_DOWNLOAD_LIMIT = 140;
const CURRENT_CONCURRENCY = 8;
const HISTORY_CONCURRENCY = 6;

type ReviewStatus = "approved" | "rejected";

type ReviewExample = {
  id: number;
  category: AiImportCategory;
  status: ReviewStatus;
  thumbnail_url: string | null;
  score_breakdown: Record<string, unknown> | null;
};

type PendingCandidate = {
  id: number;
  category: AiImportCategory;
  thumbnail_url: string | null;
  heuristic_score: number | null;
  ai_score: number | null;
  ai_reason: string | null;
  score_breakdown: Record<string, unknown> | null;
};

type VisualExampleSets = Record<
  AiImportCategory,
  {
    approved: number[][];
    rejected: number[][];
  }
>;

type FeatureScore = {
  visualScore: number;
  approvedSimilarity: number | null;
  rejectedSimilarity: number | null;
  approvedCount: number;
  rejectedCount: number;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clamp100(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[], average: number) {
  if (values.length === 0) return 0;
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function isFeatureVector(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === FEATURE_LENGTH &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function cachedFeatures(scoreBreakdown: Record<string, unknown> | null) {
  const thumbnailStyle = scoreBreakdown?.thumbnailStyle;
  if (!thumbnailStyle || typeof thumbnailStyle !== "object") return null;
  const features = (thumbnailStyle as Record<string, unknown>).features;
  return isFeatureVector(features) ? features : null;
}

async function fetchThumbnailBuffer(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 KovemuThumbnailStyle/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Thumbnail request returned ${response.status}`);
    }

    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_IMAGE_BYTES) {
      throw new Error("Thumbnail is too large");
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("Thumbnail payload is invalid");
    }

    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
}

function pixelBrightness(r: number, g: number, b: number) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function pixelSaturation(r: number, g: number, b: number) {
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  if (maximum === 0) return 0;
  return (maximum - minimum) / maximum;
}

export async function extractThumbnailStyleFeatures(url: string) {
  const input = await fetchThumbnailBuffer(url);
  const { data, info } = await sharp(input)
    .rotate()
    .resize(FEATURE_WIDTH, FEATURE_HEIGHT, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels < 3) {
    throw new Error("Thumbnail does not contain RGB channels");
  }

  const brightness: number[] = [];
  const saturation: number[] = [];
  const red: number[] = [];
  const green: number[] = [];
  const blue: number[] = [];
  const centerBrightness: number[] = [];
  const centerSaturation: number[] = [];
  const borderBrightness: number[] = [];
  const leftBrightness: number[] = [];
  const rightBrightness: number[] = [];
  const topBrightness: number[] = [];
  const bottomBrightness: number[] = [];
  const gridBrightness = Array.from({ length: 12 }, () => [] as number[]);
  const gridSaturation = Array.from({ length: 12 }, () => [] as number[]);
  const grayscale = new Array<number>(FEATURE_WIDTH * FEATURE_HEIGHT).fill(0);

  const centerXMin = Math.floor(FEATURE_WIDTH * 0.25);
  const centerXMax = Math.ceil(FEATURE_WIDTH * 0.75);
  const centerYMin = Math.floor(FEATURE_HEIGHT * 0.22);
  const centerYMax = Math.ceil(FEATURE_HEIGHT * 0.78);
  const sideBand = Math.max(2, Math.floor(FEATURE_WIDTH * 0.12));
  const topBand = Math.max(2, Math.floor(FEATURE_HEIGHT * 0.14));

  for (let y = 0; y < FEATURE_HEIGHT; y += 1) {
    for (let x = 0; x < FEATURE_WIDTH; x += 1) {
      const pixelIndex = y * FEATURE_WIDTH + x;
      const offset = pixelIndex * info.channels;
      const r = data[offset] ?? 0;
      const g = data[offset + 1] ?? 0;
      const b = data[offset + 2] ?? 0;
      const value = pixelBrightness(r, g, b);
      const sat = pixelSaturation(r, g, b);

      brightness.push(value);
      saturation.push(sat);
      red.push(r / 255);
      green.push(g / 255);
      blue.push(b / 255);
      grayscale[pixelIndex] = value;

      const inCenter =
        x >= centerXMin &&
        x < centerXMax &&
        y >= centerYMin &&
        y < centerYMax;
      const inBorder =
        x < sideBand ||
        x >= FEATURE_WIDTH - sideBand ||
        y < topBand ||
        y >= FEATURE_HEIGHT - topBand;

      if (inCenter) {
        centerBrightness.push(value);
        centerSaturation.push(sat);
      }
      if (inBorder) borderBrightness.push(value);
      if (x < sideBand) leftBrightness.push(value);
      if (x >= FEATURE_WIDTH - sideBand) rightBrightness.push(value);
      if (y < topBand) topBrightness.push(value);
      if (y >= FEATURE_HEIGHT - topBand) bottomBrightness.push(value);

      const gridX = Math.min(3, Math.floor((x / FEATURE_WIDTH) * 4));
      const gridY = Math.min(2, Math.floor((y / FEATURE_HEIGHT) * 3));
      const gridIndex = gridY * 4 + gridX;
      gridBrightness[gridIndex].push(value);
      gridSaturation[gridIndex].push(sat);
    }
  }

  const edgeValues: number[] = [];
  const centerEdgeValues: number[] = [];
  for (let y = 0; y < FEATURE_HEIGHT; y += 1) {
    for (let x = 0; x < FEATURE_WIDTH; x += 1) {
      const index = y * FEATURE_WIDTH + x;
      const current = grayscale[index];
      const right = x + 1 < FEATURE_WIDTH ? grayscale[index + 1] : current;
      const down =
        y + 1 < FEATURE_HEIGHT ? grayscale[index + FEATURE_WIDTH] : current;
      const edge = clamp01((Math.abs(current - right) + Math.abs(current - down)) / 2);
      edgeValues.push(edge);
      if (
        x >= centerXMin &&
        x < centerXMax &&
        y >= centerYMin &&
        y < centerYMax
      ) {
        centerEdgeValues.push(edge);
      }
    }
  }

  const brightnessMean = mean(brightness);
  const saturationMean = mean(saturation);
  const centerBrightnessMean = mean(centerBrightness);
  const borderBrightnessMean = mean(borderBrightness);

  const features = [
    brightnessMean,
    clamp01(standardDeviation(brightness, brightnessMean) * 2.5),
    saturationMean,
    clamp01(standardDeviation(saturation, saturationMean) * 2.5),
    mean(red),
    mean(green),
    mean(blue),
    centerBrightnessMean,
    mean(centerSaturation),
    clamp01(standardDeviation(centerBrightness, centerBrightnessMean) * 2.5),
    borderBrightnessMean,
    clamp01(standardDeviation(borderBrightness, borderBrightnessMean) * 2.5),
    mean(leftBrightness),
    mean(rightBrightness),
    mean(topBrightness),
    mean(bottomBrightness),
    mean(edgeValues),
    mean(centerEdgeValues),
    ...gridBrightness.map((values) => mean(values)),
    ...gridSaturation.map((values) => mean(values)),
  ].map((value) => Number(clamp01(value).toFixed(5)));

  if (features.length !== FEATURE_LENGTH) {
    throw new Error(`Unexpected thumbnail feature length ${features.length}`);
  }

  return features;
}

function similarity(left: number[], right: number[]) {
  if (left.length !== right.length || left.length === 0) return 0;
  let squared = 0;
  for (let index = 0; index < left.length; index += 1) {
    squared += (left[index] - right[index]) ** 2;
  }
  const rms = Math.sqrt(squared / left.length);
  return clamp01(1 - rms * 1.8);
}

function nearestSimilarity(features: number[], examples: number[][]) {
  if (examples.length === 0) return null;
  const values = examples
    .map((example) => similarity(features, example))
    .sort((a, b) => b - a)
    .slice(0, Math.min(8, examples.length));
  return mean(values);
}

function scoreVisualStyle(
  features: number[],
  categoryExamples: { approved: number[][]; rejected: number[][] },
): FeatureScore {
  const approvedSimilarity = nearestSimilarity(features, categoryExamples.approved);
  const rejectedSimilarity = nearestSimilarity(features, categoryExamples.rejected);
  const approvedCount = categoryExamples.approved.length;
  const rejectedCount = categoryExamples.rejected.length;

  let visualScore = 50;
  if (approvedCount >= 3 && rejectedCount >= 3) {
    visualScore = clamp100(
      50 +
        ((approvedSimilarity ?? 0) - (rejectedSimilarity ?? 0)) * 230 +
        ((approvedSimilarity ?? 0) - 0.72) * 65,
    );
  } else if (approvedCount >= 3) {
    visualScore = clamp100(15 + (approvedSimilarity ?? 0) * 85);
  }

  return {
    visualScore,
    approvedSimilarity,
    rejectedSimilarity,
    approvedCount,
    rejectedCount,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
) {
  const output = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, () =>
      worker(),
    ),
  );
  return output;
}

function emptyExampleSets(): VisualExampleSets {
  return {
    kpop: { approved: [], rejected: [] },
    cheer: { approved: [], rejected: [] },
  };
}

function addExample(
  sets: VisualExampleSets,
  category: AiImportCategory,
  status: ReviewStatus,
  features: number[],
) {
  const bucket = sets[category][status];
  if (bucket.length < HISTORY_PER_BUCKET) bucket.push(features);
}

async function loadReviewExamples(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("ai_import_candidates")
    .select("id, category, status, thumbnail_url, score_breakdown")
    .in("category", ["kpop", "cheer"])
    .in("status", ["approved", "rejected"])
    .not("thumbnail_url", "is", null)
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    throw new Error(`Failed to load thumbnail feedback history: ${error.message}`);
  }

  const rows = (data ?? []) as ReviewExample[];
  const sets = emptyExampleSets();
  const missing: ReviewExample[] = [];

  for (const row of rows) {
    if (
      (row.category !== "kpop" && row.category !== "cheer") ||
      (row.status !== "approved" && row.status !== "rejected")
    ) {
      continue;
    }
    const features = cachedFeatures(row.score_breakdown);
    if (features) addExample(sets, row.category, row.status, features);
    else if (row.thumbnail_url) missing.push(row);
  }

  const toDownload = missing.slice(0, HISTORY_DOWNLOAD_LIMIT);
  const extracted = await mapWithConcurrency(
    toDownload,
    HISTORY_CONCURRENCY,
    async (row) => {
      try {
        const features = await extractThumbnailStyleFeatures(row.thumbnail_url!);
        return { row, features };
      } catch (error) {
        console.warn("THUMBNAIL HISTORY FEATURE ERROR:", row.id, error);
        return { row, features: null as number[] | null };
      }
    },
  );

  await mapWithConcurrency(
    extracted.filter((item) => item.features),
    HISTORY_CONCURRENCY,
    async ({ row, features }) => {
      addExample(sets, row.category, row.status, features!);
      const current = row.score_breakdown ?? {};
      const { error: updateError } = await supabase
        .from("ai_import_candidates")
        .update({
          score_breakdown: {
            ...current,
            thumbnailStyle: {
              ...(typeof current.thumbnailStyle === "object" && current.thumbnailStyle
                ? (current.thumbnailStyle as Record<string, unknown>)
                : {}),
              features,
              featureVersion: 1,
            },
          },
        })
        .eq("id", row.id);
      if (updateError) {
        console.warn("THUMBNAIL HISTORY CACHE ERROR:", row.id, updateError.message);
      }
      return null;
    },
  );

  return {
    sets,
    downloadedHistoryCount: extracted.filter((item) => item.features).length,
  };
}

export async function applyThumbnailStyleScores(
  supabase: SupabaseClient,
  options: { batchKey: string; runId?: string },
) {
  const { data, error } = await supabase
    .from("ai_import_candidates")
    .select(
      "id, category, thumbnail_url, heuristic_score, ai_score, ai_reason, score_breakdown",
    )
    .eq("batch_key", options.batchKey)
    .eq("status", "pending")
    .in("category", ["kpop", "cheer"]);

  if (error) {
    throw new Error(`Failed to load current thumbnail candidates: ${error.message}`);
  }

  const candidates = (data ?? []) as PendingCandidate[];
  if (candidates.length === 0) {
    return {
      candidateCount: 0,
      visuallyScoredCount: 0,
      visualFailureCount: 0,
      visualWeight: 0.7,
    };
  }

  const history = await loadReviewExamples(supabase);
  let visuallyScoredCount = 0;
  let visualFailureCount = 0;

  const scored = await mapWithConcurrency(
    candidates,
    CURRENT_CONCURRENCY,
    async (candidate) => {
      if (!candidate.thumbnail_url) {
        visualFailureCount += 1;
        return { candidate, features: null, featureScore: null, finalScore: null };
      }

      try {
        const features = await extractThumbnailStyleFeatures(candidate.thumbnail_url);
        const featureScore = scoreVisualStyle(features, history.sets[candidate.category]);
        const metadataScore = clamp100(
          candidate.heuristic_score ?? candidate.ai_score ?? 50,
        );
        const hasUsefulHistory = featureScore.approvedCount >= 3;
        const finalScore = hasUsefulHistory
          ? clamp100(featureScore.visualScore * 0.7 + metadataScore * 0.3)
          : metadataScore;
        visuallyScoredCount += 1;
        return { candidate, features, featureScore, finalScore };
      } catch (featureError) {
        visualFailureCount += 1;
        console.warn("THUMBNAIL CANDIDATE FEATURE ERROR:", candidate.id, featureError);
        return { candidate, features: null, featureScore: null, finalScore: null };
      }
    },
  );

  await mapWithConcurrency(scored, CURRENT_CONCURRENCY, async (result) => {
    if (!result.features || !result.featureScore || result.finalScore == null) return null;

    const candidate = result.candidate;
    const metadataScore = clamp100(
      candidate.heuristic_score ?? candidate.ai_score ?? 50,
    );
    const current = candidate.score_breakdown ?? {};
    const hasUsefulHistory = result.featureScore.approvedCount >= 3;
    const reason = hasUsefulHistory
      ? `Thumbnail ${result.featureScore.visualScore} · Meta ${metadataScore}`
      : `Thumbnail profile learning (${result.featureScore.approvedCount} approvals) · Meta ${metadataScore}`;

    const { error: updateError } = await supabase
      .from("ai_import_candidates")
      .update({
        ai_score: result.finalScore,
        ai_reason: `${reason}${candidate.ai_reason ? ` · ${candidate.ai_reason}` : ""}`.slice(
          0,
          900,
        ),
        score_breakdown: {
          ...current,
          metadataScore,
          finalScore: result.finalScore,
          thumbnailStyleScore: result.featureScore.visualScore,
          thumbnailStyle: {
            features: result.features,
            featureVersion: 1,
            approvedSimilarity: result.featureScore.approvedSimilarity,
            rejectedSimilarity: result.featureScore.rejectedSimilarity,
            approvedCount: result.featureScore.approvedCount,
            rejectedCount: result.featureScore.rejectedCount,
            visualWeight: hasUsefulHistory ? 0.7 : 0,
          },
        },
      })
      .eq("id", candidate.id);

    if (updateError) {
      console.warn("THUMBNAIL SCORE UPDATE ERROR:", candidate.id, updateError.message);
    }
    return null;
  });

  const stats = {
    candidateCount: candidates.length,
    visuallyScoredCount,
    visualFailureCount,
    visualWeight: 0.7,
    approvedExamples: {
      kpop: history.sets.kpop.approved.length,
      cheer: history.sets.cheer.approved.length,
    },
    rejectedExamples: {
      kpop: history.sets.kpop.rejected.length,
      cheer: history.sets.cheer.rejected.length,
    },
    downloadedHistoryCount: history.downloadedHistoryCount,
  };

  if (options.runId) {
    const { data: run } = await supabase
      .from("ai_import_runs")
      .select("stats")
      .eq("id", options.runId)
      .maybeSingle();
    const currentStats =
      run?.stats && typeof run.stats === "object"
        ? (run.stats as Record<string, unknown>)
        : {};
    await supabase
      .from("ai_import_runs")
      .update({ stats: { ...currentStats, thumbnailStyle: stats } })
      .eq("id", options.runId);
  }

  return stats;
}
