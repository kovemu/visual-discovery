import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@supabase/supabase-js";

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
          error: "Artist ID is required.",
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const username =
      typeof body.username === "string"
        ? body.username.trim()
        : "";

    const category =
      typeof body.category === "string"
        ? body.category.trim()
        : "";

    const bio =
      typeof body.bio === "string"
        ? body.bio.trim()
        : "";

    const profileImage =
      typeof body.profileImage === "string"
        ? body.profileImage.trim()
        : "";

    const coverImage =
      typeof body.coverImage === "string"
        ? body.coverImage.trim()
        : "";

    const youtubeUrl =
      typeof body.youtubeUrl === "string"
        ? body.youtubeUrl.trim()
        : "";

    const instagramUrl =
      typeof body.instagramUrl === "string"
        ? body.instagramUrl.trim()
        : "";

    const tags = Array.isArray(body.tags)
      ? body.tags
          .filter(
            (tag: unknown): tag is string =>
              typeof tag === "string",
          )
          .map((tag: string) => tag.trim())
          .filter(Boolean)
      : [];

    const isCurated =
      typeof body.isCurated === "boolean"
        ? body.isCurated
        : true;

    if (!name) {
      return NextResponse.json(
        {
          error: "Artist name is required.",
        },
        { status: 400 },
      );
    }

    const allowedCategories = [
      "music",
      "dance",
      "art",
      "cosplay",
    ];

    if (
      !allowedCategories.includes(category)
    ) {
      return NextResponse.json(
        {
          error: "Invalid category.",
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

    const { data, error } =
      await supabaseAdmin
        .from("creators")
        .update({
          name,
          username: username || null,
          category,
          bio: bio || null,
          profile_image:
            profileImage || null,
          cover_image:
            coverImage || null,
          tags,
          youtube_url:
            youtubeUrl || null,
          instagram_url:
            instagramUrl || null,
          is_curated: isCurated,
        })
        .eq("id", id)
        .select(`
          id,
          name,
          username,
          category,
          bio,
          profile_image,
          cover_image,
          tags,
          youtube_url,
          instagram_url,
          is_curated
        `)
        .single();

    if (error) {
      console.error(
        "UPDATE ARTIST ERROR:",
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
      artist: data,
    });
  } catch (error) {
    console.error(
      "UPDATE ARTIST SERVER ERROR:",
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