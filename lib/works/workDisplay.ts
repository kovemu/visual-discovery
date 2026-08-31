export type WorkMediaItem = {
  id: string;
  artistId?: string;
  artistName?: string;
  type?: "image" | "youtube" | "tiktok";
  source?: string;
  image?: string;
  videoId?: string;
  sourceUrl?: string;
  title?: string | null;
  description?: string | null;
  caption?: string | null;
  rotationDegrees?: number;
  thumbnailRotationDegrees?: number;
};

export function getAnalyticsSource(
  work: Pick<
    WorkMediaItem,
    "source" | "type"
  >,
) {
  return work.source ?? work.type ?? "image";
}

export function getSourceLabel(
  work: Pick<
    WorkMediaItem,
    "source" | "type"
  >,
  labels?: {
    youtube: string;
    tiktok: string;
    image: string;
  },
) {
  const source = getAnalyticsSource(work);

  if (source === "youtube") {
    return labels?.youtube ?? "YouTube";
  }

  if (source === "tiktok") {
    return labels?.tiktok ?? "TikTok";
  }

  return labels?.image ?? "Image";
}

export function getWorkThumbnail(
  work: WorkMediaItem,
) {
  if (work.image) {
    return work.image;
  }

  if (
    work.type === "youtube" &&
    work.videoId
  ) {
    return `https://i.ytimg.com/vi/${work.videoId}/maxresdefault.jpg`;
  }

  return "";
}

export function isPlayableVideo(
  work: WorkMediaItem,
) {
  return (
    (work.type === "youtube" ||
      work.type === "tiktok") &&
    Boolean(work.videoId)
  );
}

export function formatDurationSeconds(
  totalSeconds: number,
): string {
  const safeSeconds = Math.max(
    0,
    Math.floor(totalSeconds),
  );

  if (safeSeconds <= 0) {
    return "";
  }

  const hours = Math.floor(
    safeSeconds / 3600,
  );
  const minutes = Math.floor(
    (safeSeconds % 3600) / 60,
  );
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds
    .toString()
    .padStart(2, "0")}`;
}
