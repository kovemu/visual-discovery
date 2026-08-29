import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

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

function buildWorkThumbnailKey(
  source: string,
  sourceId: string,
) {
  return `${source}:${sourceId}`;
}

async function loadWorkThumbnailMap(
  supabaseAdmin: SupabaseClient,
  rows: Array<{
    source_type: string;
    source_id: string | null;
  }>,
) {
  const sourceIdsByType = new Map<
    string,
    Set<string>
  >();

  for (const row of rows) {
    if (
      typeof row.source_type !== "string" ||
      typeof row.source_id !== "string" ||
      !row.source_id.trim()
    ) {
      continue;
    }

    const ids =
      sourceIdsByType.get(row.source_type) ??
      new Set<string>();
    ids.add(row.source_id.trim());
    sourceIdsByType.set(row.source_type, ids);
  }

  const workThumbnailByKey = new Map<
    string,
    string | null
  >();

  await Promise.all(
    [...sourceIdsByType.entries()].map(
      async ([source, sourceIds]) => {
        if (sourceIds.size === 0) {
          return;
        }

        const { data, error } = await supabaseAdmin
          .from("works")
          .select("source, source_id, thumbnail_url")
          .eq("source", source)
          .in("source_id", [...sourceIds]);

        if (error) {
          console.error(
            "ADMIN SUBMISSIONS WORK THUMBNAIL ERROR:",
            { source, error },
          );
          return;
        }

        for (const work of data ?? []) {
          if (
            typeof work.source !== "string" ||
            typeof work.source_id !== "string"
          ) {
            continue;
          }

          workThumbnailByKey.set(
            buildWorkThumbnailKey(
              work.source,
              work.source_id,
            ),
            work.thumbnail_url,
          );
        }
      },
    ),
  );

  return workThumbnailByKey;
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
    const workThumbnailByKey =
      await loadWorkThumbnailMap(
        supabaseAdmin,
        rows,
      );

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
        const workThumbnail =
          row.source_type &&
          row.source_id
            ? workThumbnailByKey.get(
                buildWorkThumbnailKey(
                  row.source_type,
                  row.source_id,
                ),
              ) ?? null
            : null;

        const thumbnail =
          row.thumbnail_url ||
          workThumbnail ||
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
