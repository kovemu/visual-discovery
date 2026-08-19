import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(
  request: NextRequest,
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

    const youtubeUrl =
      typeof body.youtubeUrl === "string"
        ? body.youtubeUrl.trim()
        : "";

    /*
      Required fields
    */
    if (!name) {
      return NextResponse.json(
        {
          error:
            "Artist name is required.",
        },
        { status: 400 },
      );
    }

    /*
      Category validation
    */
    const allowedCategories = [
      "music",
      "dance",
      "art",
      "cosplay",
    ];

    if (
      !allowedCategories.includes(
        category,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid category.",
        },
        { status: 400 },
      );
    }

    /*
      Supabase Admin
    */
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

    /*
      Create Artist
    */
    const { data, error } =
      await supabaseAdmin
        .from("creators")
        .insert({
          name,

          username:
            username || null,

          category,

          bio:
            bio || null,

          profile_image:
            profileImage || null,

          youtube_url:
            youtubeUrl || null,

          is_curated: true,
        })
        .select(`
          id,
          name,
          username,
          category,
          bio,
          profile_image,
          youtube_url,
          is_curated
        `)
        .single();

    if (error) {
      console.error(
        "CREATE ARTIST API ERROR:",
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
      artist: data,
    });
  } catch (error) {
    console.error(
      "CREATE ARTIST SERVER ERROR:",
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