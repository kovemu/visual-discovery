import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

import {
  adminAuthErrorResponse,
  requireAdmin,
} from "@/lib/auth/requireAdmin";
import { isUuid } from "@/lib/validation/isUuid";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
      status?: unknown;
    };

    if (
      payload.status !== "approved" &&
      payload.status !== "rejected"
    ) {
      return NextResponse.json(
        { error: "Invalid status." },
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

    const { data, error } =
      await supabaseAdmin
        .from("clip_submissions")
        .update({
          status: payload.status,
          reviewed_at:
            new Date().toISOString(),
          reviewed_by: auth.user.id,
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
