import { NextRequest, NextResponse } from "next/server";

import { extractInstagramUrl } from "@/lib/youtube/extractInstagramUrl";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const SHORTS_LIMIT_SECONDS = 150;

function parseChannelUrl(url: string) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (parts.length === 0) {
      return null;
    }

    if (parts[0].startsWith("@")) {
      return {
        type: "handle",
        value: parts[0],
      };
    }

    if (parts[0] === "channel" && parts[1]) {
      return {
        type: "channelId",
        value: parts[1],
      };
    }

    return null;
  } catch {
    return null;
  }
}

function parseDuration(duration: string) {
  const match = duration.match(
    /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
  );

  if (!match) {
    return 0;
  }

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);

  return hours * 3600 + minutes * 60 + seconds;
}

function parseStatistic(
  value: string | number | undefined,
) {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    if (!YOUTUBE_API_KEY) {
      return NextResponse.json(
        { error: "YOUTUBE_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const channelUrl = request.nextUrl.searchParams.get("url");
    const pageToken =
      request.nextUrl.searchParams.get("pageToken") ??
      undefined;

    if (!channelUrl) {
      return NextResponse.json(
        { error: "Channel URL is required." },
        { status: 400 }
      );
    }

    const parsedChannel = parseChannelUrl(channelUrl);

    if (!parsedChannel) {
      return NextResponse.json(
        { error: "Unsupported YouTube channel URL." },
        { status: 400 }
      );
    }

    const channelParams = new URLSearchParams({
      part: "snippet,contentDetails",
      key: YOUTUBE_API_KEY,
    });

    if (parsedChannel.type === "handle") {
      channelParams.set("forHandle", parsedChannel.value);
    }

    if (parsedChannel.type === "channelId") {
      channelParams.set("id", parsedChannel.value);
    }

    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?${channelParams}`
    );

    if (!channelResponse.ok) {
      return NextResponse.json(
        { error: "Failed to load YouTube channel." },
        { status: 500 }
      );
    }

    const channelData = await channelResponse.json();
    const channel = channelData.items?.[0];

    if (!channel) {
      return NextResponse.json(
        { error: "YouTube channel not found." },
        { status: 404 }
      );
    }

    const uploadsPlaylistId =
      channel.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      return NextResponse.json(
        { error: "Uploads playlist not found." },
        { status: 404 }
      );
    }

    const playlistParams = new URLSearchParams({
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "50",
      key: YOUTUBE_API_KEY,
    });

    if (pageToken) {
      playlistParams.set("pageToken", pageToken);
    }

    const playlistResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${playlistParams}`
    );

    if (!playlistResponse.ok) {
      return NextResponse.json(
        { error: "Failed to load YouTube videos." },
        { status: 500 }
      );
    }

    const playlistData = await playlistResponse.json();
    const playlistItems = playlistData.items ?? [];
    const nextPageToken =
      playlistData.nextPageToken ?? null;

    const videoIds = playlistItems
      .map((item: { contentDetails?: { videoId?: string } }) => item.contentDetails?.videoId)
      .filter(Boolean);

    const videoDetailMap = new Map<
      string,
      {
        duration: string;
        durationSeconds: number;
        viewCount: number;
        likeCount: number;
      }
    >();

    for (let index = 0; index < videoIds.length; index += 50) {
      const idBatch = videoIds.slice(index, index + 50);

      const videoParams = new URLSearchParams({
        part: "contentDetails,statistics",
        id: idBatch.join(","),
        key: YOUTUBE_API_KEY,
      });

      const videoResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${videoParams}`
      );

      if (!videoResponse.ok) {
        return NextResponse.json(
          { error: "Failed to load video details." },
          { status: 500 }
        );
      }

      const videoData = await videoResponse.json();

      for (const video of videoData.items ?? []) {
        const duration = video.contentDetails?.duration ?? "PT0S";

        videoDetailMap.set(video.id, {
          duration,
          durationSeconds: parseDuration(duration),
          viewCount: parseStatistic(
            video.statistics?.viewCount,
          ),
          likeCount: parseStatistic(
            video.statistics?.likeCount,
          ),
        });
      }
    }

    const formattedVideos = playlistItems
      .map((item: {
        contentDetails?: {
          videoId?: string;
          videoPublishedAt?: string;
        };
        snippet: {
          title: string;
          description: string;
          publishedAt?: string;
          thumbnails?: Record<
            string,
            { url?: string }
          >;
        };
      }) => {
        const videoId = item.contentDetails?.videoId;
        const detail = videoDetailMap.get(videoId ?? "");

        if (!videoId || !detail) {
          return null;
        }

        return {
          id: videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnail:
            item.snippet.thumbnails?.maxres?.url ||
            item.snippet.thumbnails?.high?.url ||
            item.snippet.thumbnails?.medium?.url ||
            item.snippet.thumbnails?.default?.url,
          publishedAt:
            item.contentDetails?.videoPublishedAt ||
            item.snippet.publishedAt,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          duration: detail.duration,
          durationSeconds: detail.durationSeconds,
          viewCount: detail.viewCount,
          likeCount: detail.likeCount,
        };
      })
      .filter(Boolean);

    const shorts = formattedVideos.filter(
      (video: { durationSeconds: number }) =>
        video.durationSeconds <= SHORTS_LIMIT_SECONDS
    );

    const videos = formattedVideos.filter(
      (video: { durationSeconds: number }) =>
        video.durationSeconds > SHORTS_LIMIT_SECONDS
    );

    const channelDescription =
      channel.snippet.description ?? "";

    return NextResponse.json({
      channel: {
        id: channel.id,
        title: channel.snippet.title,
        description: channelDescription,
        thumbnail:
          channel.snippet.thumbnails?.high?.url ||
          channel.snippet.thumbnails?.default?.url,
        customUrl:
          channel.snippet.customUrl ??
          "",
        instagramUrl:
          extractInstagramUrl(
            channelDescription,
          ),
      },

      shorts,
      videos,
      nextPageToken,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
