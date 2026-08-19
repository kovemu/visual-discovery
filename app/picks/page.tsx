"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PickRow = {
  work_id: string;
  artist_id: string;
};

type ArtistRow = {
  id: string;
  name: string;
};

type PickedArtist = {
  artistId: string;
  artistName: string;
  count: number;
};

export default function PicksPage() {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [artists, setArtists] =
    useState<PickedArtist[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function loadPicks() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // 사용자의 Pick 불러오기
      const {
        data: picks,
        error: picksError,
      } = await supabase
        .from("work_picks")
        .select("work_id, artist_id")
        .eq("user_id", user.id);

      if (picksError) {
        console.error(
          "LOAD PICKS ERROR:",
          picksError,
        );

        setLoading(false);
        return;
      }

      const pickRows =
        (picks ?? []) as PickRow[];

      if (pickRows.length === 0) {
        setArtists([]);
        setLoading(false);
        return;
      }

      // Artist별 Pick 개수 계산
      const artistCounts =
        new Map<string, number>();

      for (const pick of pickRows) {
        artistCounts.set(
          pick.artist_id,
          (artistCounts.get(
            pick.artist_id,
          ) ?? 0) + 1,
        );
      }

      const artistIds =
        Array.from(
          artistCounts.keys(),
        );

      // Artist 이름 불러오기
      const {
        data: artistData,
        error: artistError,
      } = await supabase
        .from("creators")
        .select("id, name")
        .in("id", artistIds);

      if (artistError) {
        console.error(
          "LOAD ARTISTS ERROR:",
          artistError,
        );

        setLoading(false);
        return;
      }

      const artistRows =
        (artistData ?? []) as ArtistRow[];

      const grouped =
        artistRows
          .map((artist) => ({
            artistId: artist.id,
            artistName: artist.name,
            count:
              artistCounts.get(
                artist.id,
              ) ?? 0,
          }))
          .sort(
            (a, b) =>
              b.count - a.count,
          );

      setArtists(grouped);
      setLoading(false);
    }

    loadPicks();
  }, [supabase]);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
        <p className="text-sm text-gray-500">
          Loading picks...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-600">
          Your discovery
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950">
          Your Picks
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Artists you discovered through Kovemu.
        </p>
      </div>

      {artists.length > 0 ? (
        <div className="mt-10 divide-y divide-gray-100 border-y border-gray-100">
          {artists.map((artist) => (
            <Link
              key={artist.artistId}
              href={`/creator/${artist.artistId}`}
              className="flex items-center justify-between py-5 transition hover:opacity-60"
            >
              <span className="text-base font-bold text-gray-950">
                {artist.artistName}
              </span>

              <span className="text-sm font-semibold text-fuchsia-600">
                {artist.count}{" "}
                {artist.count === 1
                  ? "Pick"
                  : "Picks"}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-12 rounded-2xl border border-gray-100 p-8 text-center">
          <p className="font-bold text-gray-900">
            No Picks yet
          </p>

          <p className="mt-2 text-sm text-gray-500">
            Pick works you like while discovering artists.
          </p>

          <Link
            href="/"
            className="mt-5 inline-flex rounded-full bg-fuchsia-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-fuchsia-700"
          >
            Start Discovering
          </Link>
        </div>
      )}
    </main>
  );
}