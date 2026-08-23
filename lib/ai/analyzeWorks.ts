import OpenAI from "openai";

export const ANALYZE_WORKS_BATCH_SIZE = 20;

export const OPENAI_WORK_ANALYSIS_MODEL =
  process.env.OPENAI_WORK_ANALYSIS_MODEL ??
  "gpt-4.1-nano";

export const WORK_CONTENT_TYPES = [
  "live_stage",
  "fancam",
  "performance",
  "visual",
  "challenge",
  "behind",
  "mv",
  "other",
] as const;

export const WORK_ACTIONS = [
  "keep",
  "review",
  "reject",
  "featured",
] as const;

export const WORK_SOURCE_TABS = [
  "shorts",
  "videos",
  "fancams",
  "additional",
] as const;

export type WorkContentType =
  (typeof WORK_CONTENT_TYPES)[number];

export type WorkAction =
  (typeof WORK_ACTIONS)[number];

export type WorkSourceTab =
  (typeof WORK_SOURCE_TABS)[number];

export type WorkAnalysis = {
  id: string;
  contentType: WorkContentType;
  discoveryScore: number;
  action: WorkAction;
  reason: string;
};

export type WorkAnalysisCandidate = {
  id: string;
  title: string;
  description?: string;
  duration?: string;
  durationSeconds?: number;
  viewCount?: number;
  likeCount?: number;
  channelTitle?: string;
  publishedAt?: string;
  sourceTab?: WorkSourceTab;
  artistName?: string;
};

const WORK_CONTENT_TYPE_SET = new Set<
  string
>(WORK_CONTENT_TYPES);

const WORK_ACTION_SET = new Set<
  string
>(WORK_ACTIONS);

const WORK_SOURCE_TAB_SET = new Set<
  string
>(WORK_SOURCE_TABS);

const DESCRIPTION_LIMIT = 400;

export const WORK_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
          },
          contentType: {
            type: "string",
            enum: [
              ...WORK_CONTENT_TYPES,
            ],
          },
          discoveryScore: {
            type: "integer",
            minimum: 0,
            maximum: 100,
          },
          action: {
            type: "string",
            enum: [...WORK_ACTIONS],
          },
          reason: {
            type: "string",
          },
        },
        required: [
          "id",
          "contentType",
          "discoveryScore",
          "action",
          "reason",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

export const WORK_ANALYSIS_SYSTEM_PROMPT = `You are a curator for Kovemu, a K-pop discovery platform.

Kovemu helps first-time viewers quickly discover an artist's music, performance, and visual identity.

Score and classify each work from metadata only. You recommend only. Never import or delete works.

Prefer and score highly:
- live singing highlight
- music show stage
- stage highlight
- strong chorus / killing-part clip
- high-quality fancam
- performance clip
- visually striking short clip

Score low:
- dance challenge
- repetitive challenge clip
- greeting
- behind-the-scenes
- vlog
- meme
- promotional announcement
- teaser
- content mainly for existing fans

Official music videos:
- contentType must be "mv"
- action must be "featured"
- MV is for Artist Profile Featured, not Discover

Actions:
- keep: strong Discover candidate
- review: possible, but a human should preview first
- reject: poor Discover fit
- featured: official MV / Featured-profile material

Rules:
- Return exactly one result for every input work
- Do not omit any work
- Use the exact input id
- discoveryScore must be an integer from 0 to 100
- reason must be one or two short sentences`;

type WorkAnalysisBatch = {
  results: WorkAnalysis[];
};

export function sanitizeAiErrorMessage(
  message: string,
) {
  return message.replace(
    /sk-[A-Za-z0-9_-]+/g,
    "[REDACTED]",
  );
}

export function clampDiscoveryScore(
  value: unknown,
) {
  const numeric =
    typeof value === "number"
      ? value
      : Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, Math.round(numeric)),
  );
}

function isWorkContentType(
  value: unknown,
): value is WorkContentType {
  return (
    typeof value === "string" &&
    WORK_CONTENT_TYPE_SET.has(value)
  );
}

function isWorkAction(
  value: unknown,
): value is WorkAction {
  return (
    typeof value === "string" &&
    WORK_ACTION_SET.has(value)
  );
}

function isWorkSourceTab(
  value: unknown,
): value is WorkSourceTab {
  return (
    typeof value === "string" &&
    WORK_SOURCE_TAB_SET.has(value)
  );
}

function truncateText(
  value: string,
  limit: number,
) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit).trimEnd()}…`;
}

export function parseWorkAnalysisCandidates(
  rawWorks: unknown,
  fallbackArtistName?: string,
): WorkAnalysisCandidate[] {
  if (!Array.isArray(rawWorks)) {
    return [];
  }

  const candidates: WorkAnalysisCandidate[] =
    [];

  for (const raw of rawWorks) {
    if (
      !raw ||
      typeof raw !== "object"
    ) {
      continue;
    }

    const work = raw as Record<
      string,
      unknown
    >;

    const id =
      typeof work.id === "string"
        ? work.id.trim()
        : typeof work.videoId ===
            "string"
          ? work.videoId.trim()
          : typeof work.source_id ===
              "string"
            ? work.source_id.trim()
            : "";

    const title =
      typeof work.title === "string"
        ? work.title.trim()
        : "";

    if (!id || !title) {
      continue;
    }

    const candidate: WorkAnalysisCandidate =
      {
        id,
        title,
      };

    if (
      typeof work.description ===
        "string" &&
      work.description.trim()
    ) {
      candidate.description =
        truncateText(
          work.description.trim(),
          DESCRIPTION_LIMIT,
        );
    }

    if (
      typeof work.duration ===
        "string" &&
      work.duration.trim()
    ) {
      candidate.duration =
        work.duration.trim();
    }

    if (
      typeof work.durationSeconds ===
        "number" &&
      Number.isFinite(
        work.durationSeconds,
      )
    ) {
      candidate.durationSeconds =
        work.durationSeconds;
    }

    if (
      typeof work.viewCount ===
        "number" &&
      Number.isFinite(work.viewCount)
    ) {
      candidate.viewCount =
        work.viewCount;
    }

    if (
      typeof work.likeCount ===
        "number" &&
      Number.isFinite(work.likeCount)
    ) {
      candidate.likeCount =
        work.likeCount;
    }

    if (
      typeof work.channelTitle ===
        "string" &&
      work.channelTitle.trim()
    ) {
      candidate.channelTitle =
        work.channelTitle.trim();
    }

    if (
      typeof work.publishedAt ===
        "string" &&
      work.publishedAt.trim()
    ) {
      candidate.publishedAt =
        work.publishedAt.trim();
    }

    if (isWorkSourceTab(work.sourceTab)) {
      candidate.sourceTab =
        work.sourceTab;
    }

    const artistName =
      typeof work.artistName ===
        "string" &&
      work.artistName.trim()
        ? work.artistName.trim()
        : fallbackArtistName?.trim();

    if (artistName) {
      candidate.artistName = artistName;
    }

    candidates.push(candidate);
  }

  return candidates;
}

export function normalizeWorkAnalysis(
  raw: unknown,
  allowedIds: Set<string>,
): WorkAnalysis | null {
  if (
    !raw ||
    typeof raw !== "object"
  ) {
    return null;
  }

  const value = raw as Record<
    string,
    unknown
  >;

  const id =
    typeof value.id === "string"
      ? value.id.trim()
      : "";

  if (!id || !allowedIds.has(id)) {
    return null;
  }

  const contentType = isWorkContentType(
    value.contentType,
  )
    ? value.contentType
    : "other";

  const action = isWorkAction(
    value.action,
  )
    ? value.action
    : "review";

  const reason =
    typeof value.reason === "string"
      ? value.reason.trim()
      : "";

  return {
    id,
    contentType:
      contentType === "mv"
        ? "mv"
        : contentType,
    discoveryScore: clampDiscoveryScore(
      value.discoveryScore,
    ),
    action:
      contentType === "mv"
        ? "featured"
        : action,
    reason,
  };
}

export async function analyzeWorksWithOpenAI(
  works: WorkAnalysisCandidate[],
): Promise<WorkAnalysis[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured.",
    );
  }

  if (works.length === 0) {
    return [];
  }

  if (
    works.length >
    ANALYZE_WORKS_BATCH_SIZE
  ) {
    throw new Error(
      `A batch can include at most ${ANALYZE_WORKS_BATCH_SIZE} works.`,
    );
  }

  const client = new OpenAI({
    apiKey,
  });

  const allowedIds = new Set(
    works.map((work) => work.id),
  );

  const results =
    await requestWorkAnalysisBatch(
      client,
      works,
      allowedIds,
    );

  const missing = works.filter(
    (work) =>
      !results.some(
        (result) =>
          result.id === work.id,
      ),
  );

  if (missing.length === 0) {
    return results;
  }

  const retryResults =
    await requestWorkAnalysisBatch(
      client,
      missing,
      new Set(
        missing.map((work) => work.id),
      ),
    );

  return [...results, ...retryResults];
}

async function requestWorkAnalysisBatch(
  client: OpenAI,
  works: WorkAnalysisCandidate[],
  allowedIds: Set<string>,
) {
  const response =
    await client.responses.parse({
      model: OPENAI_WORK_ANALYSIS_MODEL,
      max_output_tokens: 4000,
      input: [
        {
          role: "system",
          content:
            WORK_ANALYSIS_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify({
            count: works.length,
            requiredIds: works.map(
              (work) => work.id,
            ),
            works,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "kovemu_work_analysis_batch",
          strict: true,
          schema: WORK_ANALYSIS_SCHEMA,
          description:
            "Batch Kovemu Discover judgments for YouTube work candidates.",
        },
      },
    });

  const parsed =
    response.output_parsed as WorkAnalysisBatch | null;

  if (!parsed?.results) {
    throw new Error(
      "OpenAI returned no parsed work analysis.",
    );
  }

  const results: WorkAnalysis[] = [];
  const seen = new Set<string>();

  for (const raw of parsed.results) {
    const normalized =
      normalizeWorkAnalysis(
        raw,
        allowedIds,
      );

    if (
      !normalized ||
      seen.has(normalized.id)
    ) {
      continue;
    }

    seen.add(normalized.id);
    results.push(normalized);
  }

  return results;
}
