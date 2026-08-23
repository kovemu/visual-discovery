import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { buildCanonicalTikTokUrl } from "@/lib/tiktok/extractTikTokVideoId";

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
};

function resolveWorkSource(source: unknown) {
  return source === "tiktok" ? "tiktok" : "youtube";
}

export async function POST(request: NextRequest) {
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

    const rows = works.map((work) => {
      const source = resolveWorkSource(work.source);
      const sourceUrl =
        source === "tiktok"
          ? buildCanonicalTikTokUrl(work.url) ??
            work.url
          : work.url;

      return {
        artist_id: artistId,

        type: "video",
        source,

        source_id: work.id,
        source_url: sourceUrl,

        title: work.title,
        description: work.description || null,
        thumbnail_url: work.thumbnail || null,

        published_at:
          work.publishedAt ||
          (source === "tiktok"
            ? new Date().toISOString()
            : null),
        duration_seconds: work.durationSeconds ?? null,
        featured: work.featured === true,
      };
    });

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