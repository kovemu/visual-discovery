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

function resolveDiscoverCategory(
  work:
    | {
        discover_category: string | null;
      }
    | {
        discover_category: string | null;
      }[]
    | null
    | undefined,
) {
  if (!work) {
    return null;
  }

  const row = Array.isArray(work)
    ? work[0]
    : work;

  return row?.discover_category ?? null;
}

const ALLOWED_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;

type SubmissionStatus =
  (typeof ALLOWED_STATUSES)[number];

function parseStatusParam(
  value: string | null,
): SubmissionStatus {
  if (
    value &&
    ALLOWED_STATUSES.includes(
      value as SubmissionStatus,
    )
  ) {
    return value as SubmissionStatus;
  }

  return "pending";
}

export async function GET(
  request: Request,
) {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return adminAuthErrorResponse(auth);
  }

  const { searchParams } = new URL(request.url);
  const status = parseStatusParam(
    searchParams.get("status"),
  );

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
          "id, user_id, source_url, source_type, source_id, title, thumbnail_url, status, created_at, work_id, work:works(discover_category)",
        )
        .eq("status", status)
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
          id: row.id,
          user_id: row.user_id,
          source_url: row.source_url,
          source_type: row.source_type,
          source_id: row.source_id,
          title: row.title,
          thumbnail_url: thumbnail,
          status: row.status,
          created_at: row.created_at,
          work_id: row.work_id,
          discover_category:
            resolveDiscoverCategory(row.work),
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
