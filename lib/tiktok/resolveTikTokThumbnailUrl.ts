import {
  cacheTikTokThumbnail,
  isPermanentTikTokThumbnailUrl,
} from "@/lib/tiktok/cacheTikTokThumbnail";

export async function resolveTikTokThumbnailUrl({
  videoId,
  incomingThumbnail,
  existingThumbnail,
}: {
  videoId: string;
  incomingThumbnail: string | null;
  existingThumbnail: string | null;
}): Promise<string | null> {
  if (isPermanentTikTokThumbnailUrl(incomingThumbnail)) {
    return incomingThumbnail;
  }

  if (!incomingThumbnail) {
    return isPermanentTikTokThumbnailUrl(existingThumbnail)
      ? existingThumbnail
      : null;
  }

  const cached = await cacheTikTokThumbnail({
    videoId,
    temporaryThumbnailUrl: incomingThumbnail,
  });

  if (cached) {
    return cached;
  }

  if (isPermanentTikTokThumbnailUrl(existingThumbnail)) {
    return existingThumbnail;
  }

  return null;
}
