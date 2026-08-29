import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

import { isAnonymousUser } from "@/lib/auth/userKind";
import { resolveImportedTikTokWork } from "@/lib/picks/importTikTokWork";
import {
  createImportedYouTubeWork,
  ensurePendingClipSubmission,
  findYouTubeWork,
  type ImportedWorkRow,
} from "@/lib/picks/importYouTubeWork";
import { insertWorkPick } from "@/lib/picks/insertWorkPick";
import { parseSubmissionUrl } from "@/lib/submissions/parseSubmissionUrl";
import { createClient } from "@/lib/supabase/server";
import { fetchYouTubeVideoMeta } from "@/lib/youtube/fetchYouTubeVideo";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const INVALID_URL_ERROR =
  "Enter a valid YouTube or TikTok URL.";

export async function POST(request: NextRequest) {
  try {
    const authSupabase = await createClient();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Login required." },
        { status: 401 },
      );
    }

    if (isAnonymousUser(user)) {
      return NextResponse.json(
        { error: "Login required." },
        { status: 403 },
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration is missing." },
        { status: 500 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid payload." },
        { status: 400 },
      );
    }

    const payload = body as { source_url?: unknown };

    if (
      typeof payload.source_url !== "string" ||
      !payload.source_url.trim()
    ) {
      return NextResponse.json(
        { error: INVALID_URL_ERROR },
        { status: 400 },
      );
    }

    const parsed = parseSubmissionUrl(payload.source_url);

    if (!parsed) {
      return NextResponse.json(
        { error: INVALID_URL_ERROR },
        { status: 400 },
      );
    }

    const supabaseAdmin = createServiceClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    let work: ImportedWorkRow | null = null;
    let fallbackTitle: string | null = null;
    let fallbackDescription: string | null = null;
    let fallbackImage: string | null = null;

    if (parsed.source_type === "youtube") {
      const meta = await fetchYouTubeVideoMeta(
        parsed.source_id,
      );

      if (!meta) {
        return NextResponse.json(
          { error: "Could not load this YouTube video." },
          { status: 400 },
        );
      }

      fallbackTitle = meta.title;
      fallbackDescription = meta.description;
      fallbackImage = meta.thumbnailUrl;

      const found = await findYouTubeWork(
        supabaseAdmin,
        meta.videoId,
      );

      if (found.error) {
        console.error("IMPORT FIND WORK ERROR:", found.error);
        return NextResponse.json(
          { error: "Failed to import clip." },
          { status: 500 },
        );
      }

      work = found.work;

      if (!work) {
        const created = await createImportedYouTubeWork(
          supabaseAdmin,
          meta,
        );

        if (created.error) {
          const retry = await findYouTubeWork(
            supabaseAdmin,
            meta.videoId,
          );

          if (retry.work) {
            work = retry.work;
          } else {
            console.error(
              "IMPORT CREATE WORK ERROR:",
              created.error,
            );
            return NextResponse.json(
              { error: "Failed to import clip." },
              { status: 500 },
            );
          }
        } else {
          work = created.work;
        }
      }
    } else {
      const resolved = await resolveImportedTikTokWork(
        supabaseAdmin,
        {
          videoId: parsed.source_id,
          canonicalUrl: parsed.source_url,
        },
      );

      if (resolved.unavailable) {
        return NextResponse.json(
          { error: "Could not load this TikTok video." },
          { status: 400 },
        );
      }

      if (resolved.error) {
        console.error(
          "IMPORT TIKTOK WORK ERROR:",
          resolved.error,
        );
        return NextResponse.json(
          { error: "Failed to import clip." },
          { status: 500 },
        );
      }

      work = resolved.work;
      fallbackTitle = work?.title ?? null;
      fallbackDescription = work?.description ?? null;
      fallbackImage = work?.thumbnail_url ?? null;
    }

    if (!work) {
      return NextResponse.json(
        { error: "Failed to import clip." },
        { status: 500 },
      );
    }

    const { data: existingPick } = await supabaseAdmin
      .from("work_picks")
      .select("work_id")
      .eq("user_id", user.id)
      .eq("work_id", work.id)
      .maybeSingle();

    if (existingPick) {
      return NextResponse.json(
        { error: "This clip is already in My Picks." },
        { status: 409 },
      );
    }

    const submissionResult = await ensurePendingClipSubmission(
      supabaseAdmin,
      {
        userId: user.id,
        work,
        meta: {
          sourceType: parsed.source_type,
          sourceId: parsed.source_id,
          sourceUrl: parsed.source_url,
          title: work.title ?? fallbackTitle,
          description: work.description ?? fallbackDescription,
          thumbnailUrl: work.thumbnail_url ?? fallbackImage,
          durationSeconds: work.duration_seconds,
        },
      },
    );

    if (submissionResult.error) {
      console.error(
        "IMPORT SUBMISSION ERROR:",
        submissionResult.error,
      );
      return NextResponse.json(
        { error: "Failed to import clip." },
        { status: 500 },
      );
    }

    const { error: pickError } = await insertWorkPick(
      supabaseAdmin,
      {
        userId: user.id,
        workId: String(work.id),
        artistId: work.artist_id,
      },
    );

    if (pickError) {
      console.error("IMPORT PICK ERROR:", pickError);
      return NextResponse.json(
        { error: "Failed to import clip." },
        { status: 500 },
      );
    }

    const isTikTok = work.source === "tiktok";

    return NextResponse.json(
      {
        work: {
          id: String(work.id),
          artistId: work.artist_id ?? "",
          artistName: "",
          source: work.source,
          type: isTikTok ? "tiktok" : "youtube",
          videoId: work.source_id ?? parsed.source_id,
          image: work.thumbnail_url ?? fallbackImage,
          sourceUrl: work.source_url,
          title: work.title ?? fallbackTitle,
          description: work.description ?? fallbackDescription,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("IMPORT CLIP UNEXPECTED ERROR:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
