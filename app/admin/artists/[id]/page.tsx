"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Artist = {
  id: string;
  name: string;
  username: string | null;
  category: string;
  bio: string | null;
  profile_image: string | null;
  cover_image: string | null;
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

export default function AdminArtistEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const artistId = params.id;

  const [artist, setArtist] = useState<Artist | null>(null);
  const [works, setWorks] = useState<Work[]>([]);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [category, setCategory] = useState("music");
  const [bio, setBio] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [isCurated, setIsCurated] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const { data: artistData, error: artistError } =
        await supabase
          .from("creators")
          .select(`
            id,
            name,
            username,
            category,
            bio,
            profile_image,
            cover_image,
            tags,
            youtube_url,
            instagram_url,
            is_curated
          `)
          .eq("id", artistId)
          .maybeSingle();

      if (artistError) {
        console.error(artistError);
        setError("Artist를 불러오지 못했습니다.");
        setLoading(false);
        return;
      }

      if (!artistData) {
        setError("Artist를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      const loadedArtist = artistData as Artist;

      setArtist(loadedArtist);
      setName(loadedArtist.name ?? "");
      setUsername(loadedArtist.username ?? "");
      setCategory(loadedArtist.category ?? "music");
      setBio(loadedArtist.bio ?? "");
      setProfileImage(loadedArtist.profile_image ?? "");
      setCoverImage(loadedArtist.cover_image ?? "");
      setTagsText((loadedArtist.tags ?? []).join(", "));
      setYoutubeUrl(loadedArtist.youtube_url ?? "");
      setInstagramUrl(loadedArtist.instagram_url ?? "");
      setIsCurated(loadedArtist.is_curated ?? true);

      const { data: worksData, error: worksError } =
        await supabase
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
          .eq("artist_id", artistId)
          .order("published_at", {
            ascending: false,
          });

      if (worksError) {
        console.error(worksError);
        setError("Works를 불러오지 못했습니다.");
      } else {
        setWorks((worksData ?? []) as Work[]);
      }

      setLoading(false);
    }

    load();
  }, [artistId, supabase]);

  async function saveProfile() {
  setSaving(true);
  setError("");
  setMessage("");

  const tags = tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  try {
    const response = await fetch(
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
          bio,
          profileImage,
          coverImage,
          tags,
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

    setArtist(data.artist);

    setMessage(
      "프로필이 저장되었습니다.",
    );

    router.refresh();
  } catch (error) {
    console.error(
      "Profile update error:",
      error,
    );

    if (error instanceof Error) {
      setError(error.message);
    } else {
      setError(
        "프로필 저장에 실패했습니다.",
      );
    }
  } finally {
    setSaving(false);
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
    const response = await fetch(
      "/api/admin/works/featured",
      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          workId: work.id,
          featured: nextFeatured,
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

    setWorks((current) =>
      current.map((item) =>
        item.id === work.id
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
      "Featured update error:",
      error,
    );

    if (error instanceof Error) {
      setError(error.message);
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
            {error || "Artist를 찾을 수 없습니다."}
          </p>
        </div>
      </main>
    );
  }

  return (
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
          {/* Left */}
          <div className="space-y-8">
            {/* Basic */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-zinc-950">
                Profile
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    Artist name
                  </label>

                  <input
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    Username
                  </label>

                  <input
                    value={username}
                    onChange={(event) =>
                      setUsername(event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    Category
                  </label>

                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400"
                  >
                    <option value="music">Music</option>
                    <option value="dance">Dance</option>
                    <option value="art">Art</option>
                    <option value="cosplay">Cosplay</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    Tags
                  </label>

                  <input
                    value={tagsText}
                    onChange={(event) =>
                      setTagsText(event.target.value)
                    }
                    placeholder="K-pop, Performance, Boy Group"
                    className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-medium text-zinc-800">
                  Bio
                </label>

                <textarea
                  value={bio}
                  onChange={(event) =>
                    setBio(event.target.value)
                  }
                  rows={5}
                  className="w-full resize-y rounded-xl border border-zinc-200 px-4 py-3 text-sm leading-6 outline-none focus:border-zinc-400"
                />
              </div>
            </section>

            {/* Images */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-zinc-950">
                Images
              </h2>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    Cover image URL
                  </label>

                  <input
                    value={coverImage}
                    onChange={(event) =>
                      setCoverImage(event.target.value)
                    }
                    placeholder="https://..."
                    className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
                  />
                </div>

                {coverImage && (
                  <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
                    <img
                      src={coverImage}
                      alt="Cover preview"
                      className="h-64 w-full object-cover"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    Profile image URL
                  </label>

                  <input
                    value={profileImage}
                    onChange={(event) =>
                      setProfileImage(event.target.value)
                    }
                    placeholder="https://..."
                    className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
                  />
                </div>
              </div>
            </section>

            {/* Links */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-zinc-950">
                Artist Links
              </h2>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    YouTube
                  </label>

                  <input
                    value={youtubeUrl}
                    onChange={(event) =>
                      setYoutubeUrl(event.target.value)
                    }
                    placeholder="https://youtube.com/@artist"
                    className="h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    Instagram
                  </label>

                  <input
                    value={instagramUrl}
                    onChange={(event) =>
                      setInstagramUrl(event.target.value)
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
                      setIsCurated(event.target.checked)
                    }
                    className="h-4 w-4"
                  />

                  <span className="text-sm text-zinc-700">
                    Curated by Kovemu
                  </span>
                </label>
              </div>
            </section>

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
          </div>

          {/* Right: Works */}
          <aside>
            <section className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div>
                <h2 className="text-xl font-semibold text-zinc-950">
                  Featured Works
                </h2>

                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Featured로 선택하면 Artist Profile의
                  Latest Works에서는 자동으로 제외됩니다.
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
                        <div className="aspect-video overflow-hidden bg-zinc-100">
                          <img
                            src={work.thumbnail_url}
                            alt={work.title || "Work"}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}

                      <div className="p-4">
                        <p className="line-clamp-2 text-sm font-medium leading-5 text-zinc-900">
                          {work.title ||
                            work.description ||
                            "Untitled work"}
                        </p>

                        {work.published_at && (
                          <p className="mt-2 text-xs text-zinc-400">
                            {new Date(
                              work.published_at,
                            ).toLocaleDateString(
                              "ko-KR",
                            )}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            toggleFeatured(work)
                          }
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
    </main>
  );
}