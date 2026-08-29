import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

import { isAnonymousUser } from "@/lib/auth/userKind";
import { parseSubmissionUrl } from "@/lib/submissions/parseSubmissionUrl";
import { resolveSubmissionUrlError } from "@/lib/submissions/submissionUrlErrors";
import { createClient } from "@/lib/supabase/server";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(
  request: NextRequest,
) {
  try {
    const authSupabase =
      await createClient();
    const {
      data: { user },
    } =
      await authSupabase.auth.getUser();

    if (!user || isAnonymousUser(user)) {
      return NextResponse.json(
        { error: "Login required." },
        { status: 401 },
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
      source_url?: unknown;
      confirmed_18_plus?: unknown;
    };

    if (
      payload.confirmed_18_plus !== true
    ) {
      return NextResponse.json(
        {
          error:
            "18+ confirmation is required.",
        },
        { status: 400 },
      );
    }

    if (
      typeof payload.source_url !==
        "string" ||
      !payload.source_url.trim()
    ) {
      return NextResponse.json(
        { error: "Invalid URL." },
        { status: 400 },
      );
    }

    const parsed = parseSubmissionUrl(
      payload.source_url,
    );

    if (!parsed) {
      return NextResponse.json(
        {
          error:
            resolveSubmissionUrlError(
              payload.source_url,
            ) ?? "Invalid URL.",
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

    const { data: duplicate } =
      await supabaseAdmin
        .from("clip_submissions")
        .select("id")
        .eq("source_type", parsed.source_type)
        .eq("source_id", parsed.source_id)
        .in("status", [
          "pending",
          "approved",
        ])
        .maybeSingle();

    if (duplicate) {
      return NextResponse.json(
        {
          error:
            "This clip was already submitted.",
        },
        { status: 409 },
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from("clip_submissions")
        .insert({
          user_id: user.id,
          source_url:
            parsed.source_url,
          source_type:
            parsed.source_type,
          source_id: parsed.source_id,
          confirmed_18_plus: true,
          status: "pending",
        })
        .select("id")
        .single();

    if (error) {
      console.error(
        "CLIP SUBMISSION INSERT ERROR:",
        error,
      );

      return NextResponse.json(
        {
          error:
            "Failed to submit clip.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { id: data.id },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "CLIP SUBMISSION UNEXPECTED ERROR:",
      error,
    );

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
