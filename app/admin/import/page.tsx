"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";
import YouTubePreviewModal, {
  YouTubePreviewThumbnail,
} from "@/components/admin/YouTubePreviewModal";
import type {
  WorkAnalysis,
  WorkSourceTab,
} from "@/lib/ai/analyzeWorks";
import { ANALYZE_WORKS_BATCH_SIZE } from "@/lib/ai/analyzeWorks";
import type { ResearchSource } from "@/lib/ai/generateArtistProfile";
import { extractInstagramUrl } from "@/lib/youtube/extractInstagramUrl";

type YouTubeVideo = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  url: string;
  duration?: string;
  durationSeconds?: number;
  viewCount?: number;
  likeCount?: number;
  channelId?: string;
  channelTitle?: string;
};

type YouTubeChannel = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  customUrl?: string;
  instagramUrl?: string;
};

const TAG_OPTIONS = [
  "K-pop",
  "Virtual",
  "Boy Group",
  "Girl Group",
  "Rock",
  "Band",
  "Solo",
  "Performance",
  "Cosplay",
] as const;

type ArtistTag = (typeof TAG_OPTIONS)[number];

type ArtistProfileDraft = {
  name: string;
  username: string;
  category: string;
  tags: ArtistTag[];
  youtubeUrl: string;
  instagramUrl: string;
  profileImage: string;
  tagline: string;
  bio: string;
  coverImageUrl: string;
};

type Artist = {
  id: string;
  name: string;
  username: string | null;
};

type ExistingCreator = {
  id: string;
  name: string;
  username: string | null;
  category: string | null;
  tagline: string | null;
  bio: string | null;
  profile_image: string | null;
  cover_image: string | null;
  youtube_url: string | null;
  instagram_url: string | null;
  tags: string[] | null;
};

type NewArtistForm = {
  name: string;
  username: string;
  category: string;
};

type ImageDraft = {
  id: string;

  file: File;
  previewUrl: string;

  caption: string;
  sourceUrl: string;
  publishedAt: string;
};

type ExternalImageDraft = {
  id: string;

  imageUrl: string;
  sourceUrl: string;

  caption: string;
  publishedAt: string;
};

type TabType =
  | "shorts"
  | "videos"
  | "fancams"
  | "additional"
  | "images";

type YouTubeVideoSort =
  | "views"
  | "likes"
  | "recent"
  | "oldest"
  | "ai";

const youtubeVideoSortOptions: {
  value: YouTubeVideoSort;
  label: string;
}[] = [
  {
    value: "recent",
    label: "Recent",
  },
  {
    value: "oldest",
    label: "Oldest",
  },
  {
    value: "views",
    label: "Views",
  },
  {
    value: "likes",
    label: "Likes",
  },
  {
    value: "ai",
    label: "AI Score",
  },
];

function sortYouTubeVideos(
  works: YouTubeVideo[],
  sort: YouTubeVideoSort,
  analyses: Record<string, WorkAnalysis> = {},
) {
  const copy = [...works];

  if (sort === "ai") {
    return copy.sort((a, b) => {
      const scoreA =
        analyses[a.id]?.discoveryScore;
      const scoreB =
        analyses[b.id]?.discoveryScore;
      const hasA =
        typeof scoreA === "number";
      const hasB =
        typeof scoreB === "number";

      if (hasA && hasB) {
        return scoreB - scoreA;
      }

      if (hasA) {
        return -1;
      }

      if (hasB) {
        return 1;
      }

      return 0;
    });
  }

  if (sort === "views") {
    return copy.sort(
      (a, b) =>
        (b.viewCount ?? 0) -
        (a.viewCount ?? 0),
    );
  }

  if (sort === "likes") {
    return copy.sort(
      (a, b) =>
        (b.likeCount ?? 0) -
        (a.likeCount ?? 0),
    );
  }

  if (sort === "oldest") {
    return copy.sort(
      (a, b) =>
        new Date(
          a.publishedAt,
        ).getTime() -
        new Date(
          b.publishedAt,
        ).getTime(),
    );
  }

  return copy.sort(
    (a, b) =>
      new Date(
        b.publishedAt,
      ).getTime() -
      new Date(
        a.publishedAt,
      ).getTime(),
  );
}

function buildDefaultFancamKeyword(
  artistName: string,
) {
  return `${artistName} fancam | `;
}

function mergeYouTubeVideos(
  existing: YouTubeVideo[],
  incoming: YouTubeVideo[],
) {
  const seen = new Set(
    existing.map(
      (video) => video.id,
    ),
  );

  const merged = [...existing];

  for (const video of incoming) {
    if (seen.has(video.id)) {
      continue;
    }

    seen.add(video.id);
    merged.push(video);
  }

  return merged;
}

const MAX_IMAGE_SIZE = 1800;
const WEBP_QUALITY = 0.82;

function usernameFromCustomUrl(
  customUrl?: string,
) {
  if (!customUrl) {
    return "";
  }

  return customUrl.replace(/^@/, "").trim();
}

function normalizeDraftTags(
  tags: string[] | null | undefined,
) {
  return (tags ?? []).filter(
    (tag): tag is ArtistTag =>
      TAG_OPTIONS.some(
        (option) => option === tag,
      ),
  );
}

function buildArtistProfileDraft(
  channel: YouTubeChannel,
  url: string,
): ArtistProfileDraft {
  return {
    name: channel.title ?? "",
    username:
      extractYouTubeHandle(url) ||
      usernameFromCustomUrl(
        channel.customUrl,
      ),
    category: "music",
    tags: ["K-pop"],
    youtubeUrl: url.trim(),
    instagramUrl:
      channel.instagramUrl ||
      extractInstagramUrl(
        channel.description ?? "",
      ),
    profileImage: channel.thumbnail ?? "",
    tagline: "",
    bio: "",
    coverImageUrl: "",
  };
}

function mergeDraftWithExisting(
  draft: ArtistProfileDraft,
  existing: ExistingCreator,
): ArtistProfileDraft {
  const existingTags =
    normalizeDraftTags(existing.tags);

  return {
    name:
      existing.name?.trim() ||
      draft.name,
    username:
      existing.username?.trim() ||
      draft.username,
    category:
      existing.category?.trim() ||
      draft.category,
    tags:
      existingTags.length > 0
        ? existingTags
        : draft.tags,
    youtubeUrl:
      draft.youtubeUrl ||
      existing.youtube_url ||
      "",
    instagramUrl:
      existing.instagram_url?.trim() ||
      draft.instagramUrl,
    profileImage:
      draft.profileImage ||
      existing.profile_image ||
      "",
    tagline:
      existing.tagline?.trim() ||
      draft.tagline,
    bio:
      existing.bio?.trim() ||
      draft.bio,
    coverImageUrl:
      existing.cover_image?.trim() ||
      draft.coverImageUrl,
  };
}

export default function AdminImportPage() {
  const supabase =
    useMemo(
      () => createClient(),
      [],
    );

  /*
    Channel
  */
  const [
    channelUrl,
    setChannelUrl,
  ] = useState("");

  const [
    channel,
    setChannel,
  ] =
    useState<YouTubeChannel | null>(
      null,
    );

  const [
    shorts,
    setShorts,
  ] =
    useState<YouTubeVideo[]>(
      [],
    );

  const [
    videos,
    setVideos,
  ] =
    useState<YouTubeVideo[]>(
      [],
    );

  /*
    Additional
  */
  const [
    additionalUrl,
    setAdditionalUrl,
  ] = useState("");

  const [
    additionalWorks,
    setAdditionalWorks,
  ] =
    useState<YouTubeVideo[]>(
      [],
    );

  /*
    Fancams
  */
  const [
    fancamWorks,
    setFancamWorks,
  ] =
    useState<YouTubeVideo[]>(
      [],
    );

  const [
    loadingFancams,
    setLoadingFancams,
  ] =
    useState(false);

  const [
    channelNextPageToken,
    setChannelNextPageToken,
  ] = useState<string | null>(
    null,
  );

  const [
    loadingOlderShorts,
    setLoadingOlderShorts,
  ] = useState(false);

  const [
    fancamNextPageToken,
    setFancamNextPageToken,
  ] = useState<string | null>(
    null,
  );

  const [
    loadingOlderFancams,
    setLoadingOlderFancams,
  ] = useState(false);

  const [
    youtubeVideoSort,
    setYoutubeVideoSort,
  ] =
    useState<YouTubeVideoSort>(
      "views",
    );

  const [
    workAnalyses,
    setWorkAnalyses,
  ] = useState<
    Record<string, WorkAnalysis>
  >({});

  const [
    analyzingWorks,
    setAnalyzingWorks,
  ] = useState(false);

  const [
    aiAssistEnabled,
    setAiAssistEnabled,
  ] = useState(false);

  const [
    artistProfileDraft,
    setArtistProfileDraft,
  ] =
    useState<ArtistProfileDraft | null>(
      null,
    );

  const [
    existingArtist,
    setExistingArtist,
  ] =
    useState<ExistingCreator | null>(
      null,
    );

  const [
    generatingProfile,
    setGeneratingProfile,
  ] = useState(false);

  const [
    profileResearchSources,
    setProfileResearchSources,
  ] = useState<ResearchSource[]>([]);

  const [
    creatingOnboarding,
    setCreatingOnboarding,
  ] = useState(false);

  const [
    onboardingResult,
    setOnboardingResult,
  ] = useState<{
    artistId: string;
    artistName: string;
    importedCount: number;
    featuredCount: number;
    artistCreated: boolean;
    importFailed: boolean;
  } | null>(null);

  const [
    fancamKeyword,
    setFancamKeyword,
  ] = useState("");

  const [
    excludeBroadcast,
    setExcludeBroadcast,
  ] = useState(true);

  const previousFancamArtistIdRef =
    useRef("");

  /*
    Images
  */
  const [
    imageDrafts,
    setImageDrafts,
  ] =
    useState<ImageDraft[]>(
      [],
    );

  const [
    selectedImageIds,
    setSelectedImageIds,
  ] =
    useState<Set<string>>(
      new Set(),
    );

  /*
  External Images
*/

const [
  externalImageUrl,
  setExternalImageUrl,
] = useState("");

const [
  externalSourceUrl,
  setExternalSourceUrl,
] = useState("");

const [
  externalCaption,
  setExternalCaption,
] = useState("");

const [
  externalPublishedAt,
  setExternalPublishedAt,
] = useState(
  new Date()
    .toISOString()
    .slice(0, 10),
);

const [
  externalImageDrafts,
  setExternalImageDrafts,
] =
  useState<
    ExternalImageDraft[]
  >([]);

  /*
    Tabs
  */
  const [
    activeTab,
    setActiveTab,
  ] =
    useState<TabType>(
      "shorts",
    );

  /*
    Video selection
  */
  const [
    selectedVideoIds,
    setSelectedVideoIds,
  ] =
    useState<Set<string>>(
      new Set(),
    );

  const [
    featuredVideoIds,
    setFeaturedVideoIds,
  ] =
    useState<Set<string>>(
      new Set(),
    );

  const [
    previewVideo,
    setPreviewVideo,
  ] = useState<{
    videoId: string;
    title: string;
  } | null>(null);

  /*
    Artist
  */
  const [
    artists,
    setArtists,
  ] =
    useState<Artist[]>(
      [],
    );

  const [
    selectedArtistId,
    setSelectedArtistId,
  ] = useState("");

  const [
    showCreateArtist,
    setShowCreateArtist,
  ] =
    useState(false);

  const [
    newArtist,
    setNewArtist,
  ] =
    useState<NewArtistForm>({
      name: "",
      username: "",
      category:
        "music",
    });

  /*
    Loading
  */
  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    loadingAdditional,
    setLoadingAdditional,
  ] =
    useState(false);

  const [
    preparingImages,
    setPreparingImages,
  ] =
    useState(false);

  const [
    creatingArtist,
    setCreatingArtist,
  ] =
    useState(false);

  const [
    importingWorks,
    setImportingWorks,
  ] =
    useState(false);

  /*
    Messages
  */
  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  /*
    Artists
  */
  useEffect(() => {
    async function loadArtists() {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "creators",
          )
          .select(
            "id, name, username",
          )
          .order(
            "name",
            {
              ascending:
                true,
            },
          );

      if (error) {
        console.error(
          "Failed to load artists:",
          error,
        );

        return;
      }

      setArtists(
        data ?? [],
      );
    }

    loadArtists();
  }, [supabase]);

  /*
    Fancam keyword
  */
  useEffect(() => {
    if (!selectedArtistId) {
      return;
    }

    if (
      selectedArtistId ===
      previousFancamArtistIdRef.current
    ) {
      return;
    }

    const artist = artists.find(
      (item) =>
        item.id ===
        selectedArtistId,
    );

    if (!artist) {
      return;
    }

    previousFancamArtistIdRef.current =
      selectedArtistId;

    setFancamKeyword(
      buildDefaultFancamKeyword(
        artist.name,
      ),
    );
  }, [
    selectedArtistId,
    artists,
  ]);

  async function lookupArtistByUsername(
    username: string,
  ) {
    const trimmed = username.trim();

    if (!trimmed) {
      return null;
    }

    try {
      const response = await fetch(
        `/api/admin/artists?username=${encodeURIComponent(
          trimmed,
        )}`,
      );

      const data = await response.json();

      if (!response.ok) {
        return null;
      }

      return (data.artist ??
        null) as ExistingCreator | null;
    } catch {
      return null;
    }
  }

  async function resolveExistingArtist(
    username: string,
    mergeIntoDraft: boolean,
  ) {
    const existing =
      await lookupArtistByUsername(
        username,
      );

    setExistingArtist(existing);

    if (existing) {
      setSelectedArtistId(existing.id);

      if (mergeIntoDraft) {
        setArtistProfileDraft(
          (current) =>
            current
              ? mergeDraftWithExisting(
                  current,
                  existing,
                )
              : current,
        );
      } else {
        setArtistProfileDraft(
          (current) =>
            current
              ? {
                  ...current,
                  username:
                    existing.username?.trim() ||
                    current.username,
                }
              : current,
        );
      }
    }

    return existing;
  }

  /*
    Channel
  */
  async function loadVideos() {
    if (
      !channelUrl.trim()
    ) {
      setError(
        "YouTube channel URL을 입력해주세요.",
      );

      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    setChannel(null);
    setShorts([]);
    setVideos([]);
    setChannelNextPageToken(null);
    setArtistProfileDraft(null);
    setExistingArtist(null);
    setProfileResearchSources([]);
    setOnboardingResult(null);

    try {
      const response =
        await fetch(
          `/api/youtube/channel?url=${encodeURIComponent(
            channelUrl,
          )}`,
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "YouTube 영상을 불러오지 못했습니다.",
        );
      }

     setChannel(
  data.channel,
);

/*
  YouTube 채널 정보를
  Artist 생성 폼에 자동 입력
*/
setNewArtist({
  name:
    data.channel?.title ??
    "",

  username:
    extractYouTubeHandle(
      channelUrl,
    ),

  category: "music",
});

if (data.channel) {
  const draft =
    buildArtistProfileDraft(
      data.channel,
      channelUrl,
    );

  const existing =
    await lookupArtistByUsername(
      draft.username,
    );

  if (existing) {
    const merged =
      mergeDraftWithExisting(
        draft,
        existing,
      );

    setExistingArtist(existing);
    setArtistProfileDraft(merged);
    setSelectedArtistId(existing.id);
  } else {
    setExistingArtist(null);
    setArtistProfileDraft(draft);
  }
}

setShorts(
  data.shorts ?? [],
);

      setVideos(
        data.videos ?? [],
      );

      setChannelNextPageToken(
        data.nextPageToken ?? null,
      );

      setActiveTab(
        "shorts",
      );

      setMessage(
        "YouTube 채널을 불러왔습니다.",
      );
    } catch (error) {
      if (
        error instanceof Error
      ) {
        setError(
          error.message,
        );
      } else {
        setError(
          "YouTube 영상을 불러오지 못했습니다.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadOlderShorts() {
    if (
      !channelUrl.trim() ||
      !channelNextPageToken
    ) {
      return;
    }

    setLoadingOlderShorts(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/youtube/channel?url=${encodeURIComponent(
            channelUrl,
          )}&pageToken=${encodeURIComponent(
            channelNextPageToken,
          )}`,
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "YouTube Shorts를 추가로 불러오지 못했습니다.",
        );
      }

      const incomingShorts =
        (data.shorts ??
          []) as YouTubeVideo[];

      const incomingVideos =
        (data.videos ??
          []) as YouTubeVideo[];

      setShorts((current) =>
        mergeYouTubeVideos(
          current,
          incomingShorts,
        ),
      );

      setVideos((current) =>
        mergeYouTubeVideos(
          current,
          incomingVideos,
        ),
      );

      setChannelNextPageToken(
        data.nextPageToken ?? null,
      );

      setMessage(
        `${incomingShorts.length + incomingVideos.length}개의 추가 영상을 불러왔습니다.`,
      );
    } catch (error) {
      if (
        error instanceof Error
      ) {
        setError(
          error.message,
        );
      } else {
        setError(
          "YouTube Shorts를 추가로 불러오지 못했습니다.",
        );
      }
    } finally {
      setLoadingOlderShorts(
        false,
      );
    }
  }

  /*
    Additional
  */
  async function loadAdditional() {
    if (
      !additionalUrl.trim()
    ) {
      setError(
        "YouTube Video 또는 Playlist URL을 입력해주세요.",
      );

      return;
    }

    setLoadingAdditional(
      true,
    );

    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          `/api/youtube/additional?url=${encodeURIComponent(
            additionalUrl,
          )}`,
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "추가 영상을 불러오지 못했습니다.",
        );
      }

      const loaded =
        (data.works ??
          []) as YouTubeVideo[];

      setAdditionalWorks(
        (current) => {
          const map =
            new Map<
              string,
              YouTubeVideo
            >();

          for (
            const video of current
          ) {
            map.set(
              video.id,
              video,
            );
          }

          for (
            const video of loaded
          ) {
            map.set(
              video.id,
              video,
            );
          }

          return Array.from(
            map.values(),
          );
        },
      );

      setAdditionalUrl(
        "",
      );

      setActiveTab(
        "additional",
      );

      setMessage(
        `${loaded.length}개의 Additional Work를 불러왔습니다.`,
      );
    } catch (error) {
      if (
        error instanceof Error
      ) {
        setError(
          error.message,
        );
      } else {
        setError(
          "추가 영상을 불러오지 못했습니다.",
        );
      }
    } finally {
      setLoadingAdditional(
        false,
      );
    }
  }

  /*
    Fancams
  */
  async function loadFancams() {
    if (!selectedArtistId) {
      setError(
        "Artist를 선택해주세요.",
      );

      return;
    }

    const keyword =
      fancamKeyword.trim();

    if (!keyword) {
      setError(
        "검색어를 입력해주세요.",
      );

      return;
    }

    setLoadingFancams(true);
    setError("");
    setMessage("");
    setFancamNextPageToken(null);

    try {
      const response =
        await fetch(
          `/api/youtube/search?artistId=${encodeURIComponent(
            selectedArtistId,
          )}&q=${encodeURIComponent(
            keyword,
          )}&excludeBroadcast=${excludeBroadcast}`,
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Fancam 검색에 실패했습니다.",
        );
      }

      const loaded =
        (data.works ??
          []) as YouTubeVideo[];

      setFancamWorks(loaded);
      setFancamNextPageToken(
        data.nextPageToken ?? null,
      );
      setActiveTab("fancams");

      setMessage(
        `${loaded.length}개의 Fancam 후보를 불러왔습니다.`,
      );
    } catch (error) {
      if (
        error instanceof Error
      ) {
        setError(
          error.message,
        );
      } else {
        setError(
          "Fancam 검색에 실패했습니다.",
        );
      }
    } finally {
      setLoadingFancams(false);
    }
  }

  async function loadOlderFancams() {
    if (
      !selectedArtistId ||
      !fancamKeyword.trim() ||
      !fancamNextPageToken
    ) {
      return;
    }

    setLoadingOlderFancams(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/youtube/search?artistId=${encodeURIComponent(
            selectedArtistId,
          )}&q=${encodeURIComponent(
            fancamKeyword.trim(),
          )}&excludeBroadcast=${excludeBroadcast}&pageToken=${encodeURIComponent(
            fancamNextPageToken,
          )}`,
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Fancam을 추가로 불러오지 못했습니다.",
        );
      }

      const loaded =
        (data.works ??
          []) as YouTubeVideo[];

      setFancamWorks((current) =>
        mergeYouTubeVideos(
          current,
          loaded,
        ),
      );

      setFancamNextPageToken(
        data.nextPageToken ?? null,
      );

      setMessage(
        `${loaded.length}개의 추가 Fancam 후보를 불러왔습니다.`,
      );
    } catch (error) {
      if (
        error instanceof Error
      ) {
        setError(
          error.message,
        );
      } else {
        setError(
          "Fancam을 추가로 불러오지 못했습니다.",
        );
      }
    } finally {
      setLoadingOlderFancams(
        false,
      );
    }
  }

  /*
    Images
  */
  async function handleImageFiles(
    files: FileList | null,
  ) {
    if (
      !files ||
      files.length === 0
    ) {
      return;
    }

    setPreparingImages(
      true,
    );

    setError("");
    setMessage("");

    try {
      const nextDrafts: ImageDraft[] =
        [];

      for (
        const originalFile of
          Array.from(files)
      ) {
        if (
          !originalFile.type.startsWith(
            "image/",
          )
        ) {
          continue;
        }

        const convertedFile =
          await convertImageToWebP(
            originalFile,
          );

        const id =
          crypto.randomUUID();

        nextDrafts.push({
          id,

          file:
            convertedFile,

          previewUrl:
            URL.createObjectURL(
              convertedFile,
            ),

          caption: "",

          sourceUrl: "",

          publishedAt:
            new Date()
              .toISOString()
              .slice(
                0,
                10,
              ),
        });
      }

      setImageDrafts(
        (current) => [
          ...current,
          ...nextDrafts,
        ],
      );

      setSelectedImageIds(
        (current) => {
          const next =
            new Set(
              current,
            );

          for (
            const draft of
              nextDrafts
          ) {
            next.add(
              draft.id,
            );
          }

          return next;
        },
      );

      setActiveTab(
        "images",
      );

      setMessage(
        `${nextDrafts.length}개의 이미지를 준비했습니다.`,
      );
    } catch (error) {
      console.error(
        error,
      );

      setError(
        "이미지 처리 중 오류가 발생했습니다.",
      );
    } finally {
      setPreparingImages(
        false,
      );
    }
  }

  function updateImageDraft(
    id: string,
    patch: Partial<ImageDraft>,
  ) {
    setImageDrafts(
      (current) =>
        current.map(
          (item) =>
            item.id === id
              ? {
                  ...item,
                  ...patch,
                }
              : item,
        ),
    );
  }

  function removeImageDraft(
    draft: ImageDraft,
  ) {
    URL.revokeObjectURL(
      draft.previewUrl,
    );

    setImageDrafts(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            draft.id,
        ),
    );

    setSelectedImageIds(
      (current) => {
        const next =
          new Set(
            current,
          );

        next.delete(
          draft.id,
        );

        return next;
      },
    );
  }

  function toggleImage(
    id: string,
  ) {
    setSelectedImageIds(
      (current) => {
        const next =
          new Set(
            current,
          );

        if (
          next.has(id)
        ) {
          next.delete(
            id,
          );
        } else {
          next.add(
            id,
          );
        }

        return next;
      },
    );
  }
/*
  External Images
*/
function addExternalImage() {
  const imageUrl =
    externalImageUrl.trim();

  const sourceUrl =
    externalSourceUrl.trim();

  const caption =
    externalCaption.trim();

  if (!imageUrl) {
    setError(
      "Image URL을 입력해주세요.",
    );

    return;
  }

  try {
    const parsed =
      new URL(imageUrl);

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      throw new Error();
    }
  } catch {
    setError(
      "올바른 Image URL을 입력해주세요.",
    );

    return;
  }

  /*
    현재 Importer 내부 중복 방지
  */
  const alreadyExists =
    externalImageDrafts.some(
      (draft) =>
        draft.imageUrl ===
        imageUrl,
    );

  if (alreadyExists) {
    setError(
      "이미 추가된 이미지입니다.",
    );

    return;
  }

  const draft: ExternalImageDraft = {
    id:
      crypto.randomUUID(),

    imageUrl,

    sourceUrl,

    caption,

    publishedAt:
      externalPublishedAt,
  };

  setExternalImageDrafts(
    (current) => [
      ...current,
      draft,
    ],
  );

  setExternalImageUrl("");
  setExternalSourceUrl("");
  setExternalCaption("");

  setActiveTab(
    "images",
  );

  setError("");

  setMessage(
    "External Image를 추가했습니다.",
  );
}

function updateExternalImageDraft(
  id: string,
  patch: Partial<ExternalImageDraft>,
) {
  setExternalImageDrafts(
    (current) =>
      current.map(
        (draft) =>
          draft.id === id
            ? {
                ...draft,
                ...patch,
              }
            : draft,
      ),
  );
}

function removeExternalImageDraft(
  id: string,
) {
  setExternalImageDrafts(
    (current) =>
      current.filter(
        (draft) =>
          draft.id !== id,
      ),
  );
}
  /*
    Video selection
  */
  function toggleVideo(
    videoId: string,
  ) {
    setSelectedVideoIds(
      (current) => {
        const next =
          new Set(
            current,
          );

        if (
          next.has(
            videoId,
          )
        ) {
          next.delete(
            videoId,
          );

          setFeaturedVideoIds(
            (featured) => {
              if (
                !featured.has(
                  videoId,
                )
              ) {
                return featured;
              }

              const nextFeatured =
                new Set(
                  featured,
                );

              nextFeatured.delete(
                videoId,
              );

              return nextFeatured;
            },
          );
        } else {
          next.add(
            videoId,
          );
        }

        return next;
      },
    );
  }

  function toggleFeatured(
    videoId: string,
    event: React.MouseEvent,
  ) {
    event.stopPropagation();

    setFeaturedVideoIds(
      (current) => {
        const next =
          new Set(
            current,
          );

        if (
          next.has(
            videoId,
          )
        ) {
          next.delete(
            videoId,
          );
        } else {
          next.add(
            videoId,
          );

          setSelectedVideoIds(
            (selected) => {
              if (
                selected.has(
                  videoId,
                )
              ) {
                return selected;
              }

              const nextSelected =
                new Set(
                  selected,
                );

              nextSelected.add(
                videoId,
              );

              return nextSelected;
            },
          );
        }

        return next;
      },
    );
  }

  function clearSelection() {
    setSelectedVideoIds(
      new Set(),
    );

    setFeaturedVideoIds(
      new Set(),
    );

    setSelectedImageIds(
      new Set(),
    );
  }

  function buildAnalysisCandidate(
    video: YouTubeVideo,
    sourceTab: WorkSourceTab,
    artistName: string,
  ) {
    return {
      id: video.id,
      title: video.title,
      ...(video.description
        ? {
            description:
              video.description,
          }
        : {}),
      ...(video.duration
        ? { duration: video.duration }
        : {}),
      ...(typeof video.durationSeconds ===
      "number"
        ? {
            durationSeconds:
              video.durationSeconds,
          }
        : {}),
      ...(typeof video.viewCount ===
      "number"
        ? { viewCount: video.viewCount }
        : {}),
      ...(typeof video.likeCount ===
      "number"
        ? { likeCount: video.likeCount }
        : {}),
      ...(video.channelTitle
        ? {
            channelTitle:
              video.channelTitle,
          }
        : {}),
      ...(video.publishedAt
        ? {
            publishedAt:
              video.publishedAt,
          }
        : {}),
      sourceTab,
      ...(artistName
        ? { artistName }
        : {}),
    };
  }

  function updateArtistProfileDraft(
    patch: Partial<ArtistProfileDraft>,
  ) {
    setArtistProfileDraft(
      (current) =>
        current
          ? {
              ...current,
              ...patch,
            }
          : current,
    );
  }

  async function generateArtistProfileWithAI() {
    if (
      !aiAssistEnabled ||
      !artistProfileDraft?.name.trim() ||
      generatingProfile
    ) {
      return;
    }

    setGeneratingProfile(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/generate-artist-profile",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            artistName:
              artistProfileDraft.name.trim(),
            ...(channel?.description
              ? {
                  channelDescription:
                    channel.description,
                }
              : {}),
            ...(artistProfileDraft.username.trim()
              ? {
                  youtubeHandle:
                    artistProfileDraft.username.trim(),
                }
              : {}),
            ...(artistProfileDraft.youtubeUrl.trim()
              ? {
                  youtubeUrl:
                    artistProfileDraft.youtubeUrl.trim(),
                }
              : {}),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "AI profile generation failed.",
        );
      }

      const tagline =
        typeof data.result?.tagline ===
        "string"
          ? data.result.tagline
          : "";
      const bio =
        typeof data.result?.bio ===
        "string"
          ? data.result.bio
          : "";

      if (!tagline && !bio) {
        throw new Error(
          "AI profile generation failed.",
        );
      }

      updateArtistProfileDraft({
        ...(tagline ? { tagline } : {}),
        ...(bio ? { bio } : {}),
      });

      const sources = Array.isArray(
        data.result?.researchSummary
          ?.sourcesUsed,
      )
        ? (data.result.researchSummary
            .sourcesUsed as ResearchSource[])
        : [];

      setProfileResearchSources(
        sources.filter(
          (source) =>
            typeof source?.url ===
              "string" &&
            source.url.trim(),
        ),
      );

      setMessage(
        "Artist Tagline과 Bio를 생성했습니다.",
      );
    } catch {
      setError(
        "AI 프로필 생성에 실패했습니다. 직접 입력하거나 다시 시도해주세요.",
      );
    } finally {
      setGeneratingProfile(false);
    }
  }

  async function analyzeCurrentTabWithAI(
    force = false,
  ) {
    if (
      !aiAssistEnabled ||
      activeTab === "images" ||
      analyzingWorks
    ) {
      return;
    }

    const currentWorks =
      activeTab === "shorts"
        ? shorts
        : activeTab === "videos"
          ? videos
          : activeTab === "fancams"
            ? fancamWorks
            : additionalWorks;

    const targets = force
      ? currentWorks
      : currentWorks.filter(
          (video) =>
            !workAnalyses[video.id],
        );

    if (targets.length === 0) {
      setError(
        "분석할 후보가 없습니다.",
      );
      return;
    }

    const artistName =
      artists.find(
        (artist) =>
          artist.id ===
          selectedArtistId,
      )?.name ??
      channel?.title ??
      "";

    setAnalyzingWorks(true);
    setError("");
    setMessage("");

    let successCount = 0;
    let failed = false;

    for (
      let index = 0;
      index < targets.length;
      index += ANALYZE_WORKS_BATCH_SIZE
    ) {
      const batch = targets.slice(
        index,
        index + ANALYZE_WORKS_BATCH_SIZE,
      );

      try {
        const response = await fetch(
          "/api/admin/analyze-works",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              artistName,
              works: batch.map(
                (video) =>
                  buildAnalysisCandidate(
                    video,
                    activeTab,
                    artistName,
                  ),
              ),
            }),
          },
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            typeof data.error ===
              "string"
              ? data.error
              : "AI analysis failed.",
          );
        }

        const results = Array.isArray(
          data.results,
        )
          ? (data.results as WorkAnalysis[])
          : [];

        setWorkAnalyses((current) => {
          const next = { ...current };

          for (const result of results) {
            next[result.id] = result;
          }

          return next;
        });

        successCount += results.length;
      } catch {
        failed = true;
        setError(
          "AI 분석에 실패했습니다. 이미 분석된 결과는 유지됩니다.",
        );
        break;
      }
    }

    if (!failed) {
      setMessage(
        `${successCount}개 영상을 분석했습니다.`,
      );
    }

    setAnalyzingWorks(false);
  }

  function buildSelectedVideoPayload() {
    return selectedVideoWorks.map(
      (video) => ({
        id: video.id,
        title: video.title,
        description: video.description,
        thumbnail: video.thumbnail,
        publishedAt: video.publishedAt,
        url: video.url,
        durationSeconds:
          video.durationSeconds,
        featured: featuredVideoIds.has(
          video.id,
        ),
      }),
    );
  }

  function buildOnboardingArtistPayload() {
    if (!artistProfileDraft) {
      return null;
    }

    return {
      name: artistProfileDraft.name.trim(),
      username:
        artistProfileDraft.username.trim(),
      category:
        artistProfileDraft.category ||
        "music",
      tagline:
        artistProfileDraft.tagline.trim(),
      bio: artistProfileDraft.bio.trim(),
      profileImage:
        artistProfileDraft.profileImage.trim(),
      coverImage:
        artistProfileDraft.coverImageUrl.trim(),
      youtubeUrl:
        artistProfileDraft.youtubeUrl.trim(),
      instagramUrl:
        artistProfileDraft.instagramUrl.trim(),
      tags: artistProfileDraft.tags,
    };
  }

  function toggleDraftTag(
    tag: ArtistTag,
  ) {
    setArtistProfileDraft((current) => {
      if (!current) {
        return current;
      }

      const selected =
        current.tags.includes(tag);

      return {
        ...current,
        tags: selected
          ? current.tags.filter(
              (item) => item !== tag,
            )
          : [...current.tags, tag],
      };
    });
  }

  async function importSelectedForArtist(
    artist: {
      id: string;
      name: string;
    },
    actionLabel: "created" | "updated",
  ) {
    const featuredCount =
      selectedVideoWorks.filter(
        (video) =>
          featuredVideoIds.has(video.id),
      ).length;

    let importedCount = 0;

    if (selectedVideoWorks.length > 0) {
      const importResponse =
        await fetch(
          "/api/admin/import-works",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              artistId: artist.id,
              works:
                buildSelectedVideoPayload(),
            }),
          },
        );

      const importData =
        await importResponse.json();

      if (!importResponse.ok) {
        setOnboardingResult({
          artistId: artist.id,
          artistName: artist.name,
          importedCount: 0,
          featuredCount: 0,
          artistCreated: true,
          importFailed: true,
        });

        setError(
          actionLabel === "created"
            ? "Artist was created, but some works failed to import."
            : "Artist was updated, but some works failed to import.",
        );
        return;
      }

      importedCount =
        importData.importedCount ?? 0;
    }

    setOnboardingResult({
      artistId: artist.id,
      artistName: artist.name,
      importedCount,
      featuredCount,
      artistCreated: true,
      importFailed: false,
    });

    setMessage(
      `${artist.name} ${actionLabel} · Imported ${importedCount} works · Featured ${featuredCount}`,
    );
  }

  async function switchToExistingArtist(
    artist: ExistingCreator,
  ) {
    setExistingArtist(artist);
    setSelectedArtistId(artist.id);
    setArtistProfileDraft((current) =>
      current
        ? mergeDraftWithExisting(
            current,
            artist,
          )
        : current,
    );
    setArtists((current) => {
      if (
        current.some(
          (item) => item.id === artist.id,
        )
      ) {
        return current;
      }

      return [
        ...current,
        {
          id: artist.id,
          name: artist.name,
          username: artist.username,
        },
      ].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    });
  }

  async function createArtistAndImportSelected() {
    if (
      !aiAssistEnabled ||
      !artistProfileDraft ||
      creatingOnboarding ||
      existingArtist
    ) {
      return;
    }

    const payload =
      buildOnboardingArtistPayload();

    if (!payload?.name) {
      setError(
        "Artist name을 입력해주세요.",
      );
      return;
    }

    setCreatingOnboarding(true);
    setError("");
    setMessage("");
    setOnboardingResult(null);

    let createdArtist:
      | Artist
      | null = null;

    try {
      const createResponse =
        await fetch(
          "/api/admin/artists",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(payload),
          },
        );

      const createData =
        await createResponse.json();

      if (
        createResponse.status === 409 ||
        createData.code ===
          "username_taken"
      ) {
        const existing =
          (createData.artist as
            | ExistingCreator
            | null) ??
          (await lookupArtistByUsername(
            payload.username,
          ));

        if (existing) {
          await switchToExistingArtist(
            existing,
          );
        }

        setError(
          "An artist with this username already exists.",
        );
        return;
      }

      if (!createResponse.ok) {
        throw new Error(
          createData.error ||
            "Artist 생성에 실패했습니다.",
        );
      }

      createdArtist =
        createData.artist as Artist;

      setArtists((current) =>
        [...current, createdArtist!].sort(
          (a, b) =>
            a.name.localeCompare(b.name),
        ),
      );

      setSelectedArtistId(
        createdArtist.id,
      );

      await importSelectedForArtist(
        createdArtist,
        "created",
      );
    } catch (error) {
      if (createdArtist) {
        setOnboardingResult({
          artistId: createdArtist.id,
          artistName: createdArtist.name,
          importedCount: 0,
          featuredCount: 0,
          artistCreated: true,
          importFailed: true,
        });

        setError(
          "Artist was created, but some works failed to import.",
        );
      } else if (
        error instanceof Error
      ) {
        setError(error.message);
      } else {
        setError(
          "Artist 생성에 실패했습니다.",
        );
      }
    } finally {
      setCreatingOnboarding(false);
    }
  }

  async function updateArtistAndImportSelected() {
    if (
      !aiAssistEnabled ||
      !artistProfileDraft ||
      !existingArtist ||
      creatingOnboarding
    ) {
      return;
    }

    const payload =
      buildOnboardingArtistPayload();

    if (!payload?.name) {
      setError(
        "Artist name을 입력해주세요.",
      );
      return;
    }

    setCreatingOnboarding(true);
    setError("");
    setMessage("");
    setOnboardingResult(null);

    try {
      const updateResponse =
        await fetch(
          `/api/admin/artists/${existingArtist.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              ...payload,
              isCurated: true,
            }),
          },
        );

      const updateData =
        await updateResponse.json();

      if (!updateResponse.ok) {
        throw new Error(
          updateData.error ||
            "Artist 업데이트에 실패했습니다.",
        );
      }

      const updatedArtist = {
        id: existingArtist.id,
        name:
          (updateData.artist?.name as
            | string
            | undefined) ??
          payload.name,
      };

      setExistingArtist((current) =>
        current
          ? {
              ...current,
              ...updateData.artist,
            }
          : current,
      );

      setSelectedArtistId(
        existingArtist.id,
      );

      await importSelectedForArtist(
        updatedArtist,
        "updated",
      );
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError(
          "Artist 업데이트에 실패했습니다.",
        );
      }
    } finally {
      setCreatingOnboarding(false);
    }
  }

  /*
    Create Artist
  */
  async function createArtist() {
    if (
      !newArtist.name.trim()
    ) {
      setError(
        "Artist name을 입력해주세요.",
      );

      return;
    }

    setCreatingArtist(
      true,
    );

    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/artists",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

           body:
  JSON.stringify(
    {
      name:
        newArtist.name.trim(),

      username:
        newArtist.username.trim(),

      category:
        newArtist.category,

      /*
        YouTube에서 자동 입력
      */
      bio:
        "",

      profileImage:
        channel?.thumbnail ??
        "",

      youtubeUrl:
        channelUrl.trim(),
    },
  ),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Artist 생성에 실패했습니다.",
        );
      }

      const artist =
        data.artist as Artist;

      setArtists(
        (current) =>
          [
            ...current,
            artist,
          ].sort(
            (a, b) =>
              a.name.localeCompare(
                b.name,
              ),
          ),
      );

      setSelectedArtistId(
        artist.id,
      );

      setNewArtist({
        name: "",
        username: "",
        category:
          "music",
      });

      setShowCreateArtist(
        false,
      );

      setMessage(
        `${artist.name} Artist가 생성되었습니다.`,
      );
    } catch (error) {
      if (
        error instanceof Error
      ) {
        setError(
          error.message,
        );
      }
    } finally {
      setCreatingArtist(
        false,
      );
    }
  }

  /*
    Video data
  */
  const sortedShorts =
    useMemo(
      () =>
        sortYouTubeVideos(
          shorts,
          youtubeVideoSort,
          workAnalyses,
        ),
      [
        shorts,
        youtubeVideoSort,
        workAnalyses,
      ],
    );

  const sortedVideos =
    useMemo(
      () =>
        sortYouTubeVideos(
          videos,
          youtubeVideoSort,
          workAnalyses,
        ),
      [
        videos,
        youtubeVideoSort,
        workAnalyses,
      ],
    );

  const sortedFancamWorks =
    useMemo(
      () =>
        sortYouTubeVideos(
          fancamWorks,
          youtubeVideoSort,
          workAnalyses,
        ),
      [
        fancamWorks,
        youtubeVideoSort,
        workAnalyses,
      ],
    );

  const sortedAdditionalWorks =
    useMemo(
      () =>
        sortYouTubeVideos(
          additionalWorks,
          youtubeVideoSort,
          workAnalyses,
        ),
      [
        additionalWorks,
        youtubeVideoSort,
        workAnalyses,
      ],
    );

  const displayedVideos =
    activeTab === "shorts"
      ? sortedShorts
      : activeTab === "videos"
        ? sortedVideos
        : activeTab === "fancams"
          ? sortedFancamWorks
          : activeTab ===
              "additional"
            ? sortedAdditionalWorks
            : [];

  const allVideoWorks =
    Array.from(
      new Map(
        [
          ...shorts,
          ...videos,
          ...fancamWorks,
          ...additionalWorks,
        ].map(
          (video) => [
            video.id,
            video,
          ],
        ),
      ).values(),
    );

  const selectedVideoWorks =
    allVideoWorks.filter(
      (video) =>
        selectedVideoIds.has(
          video.id,
        ),
    );

  const selectedImageDrafts =
    imageDrafts.filter(
      (draft) =>
        selectedImageIds.has(
          draft.id,
        ),
    );

  const selectedCount =
  selectedVideoWorks.length +
  selectedImageDrafts.length +
  externalImageDrafts.length;
  /*
    Import
  */
  async function importSelectedWorks() {
    if (
      !selectedArtistId
    ) {
      setError(
        "Artist를 선택해주세요.",
      );

      return;
    }

    if (
      selectedCount === 0
    ) {
      setError(
        "Import할 Work를 선택해주세요.",
      );

      return;
    }

    setImportingWorks(
      true,
    );

    setError("");
    setMessage("");

    try {
      let videoImported =
        0;

      let imageImported =
        0;
      
      let externalImageImported =
        0;

      /*
        YouTube
      */
      if (
        selectedVideoWorks.length >
        0
      ) {
        const response =
          await fetch(
            "/api/admin/import-works",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    artistId:
                      selectedArtistId,

                    works:
                      buildSelectedVideoPayload(),
                  },
                ),
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Video Import에 실패했습니다.",
          );
        }

        videoImported =
          data.importedCount ??
          0;
      }

      /*
        Images
      */
      if (
        selectedImageDrafts.length >
        0
      ) {
        const formData =
          new FormData();

        formData.append(
          "artistId",
          selectedArtistId,
        );

        formData.append(
          "metadata",
          JSON.stringify(
            selectedImageDrafts.map(
              (draft) => ({
                clientId:
                  draft.id,

                caption:
                  draft.caption,

                sourceUrl:
                  draft.sourceUrl,

                publishedAt:
                  draft.publishedAt,
              }),
            ),
          ),
        );

        for (
          const draft of
            selectedImageDrafts
        ) {
          formData.append(
            "files",
            draft.file,
          );
        }

        const response =
          await fetch(
            "/api/admin/import-images",
            {
              method:
                "POST",

              body:
                formData,
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Image Import에 실패했습니다.",
          );
        }

        imageImported =
          data.importedCount ??
          0;
      }
/*
  External Images
*/
if (
  externalImageDrafts.length >
  0
) {
  const response =
    await fetch(
      "/api/admin/import-external-images",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            artistId:
              selectedArtistId,

            works:
              externalImageDrafts.map(
                (draft) => ({
                  imageUrl:
                    draft.imageUrl,

                  sourceUrl:
                    draft.sourceUrl,

                  caption:
                    draft.caption,

                  publishedAt:
                    draft.publishedAt,
                }),
              ),
          }),
      },
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        "External Image Import에 실패했습니다.",
    );
  }

  externalImageImported =
    data.importedCount ??
    0;
}
      setMessage(
  `Import 완료 · Videos ${videoImported} · Upload Images ${imageImported} · External Images ${externalImageImported}`,
);

      setSelectedVideoIds(
        new Set(),
      );
      setExternalImageDrafts(
  [],
);

      /*
        Import된 이미지 제거
      */
      for (
        const draft of
          selectedImageDrafts
      ) {
        URL.revokeObjectURL(
          draft.previewUrl,
        );
      }

      const importedIds =
        new Set(
          selectedImageDrafts.map(
            (draft) =>
              draft.id,
          ),
        );

      setImageDrafts(
        (current) =>
          current.filter(
            (draft) =>
              !importedIds.has(
                draft.id,
              ),
          ),
      );

      setSelectedImageIds(
        new Set(),
      );
    } catch (error) {
      console.error(
        "IMPORT ERROR:",
        error,
      );

      if (
        error instanceof Error
      ) {
        setError(
          error.message,
        );
      } else {
        setError(
          "Import에 실패했습니다.",
        );
      }
    } finally {
      setImportingWorks(
        false,
      );
    }
  }

  const hasVideoWorks =
    Boolean(channel) ||
    fancamWorks.length > 0 ||
    additionalWorks.length >
      0;

  const hasAnyWorks =
  hasVideoWorks ||
  imageDrafts.length > 0 ||
  externalImageDrafts.length > 0;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      {/* Header */}
      <section className="mb-10">
        <p className="mb-2 text-sm font-medium text-zinc-500">
          Kovemu Admin
        </p>

        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          Work Importer
        </h1>

        <p className="mt-3 text-sm text-zinc-500">
          YouTube 영상과
          이미지 작품을
          Kovemu에
          등록합니다.
        </p>
      </section>

      {/* YouTube */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">
              YouTube Channel
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Shorts와 일반
              영상을 자동으로
              불러옵니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setAiAssistEnabled(
                (current) => !current,
              )
            }
            aria-pressed={aiAssistEnabled}
            className={`self-start rounded-lg px-3 py-1.5 text-sm font-medium ${
              aiAssistEnabled
                ? "bg-zinc-950 text-white"
                : "border border-zinc-200 text-zinc-600"
            }`}
          >
            AI Assist{" "}
            {aiAssistEnabled
              ? "ON"
              : "OFF"}
          </button>
        </div>

        <div className="mt-5 flex gap-3">
          <input
            value={channelUrl}
            onChange={(event) =>
              setChannelUrl(
                event.target.value,
              )
            }
            placeholder="https://youtube.com/@artist"
            className="h-12 flex-1 rounded-xl border border-zinc-200 px-4 text-sm"
          />

          <button
            type="button"
            onClick={loadVideos}
            disabled={loading}
            className="rounded-xl bg-zinc-950 px-6 text-sm font-medium text-white"
          >
            {loading
              ? "Loading..."
              : "Load"}
          </button>
        </div>
      </section>

      {aiAssistEnabled &&
        artistProfileDraft && (
          <section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    existingArtist
                      ? "text-amber-700"
                      : "text-zinc-500"
                  }`}
                >
                  {existingArtist
                    ? "Existing Artist Found"
                    : "New Artist"}
                </p>

                <h2 className="mt-1 text-lg font-semibold text-zinc-950">
                  Artist Profile Draft
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  YouTube 채널에서 채운
                  초안입니다. 직접
                  수정하거나 원할 때만
                  웹 리서치로 Tagline/Bio를
                  생성할 수 있습니다.
                </p>

                {existingArtist && (
                  <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p>
                      {existingArtist.name}
                      {existingArtist.username
                        ? ` · @${existingArtist.username}`
                        : ""}
                    </p>
                    <p className="mt-1 text-xs text-amber-800">
                      Artist ID:{" "}
                      {existingArtist.id}
                    </p>
                    <Link
                      href={`/creator/${existingArtist.id}`}
                      className="mt-2 inline-block text-sm font-medium underline"
                    >
                      View Existing Profile
                    </Link>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={
                  generateArtistProfileWithAI
                }
                disabled={
                  generatingProfile ||
                  !artistProfileDraft.name.trim()
                }
                className="self-start rounded-lg bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {generatingProfile
                  ? "Researching..."
                  : "Research & Generate Profile"}
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">
                  Category
                </span>
                <select
                  value={
                    artistProfileDraft.category
                  }
                  onChange={(event) =>
                    updateArtistProfileDraft(
                      {
                        category:
                          event.target
                            .value,
                      },
                    )
                  }
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm"
                >
                  <option value="music">
                    Music
                  </option>
                  <option value="dance">
                    Dance
                  </option>
                  <option value="art">
                    Art
                  </option>
                  <option value="cosplay">
                    Cosplay
                  </option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">
                  Artist Name
                </span>
                <input
                  value={
                    artistProfileDraft.name
                  }
                  onChange={(event) =>
                    updateArtistProfileDraft(
                      {
                        name: event
                          .target
                          .value,
                      },
                    )
                  }
                  className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">
                  Username
                </span>
                <input
                  value={
                    artistProfileDraft.username
                  }
                  onChange={(event) =>
                    updateArtistProfileDraft(
                      {
                        username:
                          event.target
                            .value,
                      },
                    )
                  }
                  onBlur={() =>
                    void resolveExistingArtist(
                      artistProfileDraft.username,
                      false,
                    )
                  }
                  className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">
                  YouTube URL
                </span>
                <input
                  value={
                    artistProfileDraft.youtubeUrl
                  }
                  onChange={(event) =>
                    updateArtistProfileDraft(
                      {
                        youtubeUrl:
                          event.target
                            .value,
                      },
                    )
                  }
                  className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">
                  Instagram URL
                </span>
                <input
                  value={
                    artistProfileDraft.instagramUrl
                  }
                  onChange={(event) =>
                    updateArtistProfileDraft(
                      {
                        instagramUrl:
                          event.target
                            .value,
                      },
                    )
                  }
                  placeholder="https://instagram.com/artist"
                  className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[auto_1fr]">
              <div>
                <span className="mb-2 block text-sm font-medium text-zinc-700">
                  Profile Image
                </span>
                {artistProfileDraft.profileImage ? (
                  <img
                    src={
                      artistProfileDraft.profileImage
                    }
                    alt=""
                    className="h-20 w-20 rounded-full border border-zinc-200 object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-zinc-200 text-xs text-zinc-400">
                    None
                  </div>
                )}
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">
                  Profile Image URL
                </span>
                <input
                  value={
                    artistProfileDraft.profileImage
                  }
                  onChange={(event) =>
                    updateArtistProfileDraft(
                      {
                        profileImage:
                          event.target
                            .value,
                      },
                    )
                  }
                  className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-medium text-zinc-700">
                Cover Image URL
              </span>
              <input
                value={
                  artistProfileDraft.coverImageUrl
                }
                onChange={(event) =>
                  updateArtistProfileDraft(
                    {
                      coverImageUrl:
                        event.target
                          .value,
                    },
                  )
                }
                placeholder="직접 입력"
                className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm"
              />
            </label>

            <div className="mt-5">
              <span className="mb-3 block text-sm font-medium text-zinc-700">
                Tags
              </span>

              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map(
                  (tag) => {
                    const selected =
                      artistProfileDraft.tags.includes(
                        tag,
                      );

                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          toggleDraftTag(
                            tag,
                          )
                        }
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          selected
                            ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700"
                            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                        }`}
                      >
                        {selected
                          ? `${tag} ✓`
                          : tag}
                      </button>
                    );
                  },
                )}
              </div>

              <p className="mt-3 text-xs text-zinc-400">
                Multiple tags can be selected.
              </p>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-medium text-zinc-700">
                Tagline
              </span>
              <input
                value={
                  artistProfileDraft.tagline
                }
                onChange={(event) =>
                  updateArtistProfileDraft(
                    {
                      tagline:
                        event.target
                          .value,
                    },
                  )
                }
                placeholder="짧은 영어 한 문장"
                className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm"
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-medium text-zinc-700">
                Bio
              </span>
              <textarea
                value={
                  artistProfileDraft.bio
                }
                onChange={(event) =>
                  updateArtistProfileDraft(
                    {
                      bio: event.target
                        .value,
                    },
                  )
                }
                placeholder="Kovemu Artist Profile용 영어 소개"
                rows={8}
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
              />
            </label>

            {profileResearchSources.length >
              0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-zinc-500">
                  Sources used
                </p>
                <ul className="mt-2 space-y-1">
                  {profileResearchSources.map(
                    (source) => (
                      <li
                        key={
                          source.url
                        }
                        className="truncate text-xs text-zinc-400"
                      >
                        <a
                          href={
                            source.url
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-zinc-700"
                        >
                          {source.title ||
                            source.url}
                        </a>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}

            {onboardingResult && (
              <div className="mt-4 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                <p>
                  {onboardingResult.artistName}{" "}
                  · Imported{" "}
                  {
                    onboardingResult.importedCount
                  }{" "}
                  works · Featured{" "}
                  {
                    onboardingResult.featuredCount
                  }
                </p>
                <Link
                  href={`/creator/${onboardingResult.artistId}`}
                  className="mt-2 inline-block text-sm font-medium text-zinc-950 underline"
                >
                  View Artist Profile
                </Link>
              </div>
            )}

            <div className="mt-6 flex justify-end border-t border-zinc-200 pt-5">
              {existingArtist ? (
                <button
                  type="button"
                  onClick={
                    updateArtistAndImportSelected
                  }
                  disabled={
                    creatingOnboarding ||
                    !artistProfileDraft.name.trim()
                  }
                  className="rounded-xl bg-zinc-950 px-6 py-3 text-sm font-medium text-white disabled:opacity-40"
                >
                  {creatingOnboarding
                    ? "Updating..."
                    : "Update Artist & Import Selected"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={
                    createArtistAndImportSelected
                  }
                  disabled={
                    creatingOnboarding ||
                    !artistProfileDraft.name.trim()
                  }
                  className="rounded-xl bg-zinc-950 px-6 py-3 text-sm font-medium text-white disabled:opacity-40"
                >
                  {creatingOnboarding
                    ? "Creating..."
                    : "Create Artist & Import Selected"}
                </button>
              )}
            </div>
          </section>
        )}

      {/* Fancam Search */}
      <section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-950">
          Fancam Search
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          Artist와 검색어를 설정한 뒤
          YouTube 전체에서 fancam /
          직캠 영상을 검색합니다.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Artist
            </label>

            <select
              value={
                selectedArtistId
              }
              onChange={(event) =>
                setSelectedArtistId(
                  event.target.value,
                )
              }
              className="h-12 w-full rounded-xl border border-zinc-200 px-4 text-sm"
            >
              <option value="">
                Select artist
              </option>

              {artists.map(
                (artist) => (
                  <option
                    key={
                      artist.id
                    }
                    value={
                      artist.id
                    }
                  >
                    {artist.name}
                    {artist.username
                      ? ` (@${artist.username})`
                      : ""}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Keyword
            </label>

            <input
              value={
                fancamKeyword
              }
              onChange={(event) =>
                setFancamKeyword(
                  event.target.value,
                )
              }
              placeholder="Artist name fancam | "
              className="h-12 w-full rounded-xl border border-zinc-200 px-4 text-sm"
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-zinc-700">
              Options
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setExcludeBroadcast(
                    (current) =>
                      !current,
                  )
                }
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  excludeBroadcast
                    ? "bg-zinc-950 text-white"
                    : "border border-zinc-200 text-zinc-600"
                }`}
              >
                {excludeBroadcast
                  ? "방송국 비노출"
                  : "방송국 노출"}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={
                loadFancams
              }
              disabled={
                loadingFancams ||
                !selectedArtistId ||
                !fancamKeyword.trim()
              }
              className="h-12 rounded-xl bg-zinc-950 px-6 text-sm font-medium text-white disabled:opacity-40"
            >
              {loadingFancams
                ? "Searching..."
                : "Search Fancams"}
            </button>
          </div>
        </div>
      </section>

      {/* Additional */}
      <section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-950">
          Additional Video /
          Playlist
        </h2>

        <div className="mt-5 flex gap-3">
          <input
            value={
              additionalUrl
            }
            onChange={(event) =>
              setAdditionalUrl(
                event.target.value,
              )
            }
            placeholder="YouTube Video or Playlist URL"
            className="h-12 flex-1 rounded-xl border border-zinc-200 px-4 text-sm"
          />

          <button
            type="button"
            onClick={
              loadAdditional
            }
            disabled={
              loadingAdditional
            }
            className="rounded-xl border border-zinc-950 px-6 text-sm font-medium"
          >
            {loadingAdditional
              ? "Loading..."
              : "Load"}
          </button>
        </div>
      </section>

      {/* Image Upload */}
      <section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-950">
          Image Upload
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          Art, Cosplay 등의
          이미지 작품을
          여러 장 선택할 수
          있습니다.
        </p>

        <label className="mt-5 flex min-h-[120px] cursor-pointer items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 transition hover:border-zinc-400 hover:bg-zinc-100">
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-800">
              Select images
            </p>

            <p className="mt-1 text-xs text-zinc-400">
              JPG / PNG /
              WebP
            </p>

            {preparingImages && (
              <p className="mt-2 text-xs text-fuchsia-600">
                Optimizing...
              </p>
            )}
          </div>

          <input
            type="file"
            accept="image/*"
            multiple
            disabled={
              preparingImages
            }
            onChange={(event) => {
              handleImageFiles(
                event.target.files,
              );

              event.target.value =
                "";
            }}
            className="hidden"
          />
        </label>
        <div className="my-6 flex items-center gap-4">
  <div className="h-px flex-1 bg-zinc-200" />

  <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
    or
  </span>

  <div className="h-px flex-1 bg-zinc-200" />
</div>

<div>
  <h3 className="text-sm font-semibold text-zinc-950">
    External Image URL
  </h3>

  <p className="mt-1 text-xs leading-5 text-zinc-500">
    X, Tumblr, 개인 사이트 등의
    직접 이미지 주소를 사용합니다.
    이미지 파일은 Kovemu Storage에
    저장하지 않습니다.
  </p>

  <div className="mt-4 grid gap-3">
    <input
      type="url"
      value={
        externalImageUrl
      }
      onChange={(event) =>
        setExternalImageUrl(
          event.target.value,
        )
      }
      placeholder="Direct Image URL"
      className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm"
    />

    <input
      type="url"
      value={
        externalSourceUrl
      }
      onChange={(event) =>
        setExternalSourceUrl(
          event.target.value,
        )
      }
      placeholder="Source Post URL (optional)"
      className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm"
    />

    <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
      <input
        value={
          externalCaption
        }
        onChange={(event) =>
          setExternalCaption(
            event.target.value,
          )
        }
        placeholder="Caption (optional)"
        className="h-11 rounded-xl border border-zinc-200 px-4 text-sm"
      />

      <input
        type="date"
        value={
          externalPublishedAt
        }
        onChange={(event) =>
          setExternalPublishedAt(
            event.target.value,
          )
        }
        className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
      />

      <button
        type="button"
        onClick={
          addExternalImage
        }
        className="h-11 rounded-xl bg-zinc-950 px-5 text-sm font-medium text-white"
      >
        Add Image
      </button>
    </div>
  </div>
</div>
      </section>

      {/* Messages */}
      {error && (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {message && (
        <p className="mt-5 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </p>
      )}

      {/* Tabs */}
      {hasAnyWorks && (
        <section className="mt-8">
          <div className="flex items-end justify-between border-b border-zinc-200">
            <div className="flex overflow-x-auto">
              {[
                [
                  "shorts",
                  `Shorts (${shorts.length})`,
                ],
                [
                  "videos",
                  `Videos (${videos.length})`,
                ],
                [
                  "fancams",
                  `Fancams (${fancamWorks.length})`,
                ],
                [
                  "additional",
                  `Additional (${additionalWorks.length})`,
                ],
                [
                
  "images",
  `Images (${
    imageDrafts.length +
    externalImageDrafts.length
  })`,
],
              ].map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        value as TabType,
                      )
                    }
                    className={`shrink-0 border-b-2 px-4 pb-3 text-sm font-medium ${
                      activeTab ===
                      value
                        ? "border-zinc-950 text-zinc-950"
                        : "border-transparent text-zinc-400"
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>

            {selectedCount >
              0 && (
              <div className="flex items-center gap-4 pb-3">
                <span className="text-sm">
                  {selectedCount}{" "}
                  selected
                </span>

                <button
                  type="button"
                  onClick={
                    clearSelection
                  }
                  className="text-sm text-zinc-400"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Images */}
      {activeTab ===
  "images" &&
  (
    imageDrafts.length > 0 ||
    externalImageDrafts.length > 0
  ) && (
          <section className="mt-6">
            <h2 className="text-xl font-semibold">
              Images
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {imageDrafts.map(
                
                (draft) => {
                  const selected =
                    selectedImageIds.has(
                      draft.id,
                    );

                  return (
                    <article
                      key={
                        draft.id
                      }
                      className={`overflow-hidden rounded-2xl border bg-white ${
                        selected
                          ? "border-zinc-950 ring-2 ring-zinc-950"
                          : "border-zinc-200"
                      }`}
                    >
                      <div
                        className="relative cursor-pointer bg-zinc-100"
                        onClick={() =>
                          toggleImage(
                            draft.id,
                          )
                        }
                      >
                        <img
                          src={
                            draft.previewUrl
                          }
                          alt=""
                          className="max-h-[420px] w-full object-contain"
                        />

                        <div className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold">
                          {selected
                            ? "✓"
                            : ""}
                        </div>

                        <button
                          type="button"
                          onClick={(
                            event,
                          ) => {
                            event.stopPropagation();

                            removeImageDraft(
                              draft,
                            );
                          }}
                          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>

                      <div className="space-y-3 p-4">
                        <input
                          value={
                            draft.caption
                          }
                          onChange={(
                            event,
                          ) =>
                            updateImageDraft(
                              draft.id,
                              {
                                caption:
                                  event
                                    .target
                                    .value,
                              },
                            )
                          }
                          placeholder="Caption"
                          className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                        />

                        <input
                          value={
                            draft.sourceUrl
                          }
                          onChange={(
                            event,
                          ) =>
                            updateImageDraft(
                              draft.id,
                              {
                                sourceUrl:
                                  event
                                    .target
                                    .value,
                              },
                            )
                          }
                          placeholder="Source URL (Instagram, X, website...)"
                          className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                        />

                        <input
                          type="date"
                          value={
                            draft.publishedAt
                          }
                          onChange={(
                            event,
                          ) =>
                            updateImageDraft(
                              draft.id,
                              {
                                publishedAt:
                                  event
                                    .target
                                    .value,
                              },
                            )
                          }
                          className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                        />

                        <p className="text-xs text-zinc-400">
                          {Math.round(
                            draft.file
                              .size /
                              1024,
                          )}{" "}
                          KB · WebP
                        </p>
                      </div>
                    </article>
                  );
                },
              )
            }{externalImageDrafts.map(
  (draft) => (
    <article
      key={draft.id}
      className="overflow-hidden rounded-2xl border border-fuchsia-200 bg-white ring-1 ring-fuchsia-100"
    >
      <div className="relative bg-zinc-100">
        <img
          src={
            draft.imageUrl
          }
          alt={
            draft.caption ||
            "External image"
          }
          className="max-h-[420px] w-full object-contain"
        />

        <span className="absolute left-3 top-3 rounded-full bg-fuchsia-600 px-2.5 py-1 text-[11px] font-semibold text-white">
          External
        </span>

        <button
          type="button"
          onClick={() =>
            removeExternalImageDraft(
              draft.id,
            )
          }
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600"
        >
          ×
        </button>
      </div>

      <div className="space-y-3 p-4">
        <input
          value={
            draft.caption
          }
          onChange={(
            event,
          ) =>
            updateExternalImageDraft(
              draft.id,
              {
                caption:
                  event.target
                    .value,
              },
            )
          }
          placeholder="Caption"
          className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
        />

        <input
          value={
            draft.sourceUrl
          }
          onChange={(
            event,
          ) =>
            updateExternalImageDraft(
              draft.id,
              {
                sourceUrl:
                  event.target
                    .value,
              },
            )
          }
          placeholder="Source URL"
          className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
        />

        <input
          type="date"
          value={
            draft.publishedAt
          }
          onChange={(
            event,
          ) =>
            updateExternalImageDraft(
              draft.id,
              {
                publishedAt:
                  event.target
                    .value,
              },
            )
          }
          className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
        />

        <p className="text-xs text-zinc-400">
          External URL ·
          Not stored on Kovemu
        </p>
      </div>
    </article>
  ),
)}
            </div>
          </section>
        )}

      {/* Videos */}
      {activeTab !==
        "images" &&
        hasVideoWorks && (
          <section className="mt-6">
            {displayedVideos.length >
              0 && (
                <div className="mb-4 flex flex-col gap-3 border-b border-zinc-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-zinc-950">
                    {activeTab ===
                    "shorts"
                      ? `Shorts (${shorts.length})`
                      : activeTab ===
                          "videos"
                        ? `Videos (${videos.length})`
                        : activeTab ===
                            "fancams"
                          ? `Fancams (${fancamWorks.length})`
                          : `Additional (${additionalWorks.length})`}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    {aiAssistEnabled && (
                      <button
                        type="button"
                        onClick={() =>
                          analyzeCurrentTabWithAI(
                            displayedVideos.every(
                              (video) =>
                                Boolean(
                                  workAnalyses[
                                    video
                                      .id
                                  ],
                                ),
                            ),
                          )
                        }
                        disabled={
                          analyzingWorks
                        }
                        className="rounded-lg bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                      >
                        {analyzingWorks
                          ? "Analyzing..."
                          : displayedVideos.every(
                                (video) =>
                                  workAnalyses[
                                    video
                                      .id
                                  ],
                              )
                            ? "Re-analyze"
                            : "Analyze with AI"}
                      </button>
                    )}

                    <span className="text-xs font-medium text-zinc-500">
                      Sort
                    </span>

                    {youtubeVideoSortOptions.map(
                      ({
                        value,
                        label,
                      }) => (
                        <button
                          key={
                            value
                          }
                          type="button"
                          onClick={() =>
                            setYoutubeVideoSort(
                              value,
                            )
                          }
                          className={`rounded-lg px-3 py-1.5 text-sm ${
                            youtubeVideoSort ===
                            value
                              ? "bg-zinc-950 text-white"
                              : "border border-zinc-200 text-zinc-600"
                          }`}
                        >
                          {
                            label
                          }
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {displayedVideos.map(
                (video) => {
                  const selected =
                    selectedVideoIds.has(
                      video.id,
                    );
                  const featured =
                    featuredVideoIds.has(
                      video.id,
                    );
                  const analysis =
                    workAnalyses[
                      video.id
                    ];

                  return (
                    <article
                      key={
                        video.id
                      }
                      onClick={() =>
                        toggleVideo(
                          video.id,
                        )
                      }
                      className={`cursor-pointer overflow-hidden rounded-2xl border bg-white ${
                        selected
                          ? "border-zinc-950 ring-2 ring-zinc-950"
                          : "border-zinc-200"
                      }`}
                    >
                      <div className="relative aspect-video">
  <YouTubePreviewThumbnail
    url={video.url}
    title={video.title}
    thumbnail={video.thumbnail}
    onPreview={(
      videoId,
      title,
    ) =>
      setPreviewVideo({
        videoId,
        title,
      })
    }
    className="h-full w-full"
  />

  <div className="absolute left-3 top-3 z-10">
    <button
      type="button"
      onClick={(
        event,
      ) => {
        event.stopPropagation();
        toggleVideo(
          video.id,
        );
      }}
      aria-pressed={
        selected
      }
      aria-label={
        selected
          ? "Deselect work for import"
          : "Select work for import"
      }
      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 ${
        selected
          ? "border-zinc-950 bg-zinc-950 text-white"
          : "border-zinc-300 bg-white text-zinc-950 hover:border-zinc-950 hover:bg-zinc-50"
      }`}
    >
      <Check
        className={`h-5 w-5 ${
          selected
            ? "opacity-100"
            : "opacity-0"
        }`}
        strokeWidth={
          3
        }
        aria-hidden="true"
      />
    </button>
  </div>

  {(video.duration ||
    typeof video.durationSeconds === "number") && (
    <div className="absolute bottom-2 right-2 rounded-md bg-black/80 px-2 py-1 text-xs font-semibold text-white">
     {typeof video.durationSeconds === "number" && (
  <div className="absolute bottom-2 right-2 rounded-md bg-black/80 px-2 py-1 text-xs font-semibold text-white">
    {formatDuration(
      video.durationSeconds,
    )}
  </div>
)}
    </div>
  )}
</div>

                      <div className="p-4">
                        <h3 className="line-clamp-2 text-sm font-medium">
                          {
                            video.title
                          }
                        </h3>

                        {analysis && (
                          <WorkAnalysisBadges
                            analysis={
                              analysis
                            }
                          />
                        )}

                        {video.publishedAt && (
                          <p className="mt-1 text-xs text-zinc-400">
                            {formatPublishedDate(
                              video.publishedAt,
                            )}
                          </p>
                        )}

                        {(video.viewCount !=
                          null ||
                          video.likeCount !=
                            null ||
                          video.channelTitle) && (
                            <p className="mt-1 text-xs text-zinc-400">
                            {formatCount(
                              video.viewCount,
                            )}{" "}
                            views ·{" "}
                            {formatCount(
                              video.likeCount,
                            )}{" "}
                            likes
                            {video.channelTitle
                              ? ` · ${video.channelTitle}`
                              : ""}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={(
                            event,
                          ) =>
                            toggleFeatured(
                              video.id,
                              event,
                            )
                          }
                          aria-pressed={
                            featured
                          }
                          className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 ${
                            featured
                              ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
                              : "bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-100"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                          >
                            {featured
                              ? "★"
                              : "☆"}
                          </span>
                          Featured
                        </button>
                      </div>
                    </article>
                  );
                },
              )}
            </div>

            {activeTab ===
              "shorts" &&
              channelNextPageToken && (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={
                      loadOlderShorts
                    }
                    disabled={
                      loadingOlderShorts
                    }
                    className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {loadingOlderShorts
                      ? "Loading older..."
                      : "Load older"}
                  </button>
                </div>
              )}

            {activeTab ===
              "fancams" &&
              fancamNextPageToken && (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={
                      loadOlderFancams
                    }
                    disabled={
                      loadingOlderFancams
                    }
                    className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {loadingOlderFancams
                      ? "Loading older..."
                      : "Load older"}
                  </button>
                </div>
              )}
          </section>
        )}

      {/* Artist / Import */}
      {selectedCount >
        0 && (
        <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Import to
                Artist
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                {selectedCount}{" "}
                Works selected
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowCreateArtist(
                  (
                    current,
                  ) =>
                    !current,
                )
              }
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm"
            >
              + Create Artist
            </button>
          </div>

          <select
            value={
              selectedArtistId
            }
            onChange={(event) =>
              setSelectedArtistId(
                event.target.value,
              )
            }
            className="mt-6 h-12 w-full rounded-xl border border-zinc-200 px-4"
          >
            <option value="">
              Select artist
            </option>

            {artists.map(
              (artist) => (
                <option
                  key={
                    artist.id
                  }
                  value={
                    artist.id
                  }
                >
                  {artist.name}
                  {artist.username
                    ? ` (@${artist.username})`
                    : ""}
                </option>
              ),
            )}
          </select>

          {showCreateArtist && (
            <div className="mt-5 rounded-xl bg-zinc-50 p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <input
                  value={
                    newArtist.name
                  }
                  onChange={(event) =>
                    setNewArtist(
                      (
                        current,
                      ) => ({
                        ...current,
                        name:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="Artist name"
                  className="h-11 rounded-xl border px-3"
                />

                <input
                  value={
                    newArtist.username
                  }
                  onChange={(event) =>
                    setNewArtist(
                      (
                        current,
                      ) => ({
                        ...current,
                        username:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="Username"
                  className="h-11 rounded-xl border px-3"
                />

                <select
                  value={
                    newArtist.category
                  }
                  onChange={(event) =>
                    setNewArtist(
                      (
                        current,
                      ) => ({
                        ...current,
                        category:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  className="h-11 rounded-xl border px-3"
                >
                  <option value="music">
                    Music
                  </option>
                  <option value="dance">
                    Dance
                  </option>
                  <option value="art">
                    Art
                  </option>
                  <option value="cosplay">
                    Cosplay
                  </option>
                </select>
              </div>

              <button
                type="button"
                onClick={
                  createArtist
                }
                disabled={
                  creatingArtist
                }
                className="mt-4 rounded-xl bg-zinc-950 px-5 py-2.5 text-sm text-white"
              >
                Create Artist
              </button>
            </div>
          )}

          <div className="mt-6 flex justify-end border-t border-zinc-200 pt-6">
            <button
              type="button"
              onClick={
                importSelectedWorks
              }
              disabled={
                !selectedArtistId ||
                importingWorks
              }
              className="rounded-xl bg-zinc-950 px-6 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              {importingWorks
                ? "Importing..."
                : `Import ${selectedCount} Works`}
            </button>
          </div>
        </section>
      )}

      {previewVideo && (
        <YouTubePreviewModal
          videoId={
            previewVideo.videoId
          }
          title={
            previewVideo.title
          }
          onClose={() =>
            setPreviewVideo(null)
          }
        />
      )}
    </main>
  );
}

/*
  Browser-side resize +
  WebP conversion
*/
async function convertImageToWebP(
  file: File,
): Promise<File> {
  const bitmap =
    await createImageBitmap(
      file,
    );
  const ratio =
    Math.min(
      1,
      MAX_IMAGE_SIZE /
        Math.max(
          bitmap.width,
          bitmap.height,
        ),
    );

  const width =
    Math.round(
      bitmap.width *
        ratio,
    );

  const height =
    Math.round(
      bitmap.height *
        ratio,
    );

  const canvas =
    document.createElement(
      "canvas",
    );

  canvas.width =
    width;

  canvas.height =
    height;

  const context =
    canvas.getContext(
      "2d",
    );

  if (!context) {
    bitmap.close();

    throw new Error(
      "Canvas is unavailable.",
    );
  }

  context.drawImage(
    bitmap,
    0,
    0,
    width,
    height,
  );

  bitmap.close();

  const blob =
    await new Promise<Blob>(
      (
        resolve,
        reject,
      ) => {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(
                result,
              );
            } else {
              reject(
                new Error(
                  "Image conversion failed.",
                ),
              );
            }
          },
          "image/webp",
          WEBP_QUALITY,
        );
      },
    );

  const filename =
    file.name.replace(
      /\.[^.]+$/,
      "",
    );

  return new File(
    [blob],
    `${filename}.webp`,
    {
      type:
        "image/webp",
    },
  );
}

const CONTENT_TYPE_LABELS: Record<
  WorkAnalysis["contentType"],
  string
> = {
  live_stage: "LIVE",
  fancam: "FANCAM",
  performance: "PERFORMANCE",
  visual: "VISUAL",
  challenge: "CHALLENGE",
  behind: "BEHIND",
  mv: "MV",
  other: "OTHER",
};

function WorkAnalysisBadges({
  analysis,
}: {
  analysis: WorkAnalysis;
}) {
  const actionClass =
    analysis.action === "keep"
      ? "bg-emerald-50 text-emerald-700"
      : analysis.action === "featured"
        ? "bg-violet-50 text-violet-700"
        : analysis.action === "reject"
          ? "bg-red-50 text-red-700"
          : "bg-amber-50 text-amber-700";

  return (
    <div
      className="mt-2 flex flex-wrap gap-1"
      title={analysis.reason}
    >
      <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-700">
        AI {analysis.discoveryScore}
      </span>
      <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-600">
        {CONTENT_TYPE_LABELS[
          analysis.contentType
        ]}
      </span>
      <span
        className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${actionClass}`}
      >
        {analysis.action}
      </span>
    </div>
  );
}

function formatPublishedDate(
  publishedAt: string,
) {
  const date = new Date(
    publishedAt,
  );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return publishedAt.slice(
      0,
      10,
    );
  }

  return date.toLocaleDateString(
    "en-CA",
  );
}

function formatCount(
  value: number | undefined,
): string {
  if (
    value == null ||
    Number.isNaN(value)
  ) {
    return "0";
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return String(value);
}

function formatDuration(
  totalSeconds: number,
): string {
  const hours = Math.floor(
    totalSeconds / 3600,
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60,
  );

  const seconds =
    totalSeconds % 60;

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
/*
  YouTube URL에서
  @handle 추출
*/
function extractYouTubeHandle(
  url: string,
): string {
  try {
    const parsed =
      new URL(url);

    const parts =
      parsed.pathname
        .split("/")
        .filter(Boolean);

    const handle =
      parts.find(
        (part) =>
          part.startsWith(
            "@",
          ),
      );

    if (!handle) {
      return "";
    }

    return handle.slice(1);
  } catch {
    return "";
  }
}