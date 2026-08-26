import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/requireAdmin";
import {
  cacheTikTokThumbnail,
  isPermanentTikTokThumbnailUrl,
} from "@/lib/tiktok/cacheTikTokThumbnail";
import {
  buildCanonicalTikTokUrl,
  extractTikTokVideoId,
} from "@/lib/tiktok/extractTikTokVideoId";
import {
  asOptionalOEmbedString,
  fetchTikTokOEmbed,
} from "@/lib/tiktok/fetchTikTokOEmbed";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const CONCURRENCY = 3;

type TikTokWorkRow = {
  id: number;
  source_id: string | null;
  source_url: string | null;
  thumbnail_url: string | null;
};

type RepairFailure = {
  workId: string;
  sourceId: string;
  reason: string;
};

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, () => worker()),
  );

  return results;
}

function parseLimitOffset(body: unknown) {
  const payload =
    body && typeof body === "object"
      ? (body as {
          limit?: unknown;
          offset?: unknown;
        })
      : {};

  const rawLimit =
    typeof payload.limit === "number"
      ? payload.limit
      : DEFAULT_LIMIT;
  const rawOffset =
    typeof payload.offset === "number"
      ? payload.offset
      : 0;

  if (
    !Number.isInteger(rawLimit) ||
    rawLimit < 1 ||
    !Number.isInteger(rawOffset) ||
    rawOffset < 0
  ) {
    return null;
  }

  return {
    limit: Math.min(rawLimit, MAX_LIMIT),
    offset: rawOffset,
  };
}

function resolveTikTokVideoId(work: TikTokWorkRow) {
  if (
    typeof work.source_id === "string" &&
    /^\d+$/.test(work.source_id.trim())
  ) {
    return work.source_id.trim();
  }

  return extractTikTokVideoId(work.source_url);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return adminAuthErrorResponse(auth);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase server configuration is missing." },
      { status: 500 },
    );
  }

  let body: unknown = {};

  try {
    const text = await request.text();

    if (text.trim()) {
      body = JSON.parse(text);
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const paging = parseLimitOffset(body);

  if (!paging) {
    return NextResponse.json(
      { error: "limit and offset must be non-negative integers." },
      { status: 400 },
    );
  }

  const supabaseAdmin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const { data, error } = await supabaseAdmin
    .from("works")
    .select("id, source_id, source_url, thumbnail_url")
    .eq("source", "tiktok")
    .order("id", { ascending: true })
    .range(
      paging.offset,
      paging.offset + paging.limit - 1,
    );

  if (error) {
    console.error("REPAIR TIKTOK THUMBNAILS QUERY ERROR:", error);

    return NextResponse.json(
      { error: error.message },
      { status: 400 },
    );
  }

  const works = (data ?? []) as TikTokWorkRow[];
  const failures: RepairFailure[] = [];
  let repaired = 0;
  let skipped = 0;

  await mapWithConcurrency(works, CONCURRENCY, async (work) => {
    if (isPermanentTikTokThumbnailUrl(work.thumbnail_url)) {
      skipped += 1;
      return;
    }

    const videoId = resolveTikTokVideoId(work);

    if (!videoId) {
      failures.push({
        workId: String(work.id),
        sourceId: work.source_id ?? "",
        reason: "missing_source_id",
      });
      return;
    }

    const canonicalUrl =
      buildCanonicalTikTokUrl(work.source_url) ??
      work.source_url?.trim() ??
      null;

    if (!canonicalUrl) {
      failures.push({
        workId: String(work.id),
        sourceId: videoId,
        reason: "missing_source_url",
      });
      return;
    }

    const oembed = await fetchTikTokOEmbed(canonicalUrl);

    if (!oembed.ok) {
      failures.push({
        workId: String(work.id),
        sourceId: videoId,
        reason: `oembed_failed:${oembed.status}`,
      });
      return;
    }

    const temporaryThumbnailUrl = asOptionalOEmbedString(
      oembed.data.thumbnail_url,
    );

    if (!temporaryThumbnailUrl) {
      failures.push({
        workId: String(work.id),
        sourceId: videoId,
        reason: "oembed_missing_thumbnail",
      });
      return;
    }

    const publicUrl = await cacheTikTokThumbnail({
      videoId,
      temporaryThumbnailUrl,
    });

    if (!publicUrl) {
      failures.push({
        workId: String(work.id),
        sourceId: videoId,
        reason: "thumbnail_cache_failed",
      });
      return;
    }

    const { error: updateError } = await supabaseAdmin
      .from("works")
      .update({ thumbnail_url: publicUrl })
      .eq("id", work.id)
      .eq("source", "tiktok");

    if (updateError) {
      console.error("REPAIR TIKTOK THUMBNAIL UPDATE ERROR:", {
        workId: work.id,
        sourceId: videoId,
        reason: updateError.message,
      });

      failures.push({
        workId: String(work.id),
        sourceId: videoId,
        reason: "thumbnail_update_failed",
      });
      return;
    }

    repaired += 1;
  });

  return NextResponse.json({
    total: works.length,
    repaired,
    skipped,
    failed: failures.length,
    failures,
    limit: paging.limit,
    offset: paging.offset,
  });
}
