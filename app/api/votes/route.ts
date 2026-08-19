import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWeekStart } from "@/lib/votes/getWeekStart";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error(
        "GET VOTE USER ERROR:",
        userError,
      );
    }

    if (!user) {
      return NextResponse.json({
        loggedIn: false,
        vote: null,
      });
    }

    const category =
      request.nextUrl.searchParams.get(
        "category",
      );

    if (!category) {
      return NextResponse.json(
        {
          error:
            "Category is required.",
        },
        {
          status: 400,
        },
      );
    }

    const weekStart = getWeekStart();

    const {
      data: vote,
      error: voteError,
    } = await supabase
      .from("artist_votes")
      .select(
        `
          id,
          artist_id,
          category,
          week_start
        `,
      )
      .eq("user_id", user.id)
      .eq(
        "category",
        category.toLowerCase(),
      )
      .eq("week_start", weekStart)
      .maybeSingle();

    if (voteError) {
      console.error(
        "GET VOTE ERROR:",
        voteError,
      );

      return NextResponse.json(
        {
          error:
            "Failed to load vote.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      loggedIn: true,
      vote,
    });
  } catch (error) {
    console.error(
      "GET VOTE UNEXPECTED ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unexpected server error.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error(
        "POST VOTE USER ERROR:",
        userError,
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Login required.",
        },
        {
          status: 401,
        },
      );
    }

    const body = await request.json();

    const artistId =
      typeof body.artistId === "string"
        ? body.artistId.trim()
        : "";

    const category =
      typeof body.category === "string"
        ? body.category
            .trim()
            .toLowerCase()
        : "";

    if (!artistId || !category) {
      return NextResponse.json(
        {
          error:
            "Artist and category are required.",
        },
        {
          status: 400,
        },
      );
    }

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
        {
          status: 400,
        },
      );
    }

    /*
      클라이언트가 보낸 category를
      그대로 믿지 않고 Artist DB에서 확인.
    */
    const {
      data: artist,
      error: artistError,
    } = await supabase
      .from("creators")
      .select(
        `
          id,
          category
        `,
      )
      .eq("id", artistId)
      .maybeSingle();

    if (artistError) {
      console.error(
        "LOAD VOTE ARTIST ERROR:",
        artistError,
      );

      return NextResponse.json(
        {
          error:
            "Failed to load artist.",
        },
        {
          status: 500,
        },
      );
    }

    if (!artist) {
      return NextResponse.json(
        {
          error:
            "Artist not found.",
        },
        {
          status: 404,
        },
      );
    }

    const artistCategory =
      String(
        artist.category ?? "",
      ).toLowerCase();

    if (
      artistCategory !== category
    ) {
      return NextResponse.json(
        {
          error:
            "Artist category does not match.",
        },
        {
          status: 400,
        },
      );
    }

    const weekStart = getWeekStart();

    /*
      user_id + category + week_start가
      unique라는 현재 Vote 정책을 이용.

      같은 카테고리에 이미 투표했으면
      해당 row의 artist_id가 변경된다.
    */
    const {
      data: vote,
      error: voteError,
    } = await supabase
      .from("artist_votes")
      .upsert(
        {
          user_id: user.id,
          artist_id: artistId,
          category,
          week_start: weekStart,
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            "user_id,category,week_start",
        },
      )
      .select(
        `
          id,
          artist_id,
          category,
          week_start
        `,
      )
      .single();

    if (voteError) {
      console.error(
        "SAVE VOTE ERROR:",
        voteError,
      );

      return NextResponse.json(
        {
          error:
            "Failed to save vote.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      vote,
    });
  } catch (error) {
    console.error(
      "POST VOTE UNEXPECTED ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unexpected server error.",
      },
      {
        status: 500,
      },
    );
  }
}