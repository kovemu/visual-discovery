import {
  buildCanonicalTikTokUrl,
  extractTikTokVideoId,
} from "@/lib/tiktok/extractTikTokVideoId";

export type SubmissionSourceType =
  | "youtube"
  | "tiktok";

export type ParsedSubmissionUrl = {
  source_type: SubmissionSourceType;
  source_url: string;
  source_id: string;
};

const YOUTUBE_VIDEO_ID =
  /^[\w-]{11}$/;

function normalizeYouTubeHost(
  hostname: string,
) {
  return hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/^m\./, "");
}

export function parseYouTubeVideoId(
  input: string,
): string | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const withProtocol =
    /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    const host = normalizeYouTubeHost(
      parsed.hostname,
    );

    if (host === "youtu.be") {
      const id = parsed.pathname
        .slice(1)
        .split("/")[0];

      return id &&
        YOUTUBE_VIDEO_ID.test(id)
        ? id
        : null;
    }

    if (host !== "youtube.com") {
      return null;
    }

    if (parsed.pathname === "/watch") {
      const id =
        parsed.searchParams.get("v");

      return id &&
        YOUTUBE_VIDEO_ID.test(id)
        ? id
        : null;
    }

    const shortsMatch =
      parsed.pathname.match(
        /^\/shorts\/([\w-]{11})\/?$/,
      );

    if (
      shortsMatch &&
      YOUTUBE_VIDEO_ID.test(
        shortsMatch[1],
      )
    ) {
      return shortsMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

export function parseSubmissionUrl(
  input: string,
): ParsedSubmissionUrl | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const tiktokVideoId =
    extractTikTokVideoId(trimmed);
  const tiktokCanonical =
    buildCanonicalTikTokUrl(trimmed);

  if (tiktokVideoId && tiktokCanonical) {
    return {
      source_type: "tiktok",
      source_url: tiktokCanonical,
      source_id: tiktokVideoId,
    };
  }

  const youtubeVideoId =
    parseYouTubeVideoId(trimmed);

  if (youtubeVideoId) {
    return {
      source_type: "youtube",
      source_url: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
      source_id: youtubeVideoId,
    };
  }

  return null;
}
