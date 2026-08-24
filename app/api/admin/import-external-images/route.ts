import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/requireAdmin";

const supabaseUrl =
  process.env
    .NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env
    .SUPABASE_SERVICE_ROLE_KEY;

type ExternalImageWork = {
  imageUrl: string;
  sourceUrl?: string;
  caption?: string;
  publishedAt?: string;
};

function isValidHttpUrl(
  value: string,
) {
  try {
    const url =
      new URL(value);

    return (
      url.protocol ===
        "http:" ||
      url.protocol ===
        "https:"
    );
  } catch {
    return false;
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
    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return NextResponse.json(
        {
          error:
            "Supabase server configuration is missing.",
        },
        {
          status: 500,
        },
      );
    }

    const body =
      await request.json();

    const artistId =
      typeof body.artistId ===
      "string"
        ? body.artistId.trim()
        : "";

    const works =
      Array.isArray(
        body.works,
      )
        ? (body.works as ExternalImageWork[])
        : [];

    if (!artistId) {
      return NextResponse.json(
        {
          error:
            "Artist ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      works.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "External Image가 없습니다.",
        },
        {
          status: 400,
        },
      );
    }

    const cleanedWorks =
      works.map(
        (work) => ({
          imageUrl:
            typeof work.imageUrl ===
            "string"
              ? work.imageUrl.trim()
              : "",

          sourceUrl:
            typeof work.sourceUrl ===
            "string"
              ? work.sourceUrl.trim()
              : "",

          caption:
            typeof work.caption ===
            "string"
              ? work.caption.trim()
              : "",

          publishedAt:
            typeof work.publishedAt ===
            "string"
              ? work.publishedAt.trim()
              : "",
        }),
      );

    for (
      const work of
        cleanedWorks
    ) {
      if (
        !isValidHttpUrl(
          work.imageUrl,
        )
      ) {
        return NextResponse.json(
          {
            error: `Invalid Image URL: ${work.imageUrl}`,
          },
          {
            status: 400,
          },
        );
      }

      if (
        work.sourceUrl &&
        !isValidHttpUrl(
          work.sourceUrl,
        )
      ) {
        return NextResponse.json(
          {
            error: `Invalid Source URL: ${work.sourceUrl}`,
          },
          {
            status: 400,
          },
        );
      }
    }

    const supabaseAdmin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken:
              false,

            persistSession:
              false,
          },
        },
      );

    /*
      이미 등록된 external image 확인.

      source_id = image URL
      로 사용하기 때문에
      동일 URL의 중복 등록을 막는다.
    */
    const imageUrls =
      cleanedWorks.map(
        (work) =>
          work.imageUrl,
      );

    const {
      data:
        existingWorks,
      error:
        existingError,
    } =
      await supabaseAdmin
        .from("works")
        .select(
          "source_id",
        )
        .eq(
          "source",
          "external",
        )
        .in(
          "source_id",
          imageUrls,
        );

    if (
      existingError
    ) {
      console.error(
        "CHECK EXTERNAL IMAGE DUPLICATES ERROR:",
        existingError,
      );

      return NextResponse.json(
        {
          error:
            existingError.message,
        },
        {
          status: 400,
        },
      );
    }

    const existingIds =
      new Set(
        (
          existingWorks ??
          []
        )
          .map(
            (work) =>
              work.source_id,
          )
          .filter(
            Boolean,
          ),
      );

    const newWorks =
      cleanedWorks.filter(
        (work) =>
          !existingIds.has(
            work.imageUrl,
          ),
      );

    if (
      newWorks.length === 0
    ) {
      return NextResponse.json({
        success: true,
        importedCount: 0,
        skippedCount:
          cleanedWorks.length,
      });
    }

    const rows =
      newWorks.map(
        (work) => ({
          artist_id:
            artistId,

          type:
            "image",

          source:
            "external",

          /*
            외부 이미지 URL 자체를
            고유 source_id로 사용.
          */
          source_id:
            work.imageUrl,

          /*
            원 게시물 주소.
            입력하지 않았다면
            이미지 주소를 사용.
          */
          source_url:
            work.sourceUrl ||
            work.imageUrl,

          /*
            실제 이미지 표시도
            외부 URL을 직접 사용.
            Storage 업로드 없음.
          */
          thumbnail_url:
            work.imageUrl,

          title:
            work.caption ||
            null,

          description:
            work.caption ||
            null,

          published_at:
            work.publishedAt
              ? new Date(
                  `${work.publishedAt}T00:00:00.000Z`,
                ).toISOString()
              : new Date()
                  .toISOString(),

          duration_seconds:
            null,

          featured:
            false,
        }),
      );

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("works")
        .insert(
          rows,
        )
        .select(
          "id",
        );

    if (error) {
      console.error(
        "IMPORT EXTERNAL IMAGES ERROR:",
        error,
      );

      return NextResponse.json(
        {
          error:
            error.message,

          code:
            error.code,
        },
        {
          status: 400,
        },
      );
    }

    return NextResponse.json({
      success: true,

      importedCount:
        data?.length ??
        0,

      skippedCount:
        cleanedWorks.length -
        newWorks.length,
    });
  } catch (error) {
    console.error(
      "IMPORT EXTERNAL IMAGES SERVER ERROR:",
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