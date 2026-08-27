import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

import {
  adminAuthErrorResponse,
  requireAdmin,
} from "@/lib/auth/requireAdmin";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

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
          "id, user_id, source_url, source_type, status, created_at",
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

    return NextResponse.json({
      submissions: data ?? [],
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
