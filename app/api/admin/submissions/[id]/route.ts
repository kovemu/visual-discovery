import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

import { isCreatorCategory } from "@/lib/creator/creatorCategories";
import {
  adminAuthErrorResponse,
  requireAdmin,
} from "@/lib/auth/requireAdmin";
import {
  createImportedYouTubeWork,
  findYouTubeWork,
} from "@/lib/picks/importYouTubeWork";
import { parseSubmissionUrl } from "@/lib/submissions/parseSubmissionUrl";
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
      if (workId) {
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
      } else {
        const parsed = parseSubmissionUrl(
          pending.source_url,
        );

        if (parsed?.source_type === "youtube") {
          const meta =
            (await fetchYouTubeVideoMeta(
              parsed.source_id,
            )) ?? {
              videoId: parsed.source_id,
              title: pending.title,
              description: pending.description,
              thumbnailUrl: pending.thumbnail_url,
              durationSeconds:
                pending.duration_seconds,
              publishedAt: null,
              canonicalUrl: parsed.source_url,
            };

          const found = await findYouTubeWork(
            supabaseAdmin,
            parsed.source_id,
          );

          if (found.error) {
            console.error(
              "ADMIN SUBMISSION FIND WORK ERROR:",
              found.error,
            );

            return NextResponse.json(
              {
                error:
                  "Failed to approve submission.",
              },
              { status: 500 },
            );
          }

          if (found.work) {
            workId = found.work.id;
          } else {
            const created =
              await createImportedYouTubeWork(
                supabaseAdmin,
                meta,
              );

            if (!created.work) {
              console.error(
                "ADMIN SUBMISSION CREATE WORK ERROR:",
                created.error,
              );

              return NextResponse.json(
                {
                  error:
                    "Failed to approve submission.",
                },
                { status: 500 },
              );
            }

            workId = created.work.id;
          }

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
      }
    }

    if (action === "reject" && workId) {
      const { error: eligibleError } =
        await supabaseAdmin
          .from("works")
          .update({
            discover_eligible: false,
          })
          .eq("id", workId);

      if (eligibleError) {
        console.error(
          "ADMIN SUBMISSION REJECT WORK ERROR:",
          eligibleError,
        );

        return NextResponse.json(
          {
            error:
              "Failed to reject submission.",
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
