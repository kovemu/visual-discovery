import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const TIKTOK_THUMBNAILS_BUCKET =
  "tiktok-thumbnails";

export const TIKTOK_THUMBNAILS_PUBLIC_MARKER =
  "/storage/v1/object/public/tiktok-thumbnails/";

const TIKTOK_VIDEO_ID_PATTERN = /^\d+$/;
const WEBP_CONTENT_TYPE = "image/webp";

function getServiceRoleClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getTikTokThumbnailObjectPath(
  videoId: string,
) {
  return `${videoId.trim()}.webp`;
}

export function extractTikTokThumbnailObjectPath(
  url: string | null | undefined,
) {
  if (
    typeof url !== "string" ||
    !url.includes(TIKTOK_THUMBNAILS_PUBLIC_MARKER)
  ) {
    return null;
  }

  const markerIndex = url.indexOf(
    TIKTOK_THUMBNAILS_PUBLIC_MARKER,
  );
  const rawPath = url
    .slice(
      markerIndex +
        TIKTOK_THUMBNAILS_PUBLIC_MARKER.length,
    )
    .split("?")[0]
    .split("#")[0]
    .trim();

  if (!rawPath) {
    return null;
  }

  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}

export function isPermanentTikTokThumbnailUrl(
  url: string | null | undefined,
) {
  return (
    typeof url === "string" &&
    url.includes(TIKTOK_THUMBNAILS_PUBLIC_MARKER)
  );
}

function normalizeContentType(value: string | null) {
  if (!value) {
    return null;
  }

  return value.split(";")[0].trim().toLowerCase();
}

async function optimizeTikTokThumbnailBuffer(
  buffer: Buffer,
) {
  return sharp(buffer)
    .resize({
      width: 720,
      height: 1280,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 78 })
    .toBuffer();
}

export async function cacheTikTokThumbnail({
  videoId,
  temporaryThumbnailUrl,
}: {
  videoId: string;
  temporaryThumbnailUrl: string;
}): Promise<string | null> {
  const trimmedVideoId = videoId.trim();
  const trimmedUrl = temporaryThumbnailUrl.trim();

  if (
    !TIKTOK_VIDEO_ID_PATTERN.test(trimmedVideoId) ||
    !trimmedUrl
  ) {
    console.warn("[cacheTikTokThumbnail] invalid input", {
      videoId: trimmedVideoId,
      reason: "missing_or_invalid_video_id_or_url",
    });
    return null;
  }

  if (isPermanentTikTokThumbnailUrl(trimmedUrl)) {
    return trimmedUrl;
  }

  const supabase = getServiceRoleClient();

  if (!supabase) {
    console.error("[cacheTikTokThumbnail] missing supabase config", {
      videoId: trimmedVideoId,
      reason: "missing_service_role_config",
    });
    return null;
  }

  try {
    const response = await fetch(trimmedUrl, {
      headers: {
        Accept: "image/*,*/*;q=0.8",
      },
      cache: "no-store",
      redirect: "follow",
    });

    if (!response.ok) {
      console.warn("[cacheTikTokThumbnail] download failed", {
        videoId: trimmedVideoId,
        status: response.status,
        reason: "thumbnail_download_not_ok",
      });
      return null;
    }

    const contentType = normalizeContentType(
      response.headers.get("content-type"),
    );

    if (contentType && !contentType.startsWith("image/")) {
      console.warn("[cacheTikTokThumbnail] invalid content type", {
        videoId: trimmedVideoId,
        reason: `unsupported_content_type:${contentType}`,
      });
      return null;
    }

    const sourceBuffer = Buffer.from(
      await response.arrayBuffer(),
    );
    const optimizedBuffer =
      await optimizeTikTokThumbnailBuffer(
        sourceBuffer,
      );
    const objectPath =
      getTikTokThumbnailObjectPath(trimmedVideoId);

    const { error: uploadError } = await supabase.storage
      .from(TIKTOK_THUMBNAILS_BUCKET)
      .upload(objectPath, optimizedBuffer, {
        contentType: WEBP_CONTENT_TYPE,
        upsert: true,
        cacheControl: "31536000",
      });

    if (uploadError) {
      console.error("[cacheTikTokThumbnail] upload failed", {
        videoId: trimmedVideoId,
        reason: uploadError.message,
      });
      return null;
    }

    const { data } = supabase.storage
      .from(TIKTOK_THUMBNAILS_BUCKET)
      .getPublicUrl(objectPath);

    return data.publicUrl || null;
  } catch (error) {
    console.error("[cacheTikTokThumbnail] unexpected error", {
      videoId: trimmedVideoId,
      reason:
        error instanceof Error
          ? error.message
          : "unexpected_error",
    });
    return null;
  }
}
