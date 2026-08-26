import { NextRequest, NextResponse } from "next/server";

import {
  asOptionalOEmbedString,
  fetchTikTokOEmbed,
} from "@/lib/tiktok/fetchTikTokOEmbed";
import {
  buildCanonicalTikTokUrl,
  extractTikTokVideoId,
} from "@/lib/tiktok/extractTikTokVideoId";

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
    title: asOptionalOEmbedString(data.title),
    author_name: asOptionalOEmbedString(
      data.author_name,
    ),
    author_url: asOptionalOEmbedString(
      data.author_url,
    ),
    thumbnail_url: asOptionalOEmbedString(
      data.thumbnail_url,
    ),
    html: asOptionalOEmbedString(data.html),
    oembedFailed: false,
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
