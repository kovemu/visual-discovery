import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@supabase/supabase-js";

import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/requireAdmin";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function PATCH(
  request: NextRequest,
) {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return adminAuthErrorResponse(auth);
  }

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Supabase server configuration is missing.",
        },
        { status: 500 },
      );
    }

    const body = await request.json();

    const workId = body.workId as
      | number
      | undefined;

    const featured = body.featured as
      | boolean
      | undefined;

    if (!workId) {
      return NextResponse.json(
        {
          error: "Work ID is required.",
        },
        { status: 400 },
      );
    }

    if (typeof featured !== "boolean") {
      return NextResponse.json(
        {
          error:
            "Featured value is required.",
        },
        { status: 400 },
      );
    }

    const supabaseAdmin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      );

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("works")
      .update({
        featured,
      })
      .eq("id", workId)
      .select("id, featured")
      .single();

    if (error) {
      console.error(
        "UPDATE FEATURED WORK ERROR:",
        error,
      );

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      work: data,
    });
  } catch (error) {
    console.error(
      "UPDATE FEATURED WORK SERVER ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unexpected server error.",
      },
      { status: 500 },
    );
  }
}