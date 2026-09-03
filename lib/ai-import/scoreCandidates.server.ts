import OpenAI from "openai";

export type AiImportCategory = "kpop" | "cheer";

export type CategoryStyleProfile = {
  category: AiImportCategory;
  sampleSize: number;
  medianDurationSeconds: number;
  p25DurationSeconds: number;
  p75DurationSeconds: number;
  commonTitleMarkers: string[];
};

export type CandidateForAi = {
  id: string;
  category: AiImportCategory;
  subjectName: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  heuristicScore: number;
};

export type AiCandidateJudgment = {
  id: string;
  score: number;
  action: "keep" | "review" | "reject";
  contentType:
    | "fancam"
    | "performance"
    | "visual"
    | "challenge"
    | "behind"
    | "mv"
    | "news"
    | "other";
  reason: string;
};

const BATCH_SIZE = 20;
const MODEL =
  process.env.OPENAI_AI_IMPORT_MODEL ??
  process.env.OPENAI_WORK_ANALYSIS_MODEL ??
  "gpt-4.1-nano";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          score: {
            type: "integer",
            minimum: 0,
            maximum: 100,
          },
          action: {
            type: "string",
            enum: ["keep", "review", "reject"],
          },
          contentType: {
            type: "string",
            enum: [
              "fancam",
              "performance",
              "visual",
              "challenge",
              "behind",
              "mv",
              "news",
              "other",
            ],
          },
          reason: { type: "string" },
        },
        required: [
          "id",
          "score",
          "action",
          "contentType",
          "reason",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You curate automatic YouTube import candidates for Kovemu.

Kovemu is a discovery feed. The human curator historically imports short, immediately watchable clips. Your job is to judge whether a candidate is likely to match that existing curation style. This is a conservative pre-review step: a human will still approve candidates before Discover publication.

Use ONLY the supplied metadata. Do not claim to have watched the video or seen its framing.

CHEER preferences:
- strong preference for an individual cheerleader being the clear subject
- cheer/dance/performance/stadium or event clips
- direct fancam-style footage rather than news, interviews, commentary, slideshows, compilations, or promotional explainers
- short clips are especially compatible with the existing library
- reject likely unrelated people or ambiguous same-name matches

KPOP preferences:
- member/group fancam, live stage focus, performance highlight, short visual/performance clip
- individual-member focus is valuable when the subject name is explicit
- reject official MV, teaser, reaction/commentary, news, lyric video, unrelated edits, and generic promotional content
- dance challenges should normally score below genuine fancam/performance clips

Scoring:
- 85-100: very strong Kovemu candidate
- 70-84: good candidate
- 55-69: uncertain; human review may still be useful
- below 55: poor fit

Actions:
- keep: clear fit
- review: plausible but uncertain
- reject: likely poor fit, wrong subject, wrong content type, or low discovery value

Return exactly one result per input id. Keep reasons short and specific.`;

function clampScore(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeJudgment(
  raw: unknown,
  allowedIds: Set<string>,
): AiCandidateJudgment | null {
  if (!raw || typeof raw !== "object") return null;

  const value = raw as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id : "";
  if (!id || !allowedIds.has(id)) return null;

  const action =
    value.action === "keep" ||
    value.action === "review" ||
    value.action === "reject"
      ? value.action
      : "review";

  const allowedContentTypes = new Set([
    "fancam",
    "performance",
    "visual",
    "challenge",
    "behind",
    "mv",
    "news",
    "other",
  ]);

  const contentType =
    typeof value.contentType === "string" &&
    allowedContentTypes.has(value.contentType)
      ? (value.contentType as AiCandidateJudgment["contentType"])
      : "other";

  return {
    id,
    score: clampScore(value.score),
    action,
    contentType,
    reason:
      typeof value.reason === "string"
        ? value.reason.trim().slice(0, 500)
        : "",
  };
}

async function scoreBatch(
  client: OpenAI,
  candidates: CandidateForAi[],
  profiles: Record<AiImportCategory, CategoryStyleProfile>,
) {
  const allowedIds = new Set(candidates.map((candidate) => candidate.id));

  const response = await client.responses.parse({
    model: MODEL,
    max_output_tokens: 4000,
    input: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: JSON.stringify({
          styleProfiles: profiles,
          count: candidates.length,
          requiredIds: candidates.map((candidate) => candidate.id),
          candidates,
        }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "kovemu_ai_import_candidate_scores",
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
  });

  const parsed = response.output_parsed as
    | { results?: unknown[] }
    | null;

  const normalized: AiCandidateJudgment[] = [];
  const seen = new Set<string>();

  for (const raw of parsed?.results ?? []) {
    const judgment = normalizeJudgment(raw, allowedIds);
    if (!judgment || seen.has(judgment.id)) continue;
    seen.add(judgment.id);
    normalized.push(judgment);
  }

  return normalized;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
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

export async function scoreCandidatesWithAi(
  candidates: CandidateForAi[],
  profiles: Record<AiImportCategory, CategoryStyleProfile>,
) {
  if (candidates.length === 0) {
    return {
      judgments: [] as AiCandidateJudgment[],
      fallbackCount: 0,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      judgments: candidates.map((candidate) => ({
        id: candidate.id,
        score: candidate.heuristicScore,
        action:
          candidate.heuristicScore >= 72
            ? ("keep" as const)
            : ("review" as const),
        contentType: "other" as const,
        reason: "Metadata heuristic fallback; OpenAI scoring is unavailable.",
      })),
      fallbackCount: candidates.length,
    };
  }

  const client = new OpenAI({ apiKey });
  const batches: CandidateForAi[][] = [];

  for (let index = 0; index < candidates.length; index += BATCH_SIZE) {
    batches.push(candidates.slice(index, index + BATCH_SIZE));
  }

  let fallbackCount = 0;

  const batchResults = await mapWithConcurrency(
    batches,
    3,
    async (batch) => {
      try {
        const scored = await scoreBatch(client, batch, profiles);
        const scoredById = new Map(scored.map((item) => [item.id, item]));

        return batch.map((candidate) => {
          const result = scoredById.get(candidate.id);
          if (result) return result;

          fallbackCount += 1;
          return {
            id: candidate.id,
            score: candidate.heuristicScore,
            action:
              candidate.heuristicScore >= 72
                ? ("keep" as const)
                : ("review" as const),
            contentType: "other" as const,
            reason: "AI omitted this item; metadata heuristic was used.",
          };
        });
      } catch (error) {
        console.error("AI IMPORT SCORE BATCH ERROR:", error);
        fallbackCount += batch.length;
        return batch.map((candidate) => ({
          id: candidate.id,
          score: candidate.heuristicScore,
          action:
            candidate.heuristicScore >= 72
              ? ("keep" as const)
              : ("review" as const),
          contentType: "other" as const,
          reason: "AI scoring failed for this batch; metadata heuristic was used.",
        }));
      }
    },
  );

  return {
    judgments: batchResults.flat(),
    fallbackCount,
  };
}
