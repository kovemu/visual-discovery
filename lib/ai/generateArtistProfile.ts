import OpenAI from "openai";

import { sanitizeAiErrorMessage } from "@/lib/ai/analyzeWorks";

export const OPENAI_ARTIST_PROFILE_MODEL =
  process.env.OPENAI_ARTIST_PROFILE_MODEL ??
  "gpt-5.6-terra";

export const RESEARCH_SOURCE_TYPES = [
  "kprofiles",
  "official",
  "youtube",
  "other",
] as const;

export type ResearchSourceType =
  (typeof RESEARCH_SOURCE_TYPES)[number];

export type ResearchSource = {
  title: string;
  url: string;
  sourceType: ResearchSourceType;
};

export type ArtistProfileGeneration = {
  tagline: string;
  bio: string;
  researchSummary: {
    sourcesUsed: ResearchSource[];
  };
};

export type ArtistProfileGenerationInput = {
  artistName: string;
  channelDescription?: string;
  youtubeHandle?: string;
  youtubeUrl?: string;
};

const CHANNEL_DESCRIPTION_LIMIT = 1200;

const RESEARCH_SOURCE_TYPE_SET = new Set<
  string
>(RESEARCH_SOURCE_TYPES);

export const ARTIST_PROFILE_SCHEMA = {
  type: "object",
  properties: {
    tagline: {
      type: "string",
    },
    bio: {
      type: "string",
    },
    researchSummary: {
      type: "object",
      properties: {
        sourcesUsed: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: {
                type: "string",
              },
              url: {
                type: "string",
              },
              sourceType: {
                type: "string",
                enum: [
                  ...RESEARCH_SOURCE_TYPES,
                ],
              },
            },
            required: [
              "title",
              "url",
              "sourceType",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["sourcesUsed"],
      additionalProperties: false,
    },
  },
  required: [
    "tagline",
    "bio",
    "researchSummary",
  ],
  additionalProperties: false,
} as const;

export const ARTIST_PROFILE_SYSTEM_PROMPT = `You write Kovemu K-pop artist profiles from live web research.

Kovemu is a K-pop discovery platform. Write English tagline and bio copy that matches how Kovemu manually introduces artists: factual, specific, and natural.

You MUST use the built-in web search tool before writing. Do not write from memory alone.

Research order:
1. Search "{Artist Name} KProfiles" first
2. Artist / agency official sites
3. Official YouTube
4. Official social profiles
5. Reliable music / entertainment sources

Use KProfiles as a primary reference, then cross-check key facts with official sources when possible.
Do not copy KProfiles sentences. Use facts only, then write original Kovemu English copy.

Identity check:
- Confirm this is the same artist as the provided YouTube handle / channel URL
- If similar names exist, use handle, channel URL, agency, or debut facts to disambiguate
- If you are not sure it is the same artist, do not guess

Include only verified facts, written naturally when available:
- group / solo introduction
- agency
- debut timing / debut work
- meaning or origin of the name
- current member names
- musical identity
- performance identity
- notable activity, representative songs, or career context
- current activity context

Never invent:
- name meaning
- member lineup
- debut date
- agency
- disbandment / departure / joining
- awards
- representative songs

For groups, include current members when a recent reliable source confirms them.
If KProfiles and an official source disagree, prefer the most recent official source.
Do not present former members as current members.

Name meaning: include only if a reliable source states it.

Style:
- Do not force every artist into the same 3-paragraph template
- Use 2 paragraphs, 3 paragraphs, or a short bio depending on confirmed information
- Vary openings and sentence rhythm
- Write a natural introduction, not a bullet dump
- Avoid fandom hype and generic marketing copy

Tagline:
- One English sentence
- Specific to this artist's music or performance identity
- Avoid generic lines like "Discover the fresh sound of {name}, a K-pop group with vibrant performances."
- Do not use unverified concepts

If sources are thin, write a short conservative bio from confirmed facts only.`;

export { sanitizeAiErrorMessage };

function truncateText(
  value: string,
  limit: number,
) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit).trimEnd()}…`;
}

function isResearchSourceType(
  value: unknown,
): value is ResearchSourceType {
  return (
    typeof value === "string" &&
    RESEARCH_SOURCE_TYPE_SET.has(value)
  );
}

function classifySourceType(
  url: string,
): ResearchSourceType {
  try {
    const host = new URL(url).hostname
      .replace(/^www\./, "")
      .toLowerCase();

    if (host.includes("kprofiles.com")) {
      return "kprofiles";
    }

    if (
      host.includes("youtube.com") ||
      host.includes("youtu.be")
    ) {
      return "youtube";
    }

    if (
      host.includes("smtown") ||
      host.includes("hybecorp") ||
      host.includes("jype") ||
      host.includes("ygent") ||
      host.includes("starship-ent") ||
      host.includes("cubeent") ||
      host.includes("pledis") ||
      host.includes("wakeone")
    ) {
      return "official";
    }

    return "other";
  } catch {
    return "other";
  }
}

function normalizeSource(
  raw: unknown,
): ResearchSource | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Record<
    string,
    unknown
  >;

  const url =
    typeof value.url === "string"
      ? value.url.trim()
      : "";
  const title =
    typeof value.title === "string"
      ? value.title.trim()
      : "";

  if (!url || !/^https?:\/\//i.test(url)) {
    return null;
  }

  return {
    title: title || url,
    url,
    sourceType: isResearchSourceType(
      value.sourceType,
    )
      ? value.sourceType
      : classifySourceType(url),
  };
}

function mergeSources(
  ...groups: ResearchSource[][]
) {
  const merged: ResearchSource[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    for (const source of group) {
      const key = source.url
        .replace(/\/+$/, "")
        .toLowerCase();

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(source);
    }
  }

  return merged;
}

function extractUrlCitations(
  response: {
    output?: unknown;
  },
) {
  const sources: ResearchSource[] = [];

  if (!Array.isArray(response.output)) {
    return sources;
  }

  for (const item of response.output) {
    if (
      !item ||
      typeof item !== "object" ||
      !("content" in item) ||
      !Array.isArray(item.content)
    ) {
      continue;
    }

    for (const content of item.content) {
      if (
        !content ||
        typeof content !== "object" ||
        !("annotations" in content) ||
        !Array.isArray(content.annotations)
      ) {
        continue;
      }

      for (const annotation of content.annotations) {
        if (
          !annotation ||
          typeof annotation !== "object"
        ) {
          continue;
        }

        const record = annotation as {
          type?: string;
          title?: string | null;
          url?: string | null;
        };

        if (
          record.type !== "url_citation" ||
          !record.url
        ) {
          continue;
        }

        const normalized = normalizeSource({
          title: record.title ?? "",
          url: record.url,
        });

        if (normalized) {
          sources.push(normalized);
        }
      }
    }
  }

  return sources;
}

export function parseArtistProfileGenerationInput(
  body: unknown,
): ArtistProfileGenerationInput | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const payload = body as Record<
    string,
    unknown
  >;

  const artistName =
    typeof payload.artistName ===
    "string"
      ? payload.artistName.trim()
      : "";

  if (!artistName) {
    return null;
  }

  const input: ArtistProfileGenerationInput =
    {
      artistName,
    };

  if (
    typeof payload.channelDescription ===
      "string" &&
    payload.channelDescription.trim()
  ) {
    input.channelDescription =
      truncateText(
        payload.channelDescription.trim(),
        CHANNEL_DESCRIPTION_LIMIT,
      );
  }

  if (
    typeof payload.youtubeHandle ===
      "string" &&
    payload.youtubeHandle.trim()
  ) {
    input.youtubeHandle =
      payload.youtubeHandle.trim();
  }

  if (
    typeof payload.youtubeUrl ===
      "string" &&
    payload.youtubeUrl.trim()
  ) {
    input.youtubeUrl =
      payload.youtubeUrl.trim();
  }

  return input;
}

export async function generateArtistProfileWithOpenAI(
  input: ArtistProfileGenerationInput,
): Promise<ArtistProfileGeneration> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured.",
    );
  }

  const client = new OpenAI({
    apiKey,
  });

  const response =
    await client.responses.parse({
      model: OPENAI_ARTIST_PROFILE_MODEL,
      max_output_tokens: 4000,
      tools: [
        {
          type: "web_search",
        },
      ],
      input: [
        {
          role: "system",
          content:
            ARTIST_PROFILE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify({
            artistName: input.artistName,
            searchFirst: `${input.artistName} KProfiles`,
            ...(input.youtubeHandle
              ? {
                  youtubeHandle:
                    input.youtubeHandle,
                }
              : {}),
            ...(input.youtubeUrl
              ? {
                  youtubeUrl:
                    input.youtubeUrl,
                }
              : {}),
            ...(input.channelDescription
              ? {
                  channelDescription:
                    input.channelDescription,
                }
              : {}),
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "kovemu_artist_profile",
          strict: true,
          schema: ARTIST_PROFILE_SCHEMA,
          description:
            "Kovemu artist tagline, bio, and research sources from web search.",
        },
      },
    });

  const parsed =
    response.output_parsed as ArtistProfileGeneration | null;

  const tagline = parsed?.tagline.trim() ?? "";
  const bio = parsed?.bio.trim() ?? "";

  if (!tagline || !bio || !parsed) {
    throw new Error(
      "OpenAI returned an incomplete artist profile.",
    );
  }

  const modelSources = (
    parsed.researchSummary.sourcesUsed ??
    []
  )
    .map(normalizeSource)
    .filter(
      (source): source is ResearchSource =>
        source !== null,
    );

  return {
    tagline,
    bio,
    researchSummary: {
      sourcesUsed: mergeSources(
        modelSources,
        extractUrlCitations(response),
      ),
    },
  };
}
