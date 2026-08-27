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
    
    const tagline =
      typeof body.tagline === "string"
        ? body.tagline.trim()
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
    
    const coverPositionX =
    typeof body.coverPositionX === "number"
    ? Math.round(
        Math.min(
        Math.max(0, body.coverPositionX),
    ),
      )
    : 50;

    const coverPositionY =
    typeof body.coverPositionY === "number"
    ? Math.round(
        Math.min(
        Math.max(0, body.coverPositionY),
      ),
    ) 
    : 50;

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

    const allowedCategories =
      ALLOWED_CREATOR_CATEGORIES;

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
          tagline: tagline || null,
          bio: bio || null,
          profile_image:
            profileImage || null,
          cover_image:
            coverImage || null,
          cover_position_x: coverPositionX,
          cover_position_y: coverPositionY,
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
          tagline,
          bio,
          profile_image,
          cover_image,
          cover_position_x,
          cover_position_y,
          tags,
          youtube_url,
          instagram_url,
          is_curated
        `)
        .single();

    if (error) {
      if (
        error.code === "23505" ||
        (error.message ?? "").includes(
          "creators_username_key",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "An artist with this username already exists.",
            code: "username_taken",
          },
          { status: 409 },
        );
      }

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
          error: "Artist ID is required.",
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

    /*
      1. Artist의 Works 확인
    */
    const {
      data: works,
      error: worksLoadError,
    } = await supabaseAdmin
      .from("works")
      .select(`
        id,
        source,
        source_id
      `)
      .eq("artist_id", id);

    if (worksLoadError) {
      return NextResponse.json(
        {
          error:
            worksLoadError.message,
        },
        { status: 400 },
      );
    }

    /*
      2. 직접 업로드 이미지라면
         Storage에서도 제거
    */
    const storagePaths =
      (works ?? [])
        .filter(
          (work) =>
            work.source === "upload" &&
            work.source_id,
        )
        .map(
          (work) =>
            work.source_id as string,
        );

    if (storagePaths.length > 0) {
      const {
        error: storageError,
      } =
        await supabaseAdmin.storage
          .from("works")
          .remove(storagePaths);

      if (storageError) {
        console.error(
          "DELETE ARTIST STORAGE ERROR:",
          storageError,
        );
      }
    }

    /*
      3. Works 삭제
    */
    const {
      error: worksDeleteError,
    } = await supabaseAdmin
      .from("works")
      .delete()
      .eq("artist_id", id);

    if (worksDeleteError) {
      return NextResponse.json(
        {
          error:
            worksDeleteError.message,
        },
        { status: 400 },
      );
    }

    /*
      4. Artist 삭제
    */
    const {
      error: artistDeleteError,
    } = await supabaseAdmin
      .from("creators")
      .delete()
      .eq("id", id);

    if (artistDeleteError) {
      return NextResponse.json(
        {
          error:
            artistDeleteError.message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "DELETE ARTIST SERVER ERROR:",
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