import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/requireAdmin";
import { normalizeRotationDegrees } from "@/lib/works/workRotation";
import { buildCanonicalTikTokUrl } from "@/lib/tiktok/extractTikTokVideoId";
import { resolveTikTokThumbnailUrl } from "@/lib/tiktok/resolveTikTokThumbnailUrl";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ImportWork = {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  publishedAt?: string;
  url: string;
  durationSeconds?: number;
  featured?: boolean;
  source?: string;
  rotation_degrees?: number;
};

type ImportWorkRow = {
  artist_id: string;
  type: string;
  source: string;
  source_id: string;
  source_url: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  featured: boolean;
  rotation_degrees: number;
};

function resolveWorkSource(source: unknown) {
  return source === "tiktok" ? "tiktok" : "youtube";
}

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

async function resolveTikTokThumbnailUrlForImport({
  videoId,
  incomingThumbnail,
  existingThumbnail,
}: {
  videoId: string;
  incomingThumbnail: string | null;
  existingThumbnail: string | null;
}) {
  return resolveTikTokThumbnailUrl({
    videoId,
    incomingThumbnail,
    existingThumbnail,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return adminAuthErrorResponse(auth);
  }

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase server configuration is missing." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const artistId = body.artistId as string;
    const works = body.works as ImportWork[];

    if (!artistId) {
      return NextResponse.json(
        { error: "Artist is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(works) || works.length === 0) {
      return NextResponse.json(
        { error: "No works selected." },
        { status: 400 }
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
      }
    );

    const tiktokSourceIds = works
      .filter((work) => resolveWorkSource(work.source) === "tiktok")
      .map((work) => work.id)
      .filter(Boolean);

    const existingThumbnailBySourceId = new Map<
      string,
      string | null
    >();

    if (tiktokSourceIds.length > 0) {
      const { data: existingTikTokWorks, error: existingError } =
        await supabaseAdmin
          .from("works")
          .select("source_id, thumbnail_url")
          .eq("source", "tiktok")
          .in("source_id", tiktokSourceIds);

      if (existingError) {
        console.error(
          "IMPORT WORKS EXISTING TIKTOK LOOKUP ERROR:",
          existingError,
        );
      } else {
        for (const row of existingTikTokWorks ?? []) {
          if (typeof row.source_id === "string") {
            existingThumbnailBySourceId.set(
              row.source_id,
              typeof row.thumbnail_url === "string"
                ? row.thumbnail_url
                : null,
            );
          }
        }
      }
    }

    const rows = await mapWithConcurrency(
      works,
      3,
      async (work): Promise<ImportWorkRow> => {
        const source = resolveWorkSource(work.source);
        const sourceUrl =
          source === "tiktok"
            ? buildCanonicalTikTokUrl(work.url) ??
              work.url
            : work.url;

        const incomingThumbnail =
          typeof work.thumbnail === "string" &&
          work.thumbnail.trim()
            ? work.thumbnail.trim()
            : null;

        let thumbnailUrl = incomingThumbnail;

        if (source === "tiktok") {
          thumbnailUrl = await resolveTikTokThumbnailUrlForImport({
            videoId: work.id,
            incomingThumbnail,
            existingThumbnail:
              existingThumbnailBySourceId.get(work.id) ??
              null,
          });
        }

        return {
          artist_id: artistId,

          type: "video",
          source,

          source_id: work.id,
          source_url: sourceUrl,

          title: work.title,
          description: work.description || null,
          thumbnail_url: thumbnailUrl,

          published_at:
            work.publishedAt ||
            (source === "tiktok"
              ? new Date().toISOString()
              : null),
          duration_seconds: work.durationSeconds ?? null,
          featured: work.featured === true,
          rotation_degrees: normalizeRotationDegrees(
            work.rotation_degrees,
          ),
        };
      },
    );

    const { data, error } = await supabaseAdmin
      .from("works")
      .upsert(rows, {
        onConflict: "source,source_id",
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error("IMPORT WORKS ERROR:", error);

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      importedCount: data?.length ?? 0,
      requestedCount: works.length,
    });
  } catch (error) {
    console.error("IMPORT WORKS SERVER ERROR:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
