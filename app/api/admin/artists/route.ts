import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@supabase/supabase-js";

import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/requireAdmin";
import { ALLOWED_CREATOR_CATEGORIES } from "@/lib/creator/creatorCategories";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const ARTIST_SELECT = `
  id,
  name,
  username,
  category,
  bio,
  tagline,
  profile_image,
  cover_image,
  youtube_url,
  instagram_url,
  tags,
  is_curated
`;

function isUsernameConflict(
  error: {
    code?: string;
    message?: string;
  },
) {
  return (
    error.code === "23505" ||
    (error.message ?? "").includes(
      "creators_username_key",
    )
  );
}

export async function GET(
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

    const username =
      request.nextUrl.searchParams
        .get("username")
        ?.trim() ?? "";

    if (!username) {
      return NextResponse.json(
        {
          error:
            "Username is required.",
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
        .select(ARTIST_SELECT)
        .ilike("username", username)
        .maybeSingle();

    if (error) {
      console.error(
        "LOOKUP ARTIST API ERROR:",
        error,
      );

      return NextResponse.json(
        {
          error:
            "Failed to look up artist.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      artist: data ?? null,
    });
  } catch (error) {
    console.error(
      "LOOKUP ARTIST SERVER ERROR:",
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

export async function POST(
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

    const tagline =
      typeof body.tagline === "string"
        ? body.tagline.trim()
        : "";

    const coverImage =
      typeof body.coverImage === "string"
        ? body.coverImage.trim()
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
    const allowedCategories =
      ALLOWED_CREATOR_CATEGORIES;

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

          tagline:
            tagline || null,

          profile_image:
            profileImage || null,

          cover_image:
            coverImage || null,

          youtube_url:
            youtubeUrl || null,

          instagram_url:
            instagramUrl || null,

          tags,

          is_curated: true,
        })
        .select(ARTIST_SELECT)
        .single();

    if (error) {
      if (isUsernameConflict(error)) {
        const existing =
          username
            ? await supabaseAdmin
                .from("creators")
                .select(ARTIST_SELECT)
                .ilike(
                  "username",
                  username,
                )
                .maybeSingle()
            : {
                data: null,
              };

        return NextResponse.json(
          {
            error:
              "An artist with this username already exists.",
            code: "username_taken",
            artist:
              existing.data ?? null,
          },
          { status: 409 },
        );
      }

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