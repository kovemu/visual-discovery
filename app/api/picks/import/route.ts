import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

import { isAnonymousUser } from "@/lib/auth/userKind";
import {
  createImportedYouTubeWork,
  ensurePendingClipSubmission,
  findYouTubeWork,
} from "@/lib/picks/importYouTubeWork";
import { insertWorkPick } from "@/lib/picks/insertWorkPick";
import { parseSubmissionUrl } from "@/lib/submissions/parseSubmissionUrl";
import { createClient } from "@/lib/supabase/server";
import { fetchYouTubeVideoMeta } from "@/lib/youtube/fetchYouTubeVideo";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
        { error: "Enter a valid YouTube URL." },
        { status: 400 },
      );
    }

    const parsed = parseSubmissionUrl(payload.source_url);

    if (!parsed || parsed.source_type !== "youtube") {
      return NextResponse.json(
        { error: "Enter a valid YouTube URL." },
        { status: 400 },
      );
    }

    const meta = await fetchYouTubeVideoMeta(parsed.source_id);

    if (!meta) {
      return NextResponse.json(
        { error: "Could not load this YouTube video." },
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

    let { work, error: findError } = await findYouTubeWork(
      supabaseAdmin,
      meta.videoId,
    );

    if (findError) {
      console.error("IMPORT FIND WORK ERROR:", findError);
      return NextResponse.json(
        { error: "Failed to import clip." },
        { status: 500 },
      );
    }

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
        meta,
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

    return NextResponse.json(
      {
        work: {
          id: String(work.id),
          artistId: work.artist_id ?? "",
          artistName: "",
          source: work.source,
          type: "youtube",
          videoId: work.source_id ?? meta.videoId,
          image: work.thumbnail_url ?? meta.thumbnailUrl,
          sourceUrl: work.source_url,
          title: work.title ?? meta.title,
          description: work.description ?? meta.description,
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
