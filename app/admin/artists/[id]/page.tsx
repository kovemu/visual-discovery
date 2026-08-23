"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import YouTubePreviewModal, {
  YouTubePreviewThumbnail,
  extractYouTubeVideoId,
} from "@/components/admin/YouTubePreviewModal";

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

type Artist = {
  id: string;
  name: string;
  username: string | null;
  category: string;

  tagline: string | null;
  bio: string | null;

  profile_image: string | null;
  cover_image: string | null;

  cover_position_x: number;
  cover_position_y: number;

  tags: string[] | null;

  youtube_url: string | null;
  instagram_url: string | null;

  is_curated: boolean;
};

type Work = {
  id: number;

  source: string;
  source_id: string | null;
  source_url: string;

  title: string | null;
  description: string | null;

  thumbnail_url: string | null;

  published_at: string | null;

  featured: boolean;
};

function clampPosition(value: number) {
  return Math.min(
    100,
    Math.max(0, value),
  );
}

function getWorkYouTubePreviewUrl(
  work: Work,
) {
  if (
    work.source === "youtube" &&
    work.source_id
  ) {
    return `https://www.youtube.com/watch?v=${work.source_id}`;
  }

  return work.source_url;
}

function canPreviewWork(
  work: Work,
) {
  if (work.source !== "youtube") {
    return false;
  }

  return Boolean(
    extractYouTubeVideoId(
      getWorkYouTubePreviewUrl(
        work,
      ),
    ),
  );
}

export default function AdminArtistEditPage() {
  const params = useParams<{
    id: string;
  }>();

  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const artistId = params.id;

  const [artist, setArtist] =
    useState<Artist | null>(null);

  const [works, setWorks] =
    useState<Work[]>([]);
const [
  editingWork,
  setEditingWork,
] =
  useState<Work | null>(
    null,
  );

const [
  editWorkTitle,
  setEditWorkTitle,
] = useState("");

const [
  editWorkDescription,
  setEditWorkDescription,
] = useState("");

const [
  editWorkSourceUrl,
  setEditWorkSourceUrl,
] = useState("");

const [
  editWorkPublishedAt,
  setEditWorkPublishedAt,
] = useState("");
  /*
    Profile
  */
  const [name, setName] =
    useState("");

  const [username, setUsername] =
    useState("");

  const [category, setCategory] =
    useState("music");

  const [tagline, setTagline] =
    useState("");

  const [bio, setBio] =
    useState("");

  /*
    Tags
  */
  const [selectedTags, setSelectedTags] =
    useState<string[]>([]);

  /*
    Images
  */
  const [coverImage, setCoverImage] =
    useState("");

  const [profileImage, setProfileImage] =
    useState("");

  /*
    Cover position

    50 / 50 = center
  */
  const [
    coverPositionX,
    setCoverPositionX,
  ] = useState(50);

  const [
    coverPositionY,
    setCoverPositionY,
  ] = useState(50);

  /*
    Cover Drag
  */
  const [isDraggingCover, setIsDraggingCover] =
    useState(false);

  const previousPointer =
    useRef<{
      x: number;
      y: number;
    } | null>(null);

  /*
    Links
  */
  const [youtubeUrl, setYoutubeUrl] =
    useState("");

  const [
    instagramUrl,
    setInstagramUrl,
  ] = useState("");

  const [
    isCurated,
    setIsCurated,
  ] = useState(true);

  /*
    UI state
  */
  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [
    previewVideo,
    setPreviewVideo,
  ] = useState<{
    videoId: string;
    title: string;
  } | null>(null);

  /*
    Load Artist + Works
  */
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const {
        data: artistData,
        error: artistError,
      } = await supabase
        .from("creators")
        .select(`
          id,
          name,
          username,
          category,
          tagline,
          bio,
          profile_image,
          cover_image,
          cover_position_x,
          cover_position_y,
          tags,
          youtube_url,
          instagram_url,
          is_curated
        `)
        .eq("id", artistId)
        .maybeSingle();

      if (artistError) {
        console.error(
          "LOAD ARTIST ERROR:",
          artistError,
        );

        setError(
          "Artist를 불러오지 못했습니다.",
        );

        setLoading(false);

        return;
      }

      if (!artistData) {
        setError(
          "Artist를 찾을 수 없습니다.",
        );

        setLoading(false);

        return;
      }

      const loadedArtist =
        artistData as Artist;

      setArtist(loadedArtist);

      setName(
        loadedArtist.name ?? "",
      );

      setUsername(
        loadedArtist.username ?? "",
      );

      setCategory(
        loadedArtist.category ??
          "music",
      );

      setTagline(
        loadedArtist.tagline ?? "",
      );

      setBio(
        loadedArtist.bio ?? "",
      );

      /*
        기존 DB 태그 중
        현재 허용된 태그만 선택 상태로 복원
      */
      setSelectedTags(
        (loadedArtist.tags ?? []).filter(
          (tag) =>
            TAG_OPTIONS.some(
              (option) =>
                option === tag,
            ),
        ),
      );

      setProfileImage(
        loadedArtist.profile_image ??
          "",
      );

      setCoverImage(
        loadedArtist.cover_image ??
          "",
      );

      setCoverPositionX(
        loadedArtist.cover_position_x ??
          50,
      );

      setCoverPositionY(
        loadedArtist.cover_position_y ??
          50,
      );

      setYoutubeUrl(
        loadedArtist.youtube_url ??
          "",
      );

      setInstagramUrl(
        loadedArtist.instagram_url ??
          "",
      );

      setIsCurated(
        loadedArtist.is_curated ??
          true,
      );

      /*
        Works
      */
      const {
        data: worksData,
        error: worksError,
      } = await supabase
        .from("works")
        .select(`
          id,
          source,
          source_id,
          source_url,
          title,
          description,
          thumbnail_url,
          published_at,
          featured
        `)
        .eq(
          "artist_id",
          artistId,
        )
        .order(
          "published_at",
          {
            ascending: false,
          },
        );

      if (worksError) {
        console.error(
          "LOAD WORKS ERROR:",
          worksError,
        );

        setError(
          "Works를 불러오지 못했습니다.",
        );
      } else {
        setWorks(
          (worksData ?? []) as Work[],
        );
      }

      setLoading(false);
    }

    load();
  }, [
    artistId,
    supabase,
  ]);

  /*
    Toggle Tag
  */
  function toggleTag(tag: string) {
    setSelectedTags(
      (current) => {
        if (
          current.includes(tag)
        ) {
          return current.filter(
            (item) =>
              item !== tag,
          );
        }

        return [
          ...current,
          tag,
        ];
      },
    );
  }

  /*
    Cover Drag Start
  */
  function handleCoverPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    event.preventDefault();

    setIsDraggingCover(true);

    previousPointer.current = {
      x: event.clientX,
      y: event.clientY,
    };

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );
  }

  /*
    Cover Drag Move

    이미지를 왼쪽으로 끌면
    오른쪽 영역을 보여줘야 하므로
    position 값은 반대 방향으로 이동.
  */
  function handleCoverPointerMove(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (
      !isDraggingCover ||
      !previousPointer.current
    ) {
      return;
    }

    const container =
      event.currentTarget;

    const rect =
      container.getBoundingClientRect();

    const deltaX =
      event.clientX -
      previousPointer.current.x;

    const deltaY =
      event.clientY -
      previousPointer.current.y;

    const percentX =
      (deltaX / rect.width) *
      100;

    const percentY =
      (deltaY / rect.height) *
      100;

    setCoverPositionX(
      (current) =>
        clampPosition(
          current - percentX,
        ),
    );

    setCoverPositionY(
      (current) =>
        clampPosition(
          current - percentY,
        ),
    );

    previousPointer.current = {
      x: event.clientX,
      y: event.clientY,
    };
  }

  /*
    Cover Drag End
  */
  function handleCoverPointerUp(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    setIsDraggingCover(false);

    previousPointer.current =
      null;

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }
  }

  function resetCoverPosition() {
    setCoverPositionX(50);
    setCoverPositionY(50);
  }

  /*
    Save Artist Profile
  */
  async function saveProfile() {
    setSaving(true);

    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          `/api/admin/artists/${artistId}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              name,
              username,
              category,

              tagline,
              bio,

              profileImage,
              coverImage,
              coverPositionX: Math.round(coverPositionX),
              coverPositionY: Math.round(coverPositionY),

              tags:
                selectedTags,

              youtubeUrl,
              instagramUrl,

              isCurated,
            }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "프로필 저장에 실패했습니다.",
        );
      }

      setArtist(
        data.artist,
      );

      setMessage(
        "프로필이 저장되었습니다.",
      );

      router.refresh();
    } catch (error) {
      console.error(
        "PROFILE UPDATE ERROR:",
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
          "프로필 저장에 실패했습니다.",
        );
      }
    } finally {
      setSaving(false);
    }
  }
async function deleteWork(work: Work) {
  const confirmed = window.confirm(
    `"${work.title || "Untitled Work"}"을 삭제할까요?`,
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(
      `/api/admin/works/${work.id}`,
      {
        method: "DELETE",
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "삭제에 실패했습니다.",
      );
    }

    setWorks((current) =>
      current.filter(
        (item) => item.id !== work.id,
      ),
    );
  } catch (error) {
    console.error(error);
  }
}
async function deleteArtist() {
  const firstConfirm =
    window.confirm(
      `"${artist?.name}" Artist 프로필을 삭제할까요?\n\n연결된 모든 Works도 함께 삭제됩니다.`,
    );

  if (!firstConfirm) {
    return;
  }

  const secondConfirm =
    window.confirm(
      "이 작업은 되돌릴 수 없습니다. 정말 삭제하시겠습니까?",
    );

  if (!secondConfirm) {
    return;
  }

  setError("");
  setMessage("");

  try {
    const response =
      await fetch(
        `/api/admin/artists/${artistId}`,
        {
          method: "DELETE",
        },
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Artist 삭제에 실패했습니다.",
      );
    }

    router.push(
      "/admin/artists",
    );

    router.refresh();
  } catch (error) {
    console.error(
      "DELETE ARTIST ERROR:",
      error,
    );

    if (error instanceof Error) {
      setError(error.message);
    }
  }
}

  /*
    Featured Toggle
  */
 function openWorkEditor(
  work: Work,
) {
  setEditingWork(work);

  setEditWorkTitle(
    work.title ?? "",
  );

  setEditWorkDescription(
    work.description ?? "",
  );

  setEditWorkSourceUrl(
    work.source_url ?? "",
  );

  setEditWorkPublishedAt(
    work.published_at
      ? work.published_at.slice(
          0,
          10,
        )
      : "",
  );
}
async function saveWorkEdit() {
  if (!editingWork) {
    return;
  }

  setError("");
  setMessage("");

  try {
    const response =
      await fetch(
        `/api/admin/works/${editingWork.id}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              title:
                editWorkTitle,

              description:
                editWorkDescription,

              sourceUrl:
                editWorkSourceUrl,

              publishedAt:
                editWorkPublishedAt,
            }),
        },
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Work 수정에 실패했습니다.",
      );
    }

    setWorks(
      (current) =>
        current.map(
          (work) =>
            work.id ===
            editingWork.id
              ? data.work
              : work,
        ),
    );

    setEditingWork(null);

    setMessage(
      "Work가 수정되었습니다.",
    );
  } catch (error) {
    console.error(
      "UPDATE WORK ERROR:",
      error,
    );

    if (error instanceof Error) {
      setError(error.message);
    }
  }
}
  async function toggleFeatured(
    work: Work,
  ) {
    setError("");
    setMessage("");

    const nextFeatured =
      !work.featured;

    try {
      const response =
        await fetch(
          "/api/admin/works/featured",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              workId:
                work.id,

              featured:
                nextFeatured,
            }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Featured 변경에 실패했습니다.",
        );
      }

      setWorks(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              work.id
                ? {
                    ...item,
                    featured:
                      nextFeatured,
                  }
                : item,
          ),
      );

      setMessage(
        nextFeatured
          ? "Featured Work로 지정했습니다."
          : "Featured Work에서 해제했습니다.",
      );
    } catch (error) {
      console.error(
        "FEATURED UPDATE ERROR:",
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
          "Featured 변경에 실패했습니다.",
        );
      }
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="text-sm text-zinc-500">
            Loading...
          </p>
        </div>
      </main>
    );
  }

  if (!artist) {
    return (
      <main className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="text-sm text-red-500">
            {error ||
              "Artist를 찾을 수 없습니다."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Header */}
        <section className="mb-10">
          <Link
            href="/admin/artists"
            className="text-sm font-medium text-zinc-500 transition hover:text-zinc-950"
          >
            ← Back to Artists
          </Link>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">
                Kovemu Admin
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                Edit Artist
              </h1>

              <p className="mt-2 text-sm text-zinc-500">
                {artist.name}
              </p>
            </div>

            <Link
              href={`/creator/${artist.id}`}
              target="_blank"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100"
            >
              View Profile
            </Link>
          </div>
        </section>

        {error && (
          <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {message && (
          <p className="mb-6 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </p>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          {/* LEFT */}
          <div className="space-y-8">
            {/* Profile */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-zinc-950">
                Profile
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {/* Artist Name */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    Artist name
                  </label>

                  <input
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target.value,
                      )
                    }
                    className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    Username
                  </label>

                  <input
                    value={username}
                    onChange={(event) =>
                      setUsername(
                        event.target.value,
                      )
                    }
                    className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    Category
                  </label>

                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(
                        event.target.value,
                      )
                    }
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400"
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
              </div>

              {/* Tags */}
              <div className="mt-5">
                <label className="mb-3 block text-sm font-medium text-zinc-800">
                  Tags
                </label>

                <div className="flex flex-wrap gap-2">
                  {TAG_OPTIONS.map(
                    (tag) => {
                      const selected =
                        selectedTags.includes(
                          tag,
                        );

                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            toggleTag(
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

              {/* Tagline */}
              <div className="mt-5">
                <label className="mb-2 block text-sm font-medium text-zinc-800">
                  Tagline
                </label>

                <input
                  value={tagline}
                  onChange={(event) =>
                    setTagline(
                      event.target.value,
                    )
                  }
                  placeholder="A short introduction shown in the profile hero."
                  maxLength={120}
                  className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
                />

                <p className="mt-2 text-xs text-zinc-400">
                  Short introduction shown in the Artist Profile hero.
                </p>
              </div>

              {/* Bio */}
              <div className="mt-5">
                <label className="mb-2 block text-sm font-medium text-zinc-800">
                  Bio
                </label>

                <textarea
                  value={bio}
                  onChange={(event) =>
                    setBio(
                      event.target.value,
                    )
                  }
                  rows={7}
                  className="w-full resize-y rounded-xl border border-zinc-200 px-4 py-3 text-sm leading-6 outline-none focus:border-zinc-400"
                />
              </div>
            </section>

            {/* Images */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-zinc-950">
                Images
              </h2>

              <div className="mt-6 space-y-6">
                {/* Cover Image URL */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    Cover image URL
                  </label>

                  <input
                    value={coverImage}
                    onChange={(event) =>
                      setCoverImage(
                        event.target.value,
                      )
                    }
                    placeholder="https://..."
                    className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
                  />
                </div>

                {/* Cover Preview */}
                {coverImage && (
                  <div className="space-y-5">
                    <div
                      role="presentation"
                      onPointerDown={
                        handleCoverPointerDown
                      }
                      onPointerMove={
                        handleCoverPointerMove
                      }
                      onPointerUp={
                        handleCoverPointerUp
                      }
                      onPointerCancel={
                        handleCoverPointerUp
                      }
                      className={`relative h-[260px] select-none overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 ${
                        isDraggingCover
                          ? "cursor-grabbing"
                          : "cursor-grab"
                      }`}
                      style={{
                        touchAction:
                          "none",
                      }}
                    >
                      <img
                        src={coverImage}
                        alt="Cover preview"
                        draggable={false}
                        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
                        style={{
                          objectPosition: `${coverPositionX}% ${coverPositionY}%`,
                        }}
                      />

                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />

                      <div className="pointer-events-none absolute bottom-5 left-5 text-white">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-300">
                          {category}
                        </p>

                        <p className="mt-1 text-2xl font-black">
                          {name ||
                            "Artist Name"}
                        </p>

                        {tagline && (
                          <p className="mt-2 max-w-md text-xs text-white/70">
                            {tagline}
                          </p>
                        )}
                      </div>

                      <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white/90">
                        Drag to reposition
                      </div>
                    </div>

                    <p className="text-xs text-zinc-400">
                      Click and drag the cover image to adjust the Hero position.
                    </p>

                    {/* Horizontal Slider */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-medium text-zinc-800">
                          Horizontal position
                        </label>

                        <span className="text-xs text-zinc-400">
                          {Math.round(
                            coverPositionX,
                          )}
                          %
                        </span>
                      </div>

                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={
                          coverPositionX
                        }
                        onChange={(event) =>
                          setCoverPositionX(
                            Number(
                              event.target
                                .value,
                            ),
                          )
                        }
                        className="w-full cursor-pointer"
                      />
                    </div>

                    {/* Vertical Slider */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-medium text-zinc-800">
                          Vertical position
                        </label>

                        <span className="text-xs text-zinc-400">
                          {Math.round(
                            coverPositionY,
                          )}
                          %
                        </span>
                      </div>

                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={
                          coverPositionY
                        }
                        onChange={(event) =>
                          setCoverPositionY(
                            Number(
                              event.target
                                .value,
                            ),
                          )
                        }
                        className="w-full cursor-pointer"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={
                          resetCoverPosition
                        }
                        className="text-xs font-medium text-zinc-500 transition hover:text-zinc-950"
                      >
                        Reset position
                      </button>
                    </div>
                  </div>
                )}

                {/* Profile Image */}
                <div className="border-t border-zinc-100 pt-6">
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    Profile image URL
                  </label>

                  <input
                    value={profileImage}
                    onChange={(event) =>
                      setProfileImage(
                        event.target.value,
                      )
                    }
                    placeholder="https://..."
                    className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
                  />

                  {profileImage && (
                    <div className="mt-4 flex items-center gap-4">
                      <img
                        src={profileImage}
                        alt="Profile preview"
                        className="h-20 w-20 rounded-full border border-zinc-200 object-cover"
                      />

                      <div>
                        <p className="text-sm font-medium text-zinc-900">
                          {name}
                        </p>

                        <p className="mt-1 text-xs text-zinc-400">
                          Profile image preview
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Links */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-zinc-950">
                Artist Links
              </h2>

              <div className="mt-6 space-y-5">
                {/* YouTube */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    YouTube
                  </label>

                  <input
                    value={youtubeUrl}
                    onChange={(event) =>
                      setYoutubeUrl(
                        event.target.value,
                      )
                    }
                    placeholder="https://youtube.com/@artist"
                    className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
                  />
                </div>

                {/* Instagram */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    Instagram
                  </label>

                  <input
                    value={instagramUrl}
                    onChange={(event) =>
                      setInstagramUrl(
                        event.target.value,
                      )
                    }
                    placeholder="https://instagram.com/artist"
                    className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
                  />
                </div>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isCurated}
                    onChange={(event) =>
                      setIsCurated(
                        event.target.checked,
                      )
                    }
                    className="h-4 w-4"
                  />

                  <span className="text-sm text-zinc-700">
                    Curated by Kovemu
                  </span>
                </label>
              </div>
            </section>

            {/* Save */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="rounded-xl bg-zinc-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "Save Profile"}
              </button>
            </div>
            {/* Danger Zone */}
<section className="rounded-2xl border border-red-200 bg-red-50/40 p-6">
  <h2 className="text-lg font-semibold text-red-700">
    Danger Zone
  </h2>

  <p className="mt-2 text-sm leading-6 text-red-600/80">
    Artist 프로필과 연결된 모든 Works가
    삭제됩니다. 이 작업은 되돌릴 수 없습니다.
  </p>

  <button
    type="button"
    onClick={deleteArtist}
    className="mt-5 rounded-xl border border-red-200 bg-white px-5 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-600 hover:text-white"
  >
    Delete Artist
  </button>
</section>
          </div>

          {/* RIGHT */}
          <aside>
            <section className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div>
                <h2 className="text-xl font-semibold text-zinc-950">
                  Featured Works
                </h2>

                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Featured로 선택하면 Artist Profile의 Latest Works에서는 자동으로 제외됩니다.
                </p>
              </div>

              <div className="mt-6 space-y-4">
                {works.length > 0 ? (
                  works.map((work) => (
                    <article
                      key={work.id}
                      className="overflow-hidden rounded-xl border border-zinc-200"
                    >
                      {work.thumbnail_url && (
                        <div className="relative aspect-video overflow-hidden bg-zinc-100">
                          {canPreviewWork(
                            work,
                          ) ? (
                            <YouTubePreviewThumbnail
                              url={getWorkYouTubePreviewUrl(
                                work,
                              )}
                              title={
                                work.title ||
                                work.description ||
                                "Work"
                              }
                              thumbnail={
                                work.thumbnail_url
                              }
                              onPreview={(
                                videoId,
                                title,
                              ) =>
                                setPreviewVideo(
                                  {
                                    videoId,
                                    title,
                                  },
                                )
                              }
                              className="h-full w-full"
                            />
                          ) : (
                            <img
                              src={
                                work.thumbnail_url
                              }
                              alt={
                                work.title ||
                                "Work"
                              }
                              className="h-full w-full object-cover"
                            />
                          )}

                          <button
                            type="button"
                            onClick={(
                              event,
                            ) => {
                              event.stopPropagation();
                              deleteWork(
                                work,
                              );
                            }}
                            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white transition hover:bg-red-600"
                            title="Delete work"
                          >
                            ×
                          </button>
                        </div>
                      )}

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="line-clamp-2 min-w-0 text-sm font-medium leading-5 text-zinc-900">
                            {work.title ||
                              work.description ||
                              "Untitled work"}
                          </p>

                          {work.source !== "youtube" && (
                            <button
                              type="button"
                              onClick={() => openWorkEditor(work)}
                              className="shrink-0 text-xs font-medium text-zinc-400 transition hover:text-fuchsia-600"
                            >
                              Edit
                            </button>
                          )}
                        </div>

                        {work.published_at && (
                          <p className="mt-2 text-xs text-zinc-400">
                            {new Date(
                              work.published_at,
                            ).toLocaleDateString("ko-KR")}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleFeatured(work)}
                          className={`mt-4 w-full rounded-lg px-3 py-2 text-sm font-medium transition ${
                            work.featured
                              ? "bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                              : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          {work.featured
                            ? "Featured ✓"
                            : "Set Featured"}
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-300 px-5 py-10 text-center">
                    <p className="text-sm text-zinc-500">
                      No works available.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
      {/* Edit Work Modal */}
{editingWork && (
  <div
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6"
    onClick={() =>
      setEditingWork(null)
    }
  >
    <div
      className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      onClick={(event) =>
        event.stopPropagation()
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-950">
          Edit Work
        </h2>

        <button
          type="button"
          onClick={() =>
            setEditingWork(null)
          }
          className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-950"
        >
          ×
        </button>
      </div>

      {/* Image Preview */}
      {editingWork.thumbnail_url && (
        <img
          src={
            editingWork.thumbnail_url
          }
          alt={
            editingWork.title ||
            "Work"
          }
          className="mt-5 max-h-[300px] w-full rounded-xl bg-zinc-100 object-contain"
        />
      )}

      {/* Fields */}
      <div className="mt-5 space-y-4">
        {/* Caption */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-800">
            Caption
          </label>

          <input
            value={
              editWorkTitle
            }
            onChange={(event) =>
              setEditWorkTitle(
                event.target.value,
              )
            }
            className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-800">
            Description
          </label>

          <textarea
            value={
              editWorkDescription
            }
            onChange={(event) =>
              setEditWorkDescription(
                event.target.value,
              )
            }
            rows={4}
            className="w-full resize-y rounded-xl border border-zinc-200 px-4 py-3 text-sm leading-6 outline-none focus:border-zinc-400"
          />
        </div>

        {/* Source URL */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-800">
            Source URL
          </label>

          <input
            value={
              editWorkSourceUrl
            }
            onChange={(event) =>
              setEditWorkSourceUrl(
                event.target.value,
              )
            }
            placeholder="https://..."
            className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
          />
        </div>

        {/* Published Date */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-800">
            Published Date
          </label>

          <input
            type="date"
            value={
              editWorkPublishedAt
            }
            onChange={(event) =>
              setEditWorkPublishedAt(
                event.target.value,
              )
            }
            className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={() =>
            setEditingWork(null)
          }
          className="rounded-xl border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={
            saveWorkEdit
          }
          className="rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
)}
    </main>

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
    </>
  );
}