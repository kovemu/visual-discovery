import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/requireAdmin";
import { extractInstagramUrl } from "@/lib/youtube/extractInstagramUrl";
import {
  excludeExistingYouTubeVideos,
  getExistingYouTubeSourceIds,
} from "@/lib/youtube/excludeExistingYouTubeVideos";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SHORTS_LIMIT_SECONDS = 150;
const PLAYLIST_PAGE_SIZE = 50;
const LOAD_OLDER_MAX_PAGES = 4;

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

type PlaylistItem = {
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
};

async function fetchUploadsPlaylistItems(
  uploadsPlaylistId: string,
  options: {
    startPageToken?: string;
    maxPages: number;
  },
) {
  const allItems: PlaylistItem[] = [];
  let pageToken = options.startPageToken;
  let nextPageToken: string | null = null;
  let partialError: string | null = null;

  for (
    let page = 0;
    page < options.maxPages;
    page += 1
  ) {
    const playlistParams = new URLSearchParams({
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: String(PLAYLIST_PAGE_SIZE),
      key: YOUTUBE_API_KEY!,
    });

    if (pageToken) {
      playlistParams.set("pageToken", pageToken);
    }

    let playlistResponse: Response;

    try {
      playlistResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?${playlistParams}`,
      );
    } catch {
      partialError =
        "Failed to load YouTube videos.";
      break;
    }

    if (!playlistResponse.ok) {
      partialError =
        "Failed to load YouTube videos.";
      break;
    }

    const playlistData = await playlistResponse.json();
    const items = (playlistData.items ??
      []) as PlaylistItem[];

    allItems.push(...items);
    nextPageToken =
      playlistData.nextPageToken ?? null;

    if (!nextPageToken) {
      break;
    }

    pageToken = nextPageToken;
  }

  return {
    items: allItems,
    nextPageToken,
    partialError,
  };
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
  const auth = await requireAdmin();

  if (!auth.ok) {
    return adminAuthErrorResponse(auth);
  }

  try {
    if (!YOUTUBE_API_KEY) {
      return NextResponse.json(
        { error: "YOUTUBE_API_KEY is not configured." },
        { status: 500 }
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase server configuration is missing." },
        { status: 500 },
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

    const isLoadOlder = Boolean(pageToken);
    const {
      items: playlistItems,
      nextPageToken,
      partialError,
    } = await fetchUploadsPlaylistItems(
      uploadsPlaylistId,
      {
        startPageToken: pageToken,
        maxPages: isLoadOlder
          ? LOAD_OLDER_MAX_PAGES
          : 1,
      },
    );

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
        embeddable: boolean | undefined;
      }
    >();

    for (let index = 0; index < videoIds.length; index += 50) {
      const idBatch = videoIds.slice(index, index + 50);

      const videoParams = new URLSearchParams({
        part: "contentDetails,statistics,status",
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
          embeddable: video.status?.embeddable,
        });
      }
    }

    let excludedNonEmbeddable = 0;

    const formattedVideos = playlistItems
      .map((item: PlaylistItem) => {
        const videoId = item.contentDetails?.videoId;
        const detail = videoDetailMap.get(videoId ?? "");

        if (!videoId || !detail) {
          return null;
        }

        if (detail.embeddable === false) {
          excludedNonEmbeddable += 1;
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
      .filter(
        (
          video,
        ): video is NonNullable<
          typeof video
        > => Boolean(video),
      );

    const shorts = formattedVideos.filter(
      (video: { durationSeconds: number }) =>
        video.durationSeconds <= SHORTS_LIMIT_SECONDS
    );

    const videos = formattedVideos.filter(
      (video: { durationSeconds: number }) =>
        video.durationSeconds > SHORTS_LIMIT_SECONDS
    );

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const existingSourceIds =
      await getExistingYouTubeSourceIds(
        supabaseAdmin,
        formattedVideos.map(
          (video: { id: string }) => video.id,
        ),
      );

    const filteredShorts = excludeExistingYouTubeVideos(
      shorts,
      existingSourceIds,
    );

    const filteredVideos = excludeExistingYouTubeVideos(
      videos,
      existingSourceIds,
    );

    const channelDescription =
      channel.snippet.description ?? "";

    const importStats = {
      loaded: videoIds.length,
      excludedNonEmbeddable,
      available: formattedVideos.length,
    };

    console.info(
      "[youtube-importer/channel]",
      importStats,
    );

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

      shorts: filteredShorts,
      videos: filteredVideos,
      nextPageToken,
      importStats,
      ...(partialError
        ? { warning: partialError }
        : {}),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
