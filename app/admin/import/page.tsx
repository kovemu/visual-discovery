"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

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
};

type Artist = {
  id: string;
  name: string;
  username: string | null;
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

type FancamSort =
  | "views"
  | "likes"
  | "recent";

function buildDefaultFancamKeyword(
  artistName: string,
) {
  return `${artistName} fancam | `;
}

const MAX_IMAGE_SIZE = 1800;
const WEBP_QUALITY = 0.82;

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
    fancamSort,
    setFancamSort,
  ] =
    useState<FancamSort>(
      "views",
    );

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

setShorts(
  data.shorts ?? [],
);

      setVideos(
        data.videos ?? [],
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
        } else {
          next.add(
            videoId,
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

    setSelectedImageIds(
      new Set(),
    );
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
  const sortedFancamWorks =
    useMemo(() => {
      const copy = [
        ...fancamWorks,
      ];

      if (fancamSort === "views") {
        return copy.sort(
          (a, b) =>
            (b.viewCount ?? 0) -
            (a.viewCount ?? 0),
        );
      }

      if (fancamSort === "likes") {
        return copy.sort(
          (a, b) =>
            (b.likeCount ?? 0) -
            (a.likeCount ?? 0),
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
    }, [
      fancamWorks,
      fancamSort,
    ]);

  const displayedVideos =
    activeTab === "shorts"
      ? shorts
      : activeTab === "videos"
        ? videos
        : activeTab === "fancams"
          ? sortedFancamWorks
          : activeTab ===
              "additional"
            ? additionalWorks
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
                      selectedVideoWorks,
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
        <h2 className="text-lg font-semibold text-zinc-950">
          YouTube Channel
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          Shorts와 일반
          영상을 자동으로
          불러옵니다.
        </p>

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
              Sort
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

              {(
                [
                  ["views", "Views"],
                  ["likes", "Likes"],
                  ["recent", "Recent"],
                ] as const
              ).map(
                ([
                  value,
                  label,
                ]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setFancamSort(
                        value,
                      )
                    }
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      fancamSort ===
                      value
                        ? "bg-zinc-950 text-white"
                        : "border border-zinc-200 text-zinc-600"
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
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
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {displayedVideos.map(
                (video) => {
                  const selected =
                    selectedVideoIds.has(
                      video.id,
                    );

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
  <img
    src={video.thumbnail}
    alt={video.title}
    className="h-full w-full object-cover"
  />

  <div className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold">
    {selected ? "✓" : ""}
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

                        {(video.viewCount !=
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
                            {video.publishedAt
                              ? ` · ${video.publishedAt.slice(0, 10)}`
                              : ""}
                            {video.channelTitle
                              ? ` · ${video.channelTitle}`
                              : ""}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                },
              )}
            </div>
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