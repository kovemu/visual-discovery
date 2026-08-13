"use client";

import { useEffect, useState } from "react";
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

type TabType = "shorts" | "videos";

export default function AdminImportPage() {
  const supabase = createClient();

  const [channelUrl, setChannelUrl] = useState("");
  const [channel, setChannel] = useState<YouTubeChannel | null>(null);

  const [shorts, setShorts] = useState<YouTubeVideo[]>([]);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);

  const [activeTab, setActiveTab] = useState<TabType>("shorts");

  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(
    new Set()
  );

  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState("");

  const [showCreateArtist, setShowCreateArtist] = useState(false);

  const [newArtist, setNewArtist] = useState<NewArtistForm>({
    name: "",
    username: "",
    category: "music",
  });

  const [creatingArtist, setCreatingArtist] = useState(false);
  const [importingWorks, setImportingWorks] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadArtists() {
      const { data, error } = await supabase
        .from("creators")
        .select("id, name, username")
        .order("name", { ascending: true });

      if (error) {
        console.error("Failed to load artists:", error);
        return;
      }

      setArtists(data ?? []);
    }

    loadArtists();
  }, []);

  async function loadVideos() {
    if (!channelUrl.trim()) {
      setError("YouTube channel URL을 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setChannel(null);
    setShorts([]);
    setVideos([]);
    setSelectedVideoIds(new Set());

    try {
      const response = await fetch(
        `/api/youtube/channel?url=${encodeURIComponent(channelUrl)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "YouTube 영상을 불러오지 못했습니다."
        );
      }

      setChannel(data.channel);
      setShorts(data.shorts ?? []);
      setVideos(data.videos ?? []);
      setActiveTab("shorts");
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("알 수 없는 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleVideo(videoId: string) {
    setSelectedVideoIds((current) => {
      const next = new Set(current);

      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }

      return next;
    });
  }

  function clearSelection() {
    setSelectedVideoIds(new Set());
  }

  async function createArtist() {
  if (!newArtist.name.trim()) {
    setError("Artist name을 입력해주세요.");
    return;
  }

  setCreatingArtist(true);
  setError("");
  setMessage("");

  try {
    const response = await fetch("/api/admin/artists", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newArtist.name.trim(),
        username: newArtist.username.trim(),
        category: newArtist.category,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Artist 생성에 실패했습니다."
      );
    }

    const artist = data.artist;

    setArtists((current) =>
      [...current, artist].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );

    setSelectedArtistId(artist.id);

    setNewArtist({
      name: "",
      username: "",
      category: "music",
    });

    setShowCreateArtist(false);

    setMessage(
      `${artist.name} Artist가 생성되었습니다.`
    );
  } catch (error) {
    console.error("Create artist error:", error);

    if (error instanceof Error) {
      setError(error.message);
    } else {
      setError("Artist 생성에 실패했습니다.");
    }
  } finally {
    setCreatingArtist(false);
  }
}
async function importWorks() {
  if (!selectedArtistId) {
    setError("Artist를 선택해주세요.");
    return;
  }

  if (selectedWorks.length === 0) {
    setError("Import할 Work를 선택해주세요.");
    return;
  }

  setImportingWorks(true);
  setError("");
  setMessage("");

  try {
    const response = await fetch("/api/admin/import-works", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        artistId: selectedArtistId,
        works: selectedWorks,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Work Import에 실패했습니다."
      );
    }

    setMessage(
      `${data.importedCount}개의 Work가 Import되었습니다.`
    );

    setSelectedVideoIds(new Set());
  } catch (error) {
    console.error("Import works error:", error);

    if (error instanceof Error) {
      setError(error.message);
    } else {
      setError("Work Import에 실패했습니다.");
    }
  } finally {
    setImportingWorks(false);
  }
}
  const displayedVideos =
    activeTab === "shorts" ? shorts : videos;

  const totalWorks = shorts.length + videos.length;

  const allWorks = [...shorts, ...videos];

  const selectedWorks = allWorks.filter((video) =>
    selectedVideoIds.has(video.id)
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      {/* Header */}
      <section className="mb-10">
        <p className="mb-2 text-sm font-medium text-zinc-500">
          Kovemu Admin
        </p>

        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          YouTube Importer
        </h1>

        <p className="mt-3 text-sm text-zinc-500">
          YouTube 채널의 작품을 불러와 Kovemu에 등록합니다.
        </p>
      </section>

      {/* YouTube Import */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <label
          htmlFor="youtube-channel"
          className="mb-2 block text-sm font-medium text-zinc-800"
        >
          YouTube Channel URL
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="youtube-channel"
            type="text"
            value={channelUrl}
            onChange={(event) =>
              setChannelUrl(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                loadVideos();
              }
            }}
            placeholder="https://www.youtube.com/@artist"
            className="h-12 flex-1 rounded-xl border border-zinc-200 px-4 text-sm outline-none transition focus:border-zinc-400"
          />

          <button
            type="button"
            onClick={loadVideos}
            disabled={loading}
            className="h-12 rounded-xl bg-zinc-950 px-6 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load videos"}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-500">
            {error}
          </p>
        )}

        {message && (
          <p className="mt-3 text-sm text-green-600">
            {message}
          </p>
        )}
      </section>

      {/* Channel Information */}
      {channel && (
        <section className="mt-8 flex items-center gap-4 border-b border-zinc-200 pb-8">
          {channel.thumbnail && (
            <img
              src={channel.thumbnail}
              alt={channel.title}
              className="h-16 w-16 rounded-full object-cover"
            />
          )}

          <div>
            <h2 className="text-lg font-semibold text-zinc-950">
              {channel.title}
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              {totalWorks} works loaded
            </p>

            <p className="mt-1 text-xs text-zinc-400">
              Shorts {shorts.length} · Videos {videos.length}
            </p>
          </div>
        </section>
      )}

      {/* Tabs */}
      {channel && (
        <section className="mt-8">
          <div className="flex items-end justify-between border-b border-zinc-200">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("shorts")}
                className={`border-b-2 px-4 pb-3 text-sm font-medium transition ${
                  activeTab === "shorts"
                    ? "border-zinc-950 text-zinc-950"
                    : "border-transparent text-zinc-400 hover:text-zinc-700"
                }`}
              >
                Shorts ({shorts.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("videos")}
                className={`border-b-2 px-4 pb-3 text-sm font-medium transition ${
                  activeTab === "videos"
                    ? "border-zinc-950 text-zinc-950"
                    : "border-transparent text-zinc-400 hover:text-zinc-700"
                }`}
              >
                Videos ({videos.length})
              </button>
            </div>

            {selectedVideoIds.size > 0 && (
              <div className="flex items-center gap-4 pb-3">
                <span className="text-sm font-medium text-zinc-700">
                  {selectedVideoIds.size} selected
                </span>

                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-sm text-zinc-400 transition hover:text-zinc-800"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Video Grid */}
      {channel && (
        <section className="mt-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-zinc-950">
              {activeTab === "shorts" ? "Shorts" : "Videos"}
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              {activeTab === "shorts"
                ? "2분 30초 이하 영상을 표시합니다."
                : "2분 30초 초과 영상을 표시합니다."}
            </p>
          </div>

          {displayedVideos.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {displayedVideos.map((video) => {
                const selected = selectedVideoIds.has(video.id);

                return (
                  <article
                    key={video.id}
                    onClick={() => toggleVideo(video.id)}
                    className={`cursor-pointer overflow-hidden rounded-2xl border bg-white transition ${
                      selected
                        ? "border-zinc-950 ring-2 ring-zinc-950"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    <div className="relative aspect-video overflow-hidden bg-zinc-100">
                      {video.thumbnail && (
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="h-full w-full object-cover"
                        />
                      )}

                      <div
                        className={`absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold ${
                          selected
                            ? "border-zinc-950 bg-zinc-950 text-white"
                            : "border-white/80 bg-white/90 text-transparent"
                        }`}
                      >
                        ✓
                      </div>
                    </div>

                    <div className="p-4">
                      <h3 className="line-clamp-2 text-sm font-medium leading-6 text-zinc-900">
                        {video.title}
                      </h3>

                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-zinc-400">
                          {new Date(
                            video.publishedAt
                          ).toLocaleDateString("ko-KR")}
                        </p>

                        {video.durationSeconds !== undefined && (
                          <p className="text-xs text-zinc-400">
                            {formatDuration(
                              video.durationSeconds
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 py-20 text-center">
              <p className="text-sm text-zinc-400">
                표시할 영상이 없습니다.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Artist Connection */}
      {channel && selectedVideoIds.size > 0 && (
        <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">
                Import to Artist
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                {selectedWorks.length}개의 선택된 Work를 연결할
                Artist를 선택합니다.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowCreateArtist((current) => !current)
              }
              className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
            >
              {showCreateArtist
                ? "Cancel"
                : "+ Create new Artist"}
            </button>
          </div>

          <div className="mt-6">
            <label
              htmlFor="artist"
              className="mb-2 block text-sm font-medium text-zinc-800"
            >
              Artist
            </label>

            <select
              id="artist"
              value={selectedArtistId}
              onChange={(event) =>
                setSelectedArtistId(event.target.value)
              }
              className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none transition focus:border-zinc-400"
            >
              <option value="">Select artist</option>

              {artists.map((artist) => (
                <option
                  key={artist.id}
                  value={artist.id}
                >
                  {artist.name}
                  {artist.username
                    ? ` (@${artist.username})`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Create Artist */}
          {showCreateArtist && (
            <div className="mt-6 rounded-2xl bg-zinc-50 p-5">
              <div className="mb-5">
                <h3 className="font-semibold text-zinc-950">
                  Create new Artist
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Kovemu에 새 Artist 프로필을 생성합니다.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="artist-name"
                    className="mb-2 block text-sm font-medium text-zinc-800"
                  >
                    Artist name
                  </label>

                  <input
                    id="artist-name"
                    type="text"
                    value={newArtist.name}
                    onChange={(event) =>
                      setNewArtist((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="H//PE Princess"
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="artist-username"
                    className="mb-2 block text-sm font-medium text-zinc-800"
                  >
                    Username
                  </label>

                  <input
                    id="artist-username"
                    type="text"
                    value={newArtist.username}
                    onChange={(event) =>
                      setNewArtist((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                    placeholder="hiipe_princess"
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="artist-category"
                    className="mb-2 block text-sm font-medium text-zinc-800"
                  >
                    Category
                  </label>

                  <select
                    id="artist-category"
                    value={newArtist.category}
                    onChange={(event) =>
                      setNewArtist((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400"
                  >
                    <option value="music">Music</option>
                    <option value="dance">Dance</option>
                    <option value="film">Film</option>
                    <option value="art">Art</option>
                    <option value="cosplay">Cosplay</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={createArtist}
                  disabled={creatingArtist}
                  className="rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingArtist
                    ? "Creating..."
                    : "Create Artist"}
                </button>
              </div>
            </div>
          )}

          {/* Future Import Button */}
          <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-6">
            <div>
              <p className="text-sm font-medium text-zinc-900">
                {selectedWorks.length} works selected
              </p>

              <p className="mt-1 text-xs text-zinc-400">
                다음 단계에서 Supabase works 테이블에 저장합니다.
              </p>
            </div>

            <button
  type="button"
  onClick={importWorks}
  disabled={
    !selectedArtistId ||
    selectedWorks.length === 0 ||
    importingWorks
  }
  className="rounded-xl bg-zinc-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
>
  {importingWorks
    ? "Importing..."
    : `Import ${selectedWorks.length} works`}
</button>
          </div>
        </section>
      )}

      {/* Empty State */}
      {!channel && !loading && (
        <section className="mt-20 text-center">
          <p className="text-sm text-zinc-400">
            YouTube 채널을 입력하면 영상이 여기에 표시됩니다.
          </p>
        </section>
      )}
    </main>
  );
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}