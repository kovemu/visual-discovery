import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@supabase/supabase-js";

import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/requireAdmin";
import {
  filterOutExistingYouTubeVideos,
} from "@/lib/youtube/excludeExistingYouTubeVideos";

const YOUTUBE_API_KEY =
  process.env.YOUTUBE_API_KEY;

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_SEARCH_RESULTS = 50;
const LOAD_OLDER_MAX_PAGES = 4;

const EXCLUDED_SEARCH_TERMS = [
  "-KBS",
  "-SBS",
  "-MBC",
  "-Mnet",
  "-M2",
  '-"ALL THE K-POP"',
];

function buildFancamSearchQuery(
  query: string,
) {
  const exclusions =
    EXCLUDED_SEARCH_TERMS.join(" ");

  return query
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map(
      (segment) =>
        `${segment} ${exclusions}`,
    )
    .join(" | ");
}

type FancamWork = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  url: string;
  duration: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  channelId: string;
  channelTitle: string;
};

function parseDuration(duration: string) {
  const match = duration.match(
    /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/,
  );

  if (!match) {
    return 0;
  }

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);

  return hours * 3600 + minutes * 60 + seconds;
}

function parseChannelUrl(url: string) {
  try {
    const parsed = new URL(url.trim());
    const parts = parsed.pathname
      .split("/")
      .filter(Boolean);

    if (parts.length === 0) {
      return null;
    }

    if (parts[0].startsWith("@")) {
      return {
        type: "handle" as const,
        value: parts[0],
      };
    }

    if (parts[0] === "channel" && parts[1]) {
      return {
        type: "channelId" as const,
        value: parts[1],
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function resolveOfficialChannelId(
  youtubeUrl: string | null,
): Promise<string | null> {
  if (!youtubeUrl?.trim() || !YOUTUBE_API_KEY) {
    return null;
  }

  const parsed = parseChannelUrl(youtubeUrl);

  if (!parsed) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      part: "id",
      key: YOUTUBE_API_KEY,
    });

    if (parsed.type === "handle") {
      params.set("forHandle", parsed.value);
    } else {
      params.set("id", parsed.value);
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?${params}`,
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const channelId = data.items?.[0]?.id;

    return typeof channelId === "string"
      ? channelId
      : null;
  } catch {
    return null;
  }
}

async function searchFancamVideoIds(
  query: string,
  pageToken?: string,
) {
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(MAX_SEARCH_RESULTS),
    videoDuration: "short",
    videoEmbeddable: "true",
    relevanceLanguage: "ko",
    regionCode: "KR",
    key: YOUTUBE_API_KEY!,
  });

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
  );

  if (!response.ok) {
    throw new Error(
      "Failed to search YouTube fancam videos.",
    );
  }

  const data = await response.json();

  const videoIds: string[] = [];

  for (const item of data.items ?? []) {
    const videoId =
      item.id?.videoId;

    if (videoId) {
      videoIds.push(videoId);
    }
  }

  return {
    videoIds: Array.from(new Set(videoIds)),
    nextPageToken:
      (data.nextPageToken as
        | string
        | undefined) ?? null,
  };
}

async function searchFancamVideoIdsPaginated(
  query: string,
  options: {
    startPageToken?: string;
    maxPages: number;
  },
) {
  const orderedIds: string[] = [];
  const seen = new Set<string>();
  let pageToken = options.startPageToken;
  let nextPageToken: string | null = null;
  let partialError: string | null = null;

  for (
    let page = 0;
    page < options.maxPages;
    page += 1
  ) {
    try {
      const result =
        await searchFancamVideoIds(
          query,
          pageToken,
        );

      for (const id of result.videoIds) {
        if (!seen.has(id)) {
          seen.add(id);
          orderedIds.push(id);
        }
      }

      nextPageToken =
        result.nextPageToken;

      if (!nextPageToken) {
        break;
      }

      pageToken = nextPageToken;
    } catch (error) {
      partialError =
        error instanceof Error
          ? error.message
          : "Failed to search YouTube fancam videos.";
      break;
    }
  }

  return {
    videoIds: orderedIds,
    nextPageToken,
    partialError,
  };
}

async function loadVideoDetails(
  videoIds: string[],
) {
  const result = new Map<string, FancamWork>();
  let excludedNonEmbeddable = 0;

  const uniqueIds = Array.from(
    new Set(videoIds),
  ).filter(Boolean);

  for (
    let index = 0;
    index < uniqueIds.length;
    index += 50
  ) {
    const batch = uniqueIds.slice(
      index,
      index + 50,
    );

    const params = new URLSearchParams({
      part:
        "snippet,contentDetails,statistics,status",
      id: batch.join(","),
      key: YOUTUBE_API_KEY!,
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params}`,
    );

    if (!response.ok) {
      throw new Error(
        "Failed to load YouTube video details.",
      );
    }

    const data = await response.json();

    for (const video of data.items ?? []) {
      if (video.status?.embeddable === false) {
        excludedNonEmbeddable += 1;
        continue;
      }

      const duration =
        video.contentDetails
          ?.duration ?? "PT0S";

      const durationSeconds =
        parseDuration(duration);

      const thumbnail =
        video.snippet?.thumbnails
          ?.maxres?.url ||
        video.snippet?.thumbnails
          ?.high?.url ||
        video.snippet?.thumbnails
          ?.medium?.url ||
        video.snippet?.thumbnails?.default
          ?.url ||
        "";

      result.set(video.id, {
        id: video.id,

        title:
          video.snippet?.title ??
          "Untitled video",

        description:
          video.snippet?.description ??
          "",

        thumbnail,

        publishedAt:
          video.snippet?.publishedAt ??
          "",

        url: `https://www.youtube.com/watch?v=${video.id}`,

        duration,

        durationSeconds,

        viewCount: Number(
          video.statistics?.viewCount ??
            0,
        ),

        likeCount: Number(
          video.statistics?.likeCount ??
            0,
        ),

        channelId:
          video.snippet?.channelId ??
          "",

        channelTitle:
          video.snippet?.channelTitle ??
          "",
      });
    }
  }

  return {
    videos: result,
    excludedNonEmbeddable,
  };
}

export async function GET(
  request: NextRequest,
) {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return adminAuthErrorResponse(auth);
  }

  try {
    if (!YOUTUBE_API_KEY) {
      return NextResponse.json(
        {
          error:
            "YOUTUBE_API_KEY is not configured.",
        },
        { status: 500 },
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Supabase server configuration is missing.",
        },
        { status: 500 },
      );
    }

    const artistId =
      request.nextUrl.searchParams.get(
        "artistId",
      );

    const searchQuery =
      request.nextUrl.searchParams
        .get("q")
        ?.trim();

    const excludeBroadcastParam =
      request.nextUrl.searchParams.get(
        "excludeBroadcast",
      );

    const excludeBroadcast =
      excludeBroadcastParam !==
      "false";

    const pageToken =
      request.nextUrl.searchParams.get(
        "pageToken",
      ) ?? undefined;

    if (!artistId) {
      return NextResponse.json(
        {
          error:
            "Artist ID is required.",
        },
        { status: 400 },
      );
    }

    if (!searchQuery) {
      return NextResponse.json(
        {
          error:
            "Search query is required.",
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
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      );

    const {
      data: artist,
      error: artistError,
    } = await supabaseAdmin
      .from("creators")
      .select("youtube_url")
      .eq("id", artistId)
      .maybeSingle();

    if (artistError) {
      return NextResponse.json(
        {
          error: artistError.message,
        },
        { status: 400 },
      );
    }

    if (!artist) {
      return NextResponse.json(
        {
          error: "Artist not found.",
        },
        { status: 404 },
      );
    }

    const officialChannelId =
      await resolveOfficialChannelId(
        artist.youtube_url,
      );

    const searchQueryForApi =
      excludeBroadcast
        ? buildFancamSearchQuery(
            searchQuery,
          )
        : searchQuery;

    const isLoadOlder = Boolean(pageToken);

    const {
      videoIds,
      nextPageToken,
      partialError,
    } =
      await searchFancamVideoIdsPaginated(
        searchQueryForApi,
        {
          startPageToken: pageToken,
          maxPages: isLoadOlder
            ? LOAD_OLDER_MAX_PAGES
            : 1,
        },
      );

    if (videoIds.length === 0) {
      return NextResponse.json({
        works: [],
        nextPageToken,
      });
    }

    const {
      videos: detailMap,
      excludedNonEmbeddable,
    } = await loadVideoDetails(
      videoIds,
    );

    const works = videoIds
      .map((id) => detailMap.get(id))
      .filter(
        (
          video,
        ): video is FancamWork =>
          Boolean(video),
      )
      .filter((video) => {
        if (
          officialChannelId &&
          video.channelId ===
            officialChannelId
        ) {
          return false;
        }

        return true;
      });

    const filteredWorks =
      await filterOutExistingYouTubeVideos(
        supabaseAdmin,
        works,
      );

    const importStats = {
      loaded: videoIds.length,
      excludedNonEmbeddable,
      available: works.length,
    };

    console.info(
      "[youtube-importer/search]",
      importStats,
    );

    return NextResponse.json({
      works: filteredWorks,
      nextPageToken,
      importStats,
      ...(partialError
        ? { warning: partialError }
        : {}),
    });
  } catch (error) {
    console.error(
      "YOUTUBE FANCAM SEARCH ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      { status: 500 },
    );
  }
}
