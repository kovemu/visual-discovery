import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { isCreatorCategory } from "@/lib/creator/creatorCategories";
import {
  adminAuthErrorResponse,
  requireAdmin,
} from "@/lib/auth/requireAdmin";
import {
  createImportedYouTubeWork,
  findYouTubeWork,
  type ImportedWorkRow,
} from "@/lib/picks/importYouTubeWork";
import {
  createImportedTikTokWork,
  findTikTokWork,
} from "@/lib/picks/importTikTokWork";
import { parseSubmissionUrl } from "@/lib/submissions/parseSubmissionUrl";
import {
  asOptionalOEmbedString,
  fetchTikTokOEmbed,
} from "@/lib/tiktok/fetchTikTokOEmbed";
import { resolveTikTokThumbnailUrl } from "@/lib/tiktok/resolveTikTokThumbnailUrl";
import { isUuid } from "@/lib/validation/isUuid";
import { fetchYouTubeVideoMeta } from "@/lib/youtube/fetchYouTubeVideo";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SubmissionAction =
  | "approve"
  | "reject"
  | "remove";

function parseSubmissionAction(
  body: {
    action?: unknown;
    status?: unknown;
  },
): SubmissionAction | null {
  if (
    body.action === "approve" ||
    body.action === "reject" ||
    body.action === "remove"
  ) {
    return body.action;
  }

  if (body.status === "approved") {
    return "approve";
  }

  if (body.status === "rejected") {
    return "reject";
  }

  return null;
}

function resolvePendingSubmissionSource(
  pending: {
    source_url: string;
    source_type: string;
    source_id: string | null;
  },
) {
  const parsed = parseSubmissionUrl(
    pending.source_url,
  );

  if (parsed) {
    return parsed;
  }

  if (
    (pending.source_type === "youtube" ||
      pending.source_type === "tiktok") &&
    typeof pending.source_id === "string" &&
    pending.source_id.trim() &&
    pending.source_url.trim()
  ) {
    return {
      source_type: pending.source_type,
      source_url: pending.source_url.trim(),
      source_id: pending.source_id.trim(),
    };
  }

  return null;
}

const WORK_SELECT = `
  id,
  source,
  source_id,
  source_url,
  title,
  description,
  thumbnail_url,
  duration_seconds,
  discover_eligible,
  artist_id
`;

async function resolveWorkForApproval(
  supabaseAdmin: SupabaseClient,
  pending: {
    source_url: string;
    source_type: string;
    source_id: string | null;
    title: string | null;
    description: string | null;
    thumbnail_url: string | null;
    duration_seconds: number | null;
    work_id: number | string | null;
  },
): Promise<
  | { ok: true; work: ImportedWorkRow }
  | { ok: false; status: 400 | 500 }
> {
  const parsed = resolvePendingSubmissionSource(
    pending,
  );

  if (!parsed) {
    return { ok: false, status: 400 };
  }

  let work: ImportedWorkRow | null = null;

  if (parsed.source_type === "youtube") {
    const found = await findYouTubeWork(
      supabaseAdmin,
      parsed.source_id,
    );

    if (found.error) {
      console.error(
        "ADMIN SUBMISSION FIND WORK ERROR:",
        found.error,
      );
      return { ok: false, status: 500 };
    }

    work = found.work;
  } else if (parsed.source_type === "tiktok") {
    const found = await findTikTokWork(
      supabaseAdmin,
      parsed.source_id,
    );

    if (found.error) {
      console.error(
        "ADMIN SUBMISSION FIND TIKTOK WORK ERROR:",
        found.error,
      );
      return { ok: false, status: 500 };
    }

    work = found.work;
  } else {
    return { ok: false, status: 400 };
  }

  if (!work && pending.work_id) {
    const { data, error } = await supabaseAdmin
      .from("works")
      .select(WORK_SELECT)
      .eq("id", pending.work_id)
      .maybeSingle();

    if (error) {
      console.error(
        "ADMIN SUBMISSION LOAD WORK ERROR:",
        error,
      );
      return { ok: false, status: 500 };
    }

    work = (data as ImportedWorkRow | null) ?? null;
  }

  if (!work && parsed.source_type === "youtube") {
    const meta =
      (await fetchYouTubeVideoMeta(
        parsed.source_id,
      )) ?? {
        videoId: parsed.source_id,
        title: pending.title,
        description: pending.description,
        thumbnailUrl: pending.thumbnail_url,
        durationSeconds: pending.duration_seconds,
        publishedAt: null,
        canonicalUrl: parsed.source_url,
      };

    const created = await createImportedYouTubeWork(
      supabaseAdmin,
      meta,
    );

    if (!created.work) {
      console.error(
        "ADMIN SUBMISSION CREATE WORK ERROR:",
        created.error,
      );
      return { ok: false, status: 500 };
    }

    work = created.work;
  } else if (!work && parsed.source_type === "tiktok") {
    const oembed = await fetchTikTokOEmbed(
      parsed.source_url,
    );

    if (!oembed.ok) {
      console.error(
        "ADMIN SUBMISSION TIKTOK OEMBED ERROR:",
        {
          sourceId: parsed.source_id,
          status: oembed.status,
        },
      );
      return { ok: false, status: 500 };
    }

    const title =
      asOptionalOEmbedString(oembed.data.title) ??
      pending.title ??
      `TikTok video ${parsed.source_id}`;
    const thumbnailUrl =
      await resolveTikTokThumbnailUrl({
        videoId: parsed.source_id,
        incomingThumbnail:
          asOptionalOEmbedString(
            oembed.data.thumbnail_url,
          ),
        existingThumbnail: null,
      });

    const created = await createImportedTikTokWork(
      supabaseAdmin,
      {
        videoId: parsed.source_id,
        canonicalUrl: parsed.source_url,
        title,
        description: pending.description ?? title,
        thumbnailUrl,
      },
    );

    if (!created.work) {
      console.error(
        "ADMIN SUBMISSION CREATE TIKTOK WORK ERROR:",
        created.error,
      );
      return { ok: false, status: 500 };
    }

    work = created.work;
  }

  if (
    work &&
    parsed.source_type === "tiktok" &&
    !work.thumbnail_url
  ) {
    const oembed = await fetchTikTokOEmbed(
      parsed.source_url,
    );

    if (oembed.ok) {
      const thumbnailUrl =
        await resolveTikTokThumbnailUrl({
          videoId: parsed.source_id,
          incomingThumbnail:
            asOptionalOEmbedString(
              oembed.data.thumbnail_url,
            ),
          existingThumbnail: null,
        });

      if (thumbnailUrl) {
        const { error: thumbnailError } =
          await supabaseAdmin
            .from("works")
            .update({
              thumbnail_url: thumbnailUrl,
            })
            .eq("id", work.id)
            .eq("source", "tiktok");

        if (thumbnailError) {
          console.error(
            "ADMIN SUBMISSION TIKTOK THUMBNAIL REPAIR ERROR:",
            thumbnailError,
          );
        } else {
          work = {
            ...work,
            thumbnail_url: thumbnailUrl,
          };
        }
      }
    }
  }

  if (!work) {
    return { ok: false, status: 500 };
  }

  return { ok: true, work };
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return adminAuthErrorResponse(auth);
  }

  try {
    const { id } = await context.params;

    if (!isUuid(id)) {
      return NextResponse.json(
        { error: "Invalid submission id." },
        { status: 400 },
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Server configuration is missing.",
        },
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

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        { error: "Invalid payload." },
        { status: 400 },
      );
    }

    const payload = body as {
      action?: unknown;
      status?: unknown;
      discover_category?: unknown;
    };

    const action = parseSubmissionAction(payload);

    if (!action) {
      return NextResponse.json(
        { error: "Invalid action." },
        { status: 400 },
      );
    }

    const discoverCategory =
      typeof payload.discover_category ===
        "string"
        ? payload.discover_category
            .trim()
            .toLowerCase()
        : "";

    if (
      action === "approve" &&
      !isCreatorCategory(discoverCategory)
    ) {
      return NextResponse.json(
        {
          error:
            "Select a category before approving.",
        },
        { status: 400 },
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

    if (action === "remove") {
      const { data: approved, error: loadError } =
        await supabaseAdmin
          .from("clip_submissions")
          .select("id, work_id")
          .eq("id", id)
          .eq("status", "approved")
          .maybeSingle();

      if (loadError) {
        console.error(
          "ADMIN SUBMISSION REMOVE LOAD ERROR:",
          loadError,
        );

        return NextResponse.json(
          {
            error:
              "Failed to remove submission from Discover.",
          },
          { status: 500 },
        );
      }

      if (!approved) {
        return NextResponse.json(
          {
            error:
              "Approved submission not found.",
          },
          { status: 404 },
        );
      }

      if (approved.work_id) {
        const { error: eligibleError } =
          await supabaseAdmin
            .from("works")
            .update({
              discover_eligible: false,
            })
            .eq("id", approved.work_id);

        if (eligibleError) {
          console.error(
            "ADMIN SUBMISSION REMOVE WORK ERROR:",
            eligibleError,
          );

          return NextResponse.json(
            {
              error:
                "Failed to remove submission from Discover.",
            },
            { status: 500 },
          );
        }
      }

      const { data, error } =
        await supabaseAdmin
          .from("clip_submissions")
          .update({
            status: "rejected",
            reviewed_at:
              new Date().toISOString(),
            reviewed_by: auth.user.id,
          })
          .eq("id", id)
          .eq("status", "approved")
          .select("id, status")
          .maybeSingle();

      if (error) {
        console.error(
          "ADMIN SUBMISSION REMOVE PATCH ERROR:",
          error,
        );

        return NextResponse.json(
          {
            error:
              "Failed to remove submission from Discover.",
          },
          { status: 500 },
        );
      }

      if (!data) {
        return NextResponse.json(
          {
            error:
              "Approved submission not found.",
          },
          { status: 404 },
        );
      }

      return NextResponse.json({
        submission: data,
      });
    }

    const { data: pending, error: loadError } =
      await supabaseAdmin
        .from("clip_submissions")
        .select(
          "id, source_url, source_type, source_id, title, description, thumbnail_url, duration_seconds, work_id",
        )
        .eq("id", id)
        .eq("status", "pending")
        .maybeSingle();

    if (loadError) {
      console.error(
        "ADMIN SUBMISSION LOAD ERROR:",
        loadError,
      );

      return NextResponse.json(
        {
          error:
            "Failed to update submission.",
        },
        { status: 500 },
      );
    }

    if (!pending) {
      return NextResponse.json(
        {
          error:
            "Submission not found or already reviewed.",
        },
        { status: 404 },
      );
    }

    let workId = pending.work_id as
      | number
      | string
      | null;

    if (action === "approve") {
      const resolved = await resolveWorkForApproval(
        supabaseAdmin,
        pending,
      );

      if (!resolved.ok) {
        return NextResponse.json(
          {
            error:
              "Failed to approve submission.",
          },
          { status: resolved.status },
        );
      }

      workId = resolved.work.id;

      const { error: eligibleError } =
        await supabaseAdmin
          .from("works")
          .update({
            discover_eligible: true,
            discover_category: discoverCategory,
          })
          .eq("id", workId);

      if (eligibleError) {
        console.error(
          "ADMIN SUBMISSION APPROVE WORK ERROR:",
          eligibleError,
        );

        return NextResponse.json(
          {
            error:
              "Failed to approve submission.",
          },
          { status: 500 },
        );
      }
    }

    const nextStatus =
      action === "approve"
        ? "approved"
        : "rejected";

    const { data, error } =
      await supabaseAdmin
        .from("clip_submissions")
        .update({
          status: nextStatus,
          reviewed_at:
            new Date().toISOString(),
          reviewed_by: auth.user.id,
          work_id: workId,
        })
        .eq("id", id)
        .eq("status", "pending")
        .select("id, status")
        .maybeSingle();

    if (error) {
      console.error(
        "ADMIN SUBMISSION PATCH ERROR:",
        error,
      );

      return NextResponse.json(
        {
          error:
            "Failed to update submission.",
        },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Submission not found or already reviewed.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      submission: data,
    });
  } catch (error) {
    console.error(
      "ADMIN SUBMISSION PATCH UNEXPECTED ERROR:",
      error,
    );

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
