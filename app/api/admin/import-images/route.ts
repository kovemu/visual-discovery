import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

type ImageMetadata = {
  clientId: string;
  caption: string;
  sourceUrl: string;
  publishedAt: string;
};

export async function POST(
  request: NextRequest,
) {
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
        { status: 500 },
      );
    }

    const formData =
      await request.formData();

    const artistId =
      String(
        formData.get(
          "artistId",
        ) ?? "",
      ).trim();

    if (!artistId) {
      return NextResponse.json(
        {
          error:
            "Artist is required.",
        },
        { status: 400 },
      );
    }

    const metadataText =
      String(
        formData.get(
          "metadata",
        ) ?? "[]",
      );

    let metadata: ImageMetadata[] =
      [];

    try {
      metadata =
        JSON.parse(
          metadataText,
        );
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid image metadata.",
        },
        { status: 400 },
      );
    }

    const files =
      formData.getAll(
        "files",
      );

    if (
      files.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No images selected.",
        },
        { status: 400 },
      );
    }

    if (
      files.length !==
      metadata.length
    ) {
      return NextResponse.json(
        {
          error:
            "Image metadata count does not match file count.",
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
            autoRefreshToken:
              false,
            persistSession:
              false,
          },
        },
      );

    const uploadedPaths: string[] =
      [];

    const rows: {
      artist_id: string;
      type: string;
      source: string;
      source_id: string;
      source_url: string;
      title: string | null;
      description: string | null;
      thumbnail_url: string;
      published_at:
        | string
        | null;
      duration_seconds: null;
    }[] = [];

    for (
      let index = 0;
      index < files.length;
      index += 1
    ) {
      const rawFile =
        files[index];

      if (
        !(rawFile instanceof File)
      ) {
        continue;
      }

      if (
        !rawFile.type.startsWith(
          "image/",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Only image files are allowed.",
          },
          { status: 400 },
        );
      }

      const item =
        metadata[index];

      const extension =
        rawFile.type ===
        "image/webp"
          ? "webp"
          : "jpg";

      const storagePath =
        `${artistId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const {
        error: uploadError,
      } =
        await supabaseAdmin.storage
          .from("works")
          .upload(
            storagePath,
            rawFile,
            {
              contentType:
                rawFile.type,
              cacheControl:
                "31536000",
              upsert: false,
            },
          );

      if (uploadError) {
        console.error(
          "IMAGE UPLOAD ERROR:",
          uploadError,
        );

        if (
          uploadedPaths.length >
          0
        ) {
          await supabaseAdmin.storage
            .from("works")
            .remove(
              uploadedPaths,
            );
        }

        return NextResponse.json(
          {
            error:
              uploadError.message,
          },
          { status: 400 },
        );
      }

      uploadedPaths.push(
        storagePath,
      );

      const {
        data: publicUrlData,
      } =
        supabaseAdmin.storage
          .from("works")
          .getPublicUrl(
            storagePath,
          );

      const publicUrl =
        publicUrlData
          .publicUrl;

      rows.push({
        artist_id:
          artistId,

        type: "image",

        source: "upload",

        /*
          storage path 자체를
          source_id로 사용.
          이미지 Work마다 고유값.
        */
        source_id:
          storagePath,

        /*
          원출처가 있으면 원출처.
          없으면 Kovemu Storage URL.
        */
        source_url:
          item.sourceUrl.trim() ||
          publicUrl,

        title:
          item.caption.trim() ||
          null,

        description:
          item.caption.trim() ||
          null,

        thumbnail_url:
          publicUrl,

        published_at:
          item.publishedAt ||
          null,

        duration_seconds:
          null,
      });
    }

    const {
      data,
      error: insertError,
    } =
      await supabaseAdmin
        .from("works")
        .insert(rows)
        .select("id");

    if (insertError) {
      console.error(
        "INSERT IMAGE WORKS ERROR:",
        insertError,
      );

      if (
        uploadedPaths.length >
        0
      ) {
        await supabaseAdmin.storage
          .from("works")
          .remove(
            uploadedPaths,
          );
      }

      return NextResponse.json(
        {
          error:
            insertError.message,
          code:
            insertError.code,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      importedCount:
        data?.length ??
        rows.length,
    });
  } catch (error) {
    console.error(
      "IMPORT IMAGES SERVER ERROR:",
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