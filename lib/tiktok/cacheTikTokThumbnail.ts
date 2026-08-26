import { createClient } from "@supabase/supabase-js";

export const TIKTOK_THUMBNAILS_BUCKET =
  "tiktok-thumbnails";

export const TIKTOK_THUMBNAILS_PUBLIC_MARKER =
  "/storage/v1/object/public/tiktok-thumbnails/";

const TIKTOK_VIDEO_ID_PATTERN = /^\d+$/;

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

function extensionFromContentType(contentType: string) {
  switch (contentType) {
    case "image/webp":
      return { extension: "webp", contentType };
    case "image/jpeg":
    case "image/jpg":
      return { extension: "jpg", contentType: "image/jpeg" };
    case "image/png":
      return { extension: "png", contentType };
    case "image/avif":
      return { extension: "avif", contentType };
    case "image/gif":
      return { extension: "gif", contentType };
    default:
      if (contentType.startsWith("image/")) {
        return { extension: "jpg", contentType: "image/jpeg" };
      }

      return null;
  }
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
    const mapped = contentType
      ? extensionFromContentType(contentType)
      : null;

    if (!mapped) {
      console.warn("[cacheTikTokThumbnail] invalid content type", {
        videoId: trimmedVideoId,
        reason: contentType
          ? `unsupported_content_type:${contentType}`
          : "missing_content_type",
      });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const objectPath = `${trimmedVideoId}.${mapped.extension}`;

    const { error: uploadError } = await supabase.storage
      .from(TIKTOK_THUMBNAILS_BUCKET)
      .upload(objectPath, buffer, {
        contentType: mapped.contentType,
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
