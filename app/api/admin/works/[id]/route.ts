import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@supabase/supabase-js";

import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/requireAdmin";
import { classifyWorksSubjectsSafe } from "@/lib/subjects/classifyWorks.server";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
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

    const { id } = await params;

    const body =
      await request.json();

    const title =
      typeof body.title === "string"
        ? body.title.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    const sourceUrl =
      typeof body.sourceUrl === "string"
        ? body.sourceUrl.trim()
        : "";

    const publishedAt =
      typeof body.publishedAt === "string"
        ? body.publishedAt.trim()
        : "";

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
    } =
      await supabaseAdmin
        .from("works")
        .update({
          title:
            title || null,

          description:
            description || null,

          source_url:
            sourceUrl,

          published_at:
            publishedAt
              ? new Date(
                  `${publishedAt}T00:00:00.000Z`,
                ).toISOString()
              : null,
        })
        .eq("id", id)
        .select(`
          id,
          source,
          source_id,
          source_url,
          title,
          description,
          thumbnail_url,
          published_at,
          featured
        `)
        .single();

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        { status: 400 },
      );
    }

    await classifyWorksSubjectsSafe(
      supabaseAdmin,
      [id],
    );

    return NextResponse.json({
      success: true,
      work: data,
    });
  } catch (error) {
    console.error(
      "UPDATE WORK ERROR:",
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
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
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

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Work ID is required.",
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

    const { error } =
      await supabaseAdmin
        .from("works")
        .delete()
        .eq("id", id);

    if (error) {
      console.error(
        "DELETE WORK ERROR:",
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
    });
  } catch (error) {
    console.error(
      "DELETE WORK SERVER ERROR:",
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