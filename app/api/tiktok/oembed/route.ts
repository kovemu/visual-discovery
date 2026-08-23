import { NextRequest, NextResponse } from "next/server";

import {
  buildCanonicalTikTokUrl,
  extractTikTokVideoId,
} from "@/lib/tiktok/extractTikTokVideoId";

const TIKTOK_OEMBED_ENDPOINT =
  "https://www.tiktok.com/oembed";

const CACHE_TTL_MS =
  24 * 60 * 60 * 1000;

type CachedOEmbedPayload = {
  videoId: string;
  url: string;
  title: string | null;
  author_name: string | null;
  author_url: string | null;
  thumbnail_url: string | null;
  html: string | null;
  oembedFailed: false;
};

type CacheEntry = {
  expiresAt: number;
  payload: CachedOEmbedPayload;
};

const oembedCache =
  new Map<string, CacheEntry>();

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRetryAfterMs(
  value: string | null,
) {
  if (!value?.trim()) {
    return null;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const dateMs = Date.parse(value);

  if (Number.isFinite(dateMs)) {
    const delayMs = dateMs - Date.now();

    return delayMs > 0 ? delayMs : 0;
  }

  return null;
}

function getCachedPayload(
  videoId: string,
) {
  const entry = oembedCache.get(videoId);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    oembedCache.delete(videoId);
    return null;
  }

  return entry.payload;
}

function setCachedPayload(
  videoId: string,
  payload: CachedOEmbedPayload,
) {
  oembedCache.set(videoId, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    payload,
  });
}

function buildSuccessPayload(
  videoId: string,
  canonicalUrl: string,
  data: Record<string, unknown>,
): CachedOEmbedPayload {
  return {
    videoId,
    url: canonicalUrl,
    title: asOptionalString(data.title),
    author_name: asOptionalString(data.author_name),
    author_url: asOptionalString(data.author_url),
    thumbnail_url: asOptionalString(
      data.thumbnail_url,
    ),
    html: asOptionalString(data.html),
    oembedFailed: false,
  };
}

async function fetchTikTokOEmbed(
  canonicalUrl: string,
) {
  const oembedUrl = new URL(TIKTOK_OEMBED_ENDPOINT);
  oembedUrl.searchParams.set("url", canonicalUrl);

  let response = await fetch(oembedUrl, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 429) {
    const retryAfterMs = parseRetryAfterMs(
      response.headers.get("retry-after"),
    );

    if (retryAfterMs != null) {
      await sleep(retryAfterMs);

      response = await fetch(oembedUrl, {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });
    }
  }

  if (response.ok) {
    return {
      ok: true as const,
      data: (await response.json()) as Record<
        string,
        unknown
      >,
    };
  }

  return {
    ok: false as const,
    status: response.status,
  };
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get(
    "url",
  );
  const canonicalUrl =
    buildCanonicalTikTokUrl(rawUrl);
  const videoId = extractTikTokVideoId(
    canonicalUrl ?? rawUrl,
  );

  if (!rawUrl?.trim() || !videoId || !canonicalUrl) {
    return NextResponse.json(
      {
        error:
          "올바른 TikTok 영상 URL을 입력해주세요. 예: https://www.tiktok.com/@username/video/1234567890123456789",
      },
      { status: 400 },
    );
  }

  const cached = getCachedPayload(videoId);

  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const result = await fetchTikTokOEmbed(
      canonicalUrl,
    );

    if (!result.ok) {
      return NextResponse.json({
        videoId,
        url: canonicalUrl,
        title: null,
        author_name: null,
        author_url: null,
        thumbnail_url: null,
        html: null,
        oembedFailed: true,
        oembedStatus: result.status,
      });
    }

    const payload = buildSuccessPayload(
      videoId,
      canonicalUrl,
      result.data,
    );

    setCachedPayload(videoId, payload);

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({
      videoId,
      url: canonicalUrl,
      title: null,
      author_name: null,
      author_url: null,
      thumbnail_url: null,
      html: null,
      oembedFailed: true,
    });
  }
}
