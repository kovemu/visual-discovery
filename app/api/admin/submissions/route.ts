import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

import {
  adminAuthErrorResponse,
  requireAdmin,
} from "@/lib/auth/requireAdmin";
import { parseYouTubeVideoId } from "@/lib/submissions/parseSubmissionUrl";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

function youtubeThumbnailUrl(
  sourceId: string | null | undefined,
  sourceUrl: string,
) {
  if (sourceId) {
    return `https://i.ytimg.com/vi/${sourceId}/hqdefault.jpg`;
  }

  const videoId = parseYouTubeVideoId(sourceUrl);

  return videoId
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : null;
}

export async function GET() {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return adminAuthErrorResponse(auth);
  }

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Server configuration is missing.",
        },
        { status: 500 },
      );
    }

    const supabaseAdmin =
      createServiceClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      );

    const { data, error } =
      await supabaseAdmin
        .from("clip_submissions")
        .select(
          "id, user_id, source_url, source_type, source_id, title, thumbnail_url, status, created_at",
        )
        .eq("status", "pending")
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      console.error(
        "ADMIN SUBMISSIONS LIST ERROR:",
        error,
      );

      return NextResponse.json(
        {
          error:
            "Failed to load submissions.",
        },
        { status: 500 },
      );
    }

    const rows = data ?? [];
    const submitterIds = [
      ...new Set(
        rows
          .map((row) => row.user_id)
          .filter(
            (value): value is string =>
              typeof value === "string" &&
              value.length > 0,
          ),
      ),
    ];

    const submitterEmails = new Map<
      string,
      string
    >();

    await Promise.all(
      submitterIds.map(async (userId) => {
        const { data: userData } =
          await supabaseAdmin.auth.admin.getUserById(
            userId,
          );

        submitterEmails.set(
          userId,
          userData.user?.email ?? userId,
        );
      }),
    );

    return NextResponse.json({
      submissions: rows.map((row) => {
        const thumbnail =
          row.thumbnail_url ||
          (row.source_type === "youtube"
            ? youtubeThumbnailUrl(
                row.source_id,
                row.source_url,
              )
            : null);

        return {
          ...row,
          thumbnail_url: thumbnail,
          submitter:
            row.user_id
              ? submitterEmails.get(
                  row.user_id,
                ) ?? row.user_id
              : null,
        };
      }),
    });
  } catch (error) {
    console.error(
      "ADMIN SUBMISSIONS UNEXPECTED ERROR:",
      error,
    );

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
