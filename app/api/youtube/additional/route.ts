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

const MAX_PLAYLIST_ITEMS = 200;

function parseDuration(duration: string) {
  const match = duration.match(
    /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/,
  );

  if (!match) {
    return 0;
  }

  const hours = Number(
    match[1] || 0,
  );

  const minutes = Number(
    match[2] || 0,
  );

  const seconds = Number(
    match[3] || 0,
  );

  return (
    hours * 3600 +
    minutes * 60 +
    seconds
  );
}

function parseYouTubeUrl(url: string) {
  try {
    const parsed =
      new URL(url.trim());

    const hostname =
      parsed.hostname
        .replace(/^www\./, "")
        .toLowerCase();

    /*
      Playlist가 있으면 playlist 우선.
      watch?v=...&list=... 형태도 playlist로 처리.
    */
    const playlistId =
      parsed.searchParams.get("list");

    if (playlistId) {
      return {
        type: "playlist" as const,
        id: playlistId,
      };
    }

    /*
      youtu.be/VIDEO_ID
    */
    if (
      hostname === "youtu.be"
    ) {
      const videoId =
        parsed.pathname
          .split("/")
          .filter(Boolean)[0];

      if (videoId) {
        return {
          type: "video" as const,
          id: videoId,
        };
      }
    }

    if (
      hostname === "youtube.com" ||
      hostname ===
        "m.youtube.com" ||
      hostname ===
        "music.youtube.com"
    ) {
      /*
        youtube.com/watch?v=...
      */
      if (
        parsed.pathname ===
        "/watch"
      ) {
        const videoId =
          parsed.searchParams.get(
            "v",
          );

        if (videoId) {
          return {
            type: "video" as const,
            id: videoId,
          };
        }
      }

      /*
        youtube.com/shorts/VIDEO_ID
      */
      if (
        parsed.pathname.startsWith(
          "/shorts/",
        )
      ) {
        const videoId =
          parsed.pathname
            .split("/")
            .filter(Boolean)[1];

        if (videoId) {
          return {
            type: "video" as const,
            id: videoId,
          };
        }
      }

      /*
        youtube.com/embed/VIDEO_ID
      */
      if (
        parsed.pathname.startsWith(
          "/embed/",
        )
      ) {
        const videoId =
          parsed.pathname
            .split("/")
            .filter(Boolean)[1];

        if (videoId) {
          return {
            type: "video" as const,
            id: videoId,
          };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function loadVideoDetails(
  videoIds: string[],
) {
  const result = new Map<
    string,
    {
      id: string;
      title: string;
      description: string;
      thumbnail: string;
      publishedAt: string;
      url: string;
      duration: string;
      durationSeconds: number;
    }
  >();

  const uniqueIds =
    Array.from(
      new Set(videoIds),
    ).filter(Boolean);

  for (
    let index = 0;
    index < uniqueIds.length;
    index += 50
  ) {
    const batch =
      uniqueIds.slice(
        index,
        index + 50,
      );

    const params =
      new URLSearchParams({
        part:
          "snippet,contentDetails",
        id: batch.join(","),
        key: YOUTUBE_API_KEY!,
      });

    const response =
      await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${params}`,
      );

    if (!response.ok) {
      throw new Error(
        "Failed to load YouTube video details.",
      );
    }

    const data =
      await response.json();

    for (
      const video of
        data.items ?? []
    ) {
      const duration =
        video.contentDetails
          ?.duration ??
        "PT0S";

      const thumbnail =
        video.snippet
          ?.thumbnails?.maxres
          ?.url ||
        video.snippet
          ?.thumbnails?.high
          ?.url ||
        video.snippet
          ?.thumbnails?.medium
          ?.url ||
        video.snippet
          ?.thumbnails?.default
          ?.url ||
        "";

      result.set(video.id, {
        id: video.id,

        title:
          video.snippet?.title ??
          "Untitled video",

        description:
          video.snippet
            ?.description ?? "",

        thumbnail,

        publishedAt:
          video.snippet
            ?.publishedAt ?? "",

        url:
          `https://www.youtube.com/watch?v=${video.id}`,

        duration,

        durationSeconds:
          parseDuration(
            duration,
          ),
      });
    }
  }

  return result;
}

async function loadSingleVideo(
  videoId: string,
) {
  const map =
    await loadVideoDetails([
      videoId,
    ]);

  const video =
    map.get(videoId);

  if (!video) {
    throw new Error(
      "YouTube video not found.",
    );
  }

  return [video];
}

async function loadPlaylist(
  playlistId: string,
) {
  const videoIds: string[] = [];

  let pageToken:
    | string
    | undefined;

  while (
    videoIds.length <
    MAX_PLAYLIST_ITEMS
  ) {
    const params =
      new URLSearchParams({
        part:
          "snippet,contentDetails",
        playlistId,
        maxResults: "50",
        key: YOUTUBE_API_KEY!,
      });

    if (pageToken) {
      params.set(
        "pageToken",
        pageToken,
      );
    }

    const response =
      await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      );

    if (!response.ok) {
      throw new Error(
        "Failed to load YouTube playlist.",
      );
    }

    const data =
      await response.json();

    for (
      const item of
        data.items ?? []
    ) {
      const videoId =
        item.contentDetails
          ?.videoId ||
        item.snippet
          ?.resourceId
          ?.videoId;

      if (videoId) {
        videoIds.push(
          videoId,
        );
      }
    }

    pageToken =
      data.nextPageToken;

    if (!pageToken) {
      break;
    }
  }

  const trimmedIds =
    videoIds.slice(
      0,
      MAX_PLAYLIST_ITEMS,
    );

  const detailMap =
    await loadVideoDetails(
      trimmedIds,
    );

  /*
    Playlist 순서 유지
  */
  return trimmedIds
    .map((id) =>
      detailMap.get(id),
    )
    .filter(
      (
        video,
      ): video is NonNullable<
        typeof video
      > => Boolean(video),
    );
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
        {
          status: 500,
        },
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
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

    const url =
      request.nextUrl.searchParams.get(
        "url",
      );

    if (!url) {
      return NextResponse.json(
        {
          error:
            "YouTube video or playlist URL is required.",
        },
        {
          status: 400,
        },
      );
    }

    const parsed =
      parseYouTubeUrl(url);

    if (!parsed) {
      return NextResponse.json(
        {
          error:
            "Unsupported YouTube URL.",
        },
        {
          status: 400,
        },
      );
    }

    const works =
      parsed.type === "playlist"
        ? await loadPlaylist(
            parsed.id,
          )
        : await loadSingleVideo(
            parsed.id,
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

    const filteredWorks =
      await filterOutExistingYouTubeVideos(
        supabaseAdmin,
        works,
      );

    return NextResponse.json({
      type: parsed.type,
      works: filteredWorks,
    });
  } catch (error) {
    console.error(
      "LOAD ADDITIONAL YOUTUBE ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      {
        status: 500,
      },
    );
  }
}