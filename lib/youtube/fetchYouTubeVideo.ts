export type YouTubeVideoMeta = {
  videoId: string;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  canonicalUrl: string;
};

function parseIsoDuration(duration: string) {
  const match = duration.match(
    /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/,
  );

  if (!match) {
    return null;
  }

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const total = hours * 3600 + minutes * 60 + seconds;

  return total > 0 ? total : null;
}

function thumbnailFromId(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

async function fetchYouTubeOEmbed(
  canonicalUrl: string,
  videoId: string,
): Promise<YouTubeVideoMeta | null> {
  const oembedUrl = new URL(
    "https://www.youtube.com/oembed",
  );
  oembedUrl.searchParams.set("url", canonicalUrl);
  oembedUrl.searchParams.set("format", "json");

  const response = await fetch(oembedUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    title?: string;
    thumbnail_url?: string;
  };

  return {
    videoId,
    title: data.title?.trim() || null,
    description: null,
    thumbnailUrl:
      data.thumbnail_url?.trim() ||
      thumbnailFromId(videoId),
    durationSeconds: null,
    publishedAt: null,
    canonicalUrl,
  };
}

export async function fetchYouTubeVideoMeta(
  videoId: string,
): Promise<YouTubeVideoMeta | null> {
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (apiKey) {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      id: videoId,
      key: apiKey,
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params}`,
      { cache: "no-store" },
    );

    if (response.ok) {
      const data = (await response.json()) as {
        items?: Array<{
          snippet?: {
            title?: string;
            description?: string;
            publishedAt?: string;
            thumbnails?: {
              maxres?: { url?: string };
              high?: { url?: string };
              medium?: { url?: string };
              default?: { url?: string };
            };
          };
          contentDetails?: {
            duration?: string;
          };
        }>;
      };

      const video = data.items?.[0];

      if (video) {
        const thumbnails = video.snippet?.thumbnails;
        const thumbnailUrl =
          thumbnails?.maxres?.url ||
          thumbnails?.high?.url ||
          thumbnails?.medium?.url ||
          thumbnails?.default?.url ||
          thumbnailFromId(videoId);

        return {
          videoId,
          title: video.snippet?.title?.trim() || null,
          description:
            video.snippet?.description?.trim() || null,
          thumbnailUrl,
          durationSeconds: video.contentDetails?.duration
            ? parseIsoDuration(video.contentDetails.duration)
            : null,
          publishedAt: video.snippet?.publishedAt || null,
          canonicalUrl,
        };
      }
    }
  }

  return fetchYouTubeOEmbed(canonicalUrl, videoId);
}
