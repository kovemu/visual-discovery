"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import MyPicksPanel from "@/components/discover/MyPicksPanel";
import { createClient } from "@/lib/supabase/client";

type ProfilePickWork = {
  id: string;
  artistId: string;
  artistName: string;
  category: string;

  image?: string;
  videoId?: string;
  type?: "image" | "youtube";

  caption?: string | null;
};

type DbWorkRow = {
  id: number;
  artist_id: string;
  source: string;
  source_id: string | null;
  source_url: string;
  thumbnail_url: string | null;
  title: string | null;
  description: string | null;
};

type DbArtistRow = {
  id: string;
  name: string;
  category: string;
};

export default function ProfileMyPicks() {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [
    works,
    setWorks,
  ] = useState<ProfilePickWork[]>(
    [],
  );

  const [
    pickedWorkIds,
    setPickedWorkIds,
  ] = useState<Set<string>>(
    new Set(),
  );

  const [
    selectedWork,
    setSelectedWork,
  ] =
    useState<ProfilePickWork | null>(
      null,
    );

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0);

  /*
    Profile에는 Discover의 전체 works가 없으므로
    현재 사용자가 Pick한 Works를 DB에서 가져온다.
  */
  useEffect(() => {
    async function loadWorks() {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        setWorks([]);
        setPickedWorkIds(
          new Set(),
        );
        return;
      }

      const {
        data: pickData,
        error: pickError,
      } =
        await supabase
          .from("work_picks")
          .select(
            "work_id, artist_id",
          )
          .eq(
            "user_id",
            user.id,
          );

      if (pickError) {
        console.error(
          "LOAD PROFILE PICKS ERROR:",
          pickError,
        );
        return;
      }

      const picks =
        pickData ?? [];

      const workIds =
        Array.from(
          new Set(
            picks.map(
              (pick) =>
                Number(
                  pick.work_id,
                ),
            ),
          ),
        ).filter(
          Number.isFinite,
        );

      const artistIds =
        Array.from(
          new Set(
            picks.map(
              (pick) =>
                String(
                  pick.artist_id,
                ),
            ),
          ),
        );

      setPickedWorkIds(
        new Set(
          picks.map(
            (pick) =>
              String(
                pick.work_id,
              ),
          ),
        ),
      );

      if (
        workIds.length === 0
      ) {
        setWorks([]);
        return;
      }

      const {
        data: workData,
        error: workError,
      } =
        await supabase
          .from("works")
          .select(`
            id,
            artist_id,
            source,
            source_id,
            source_url,
            thumbnail_url,
            title,
            description
          `)
          .in(
            "id",
            workIds,
          );

      if (workError) {
        console.error(
          "LOAD PROFILE PICK WORKS ERROR:",
          workError,
        );
        return;
      }

      const {
        data: artistData,
        error: artistError,
      } =
        await supabase
          .from("creators")
          .select(
            "id, name, category",
          )
          .in(
            "id",
            artistIds,
          );

      if (artistError) {
        console.error(
          "LOAD PROFILE PICK ARTISTS ERROR:",
          artistError,
        );
        return;
      }

      const dbWorks =
        (workData ??
          []) as DbWorkRow[];

      const dbArtists =
        (artistData ??
          []) as DbArtistRow[];

      const artistMap =
        new Map(
          dbArtists.map(
            (artist) => [
              artist.id,
              artist,
            ],
          ),
        );

      const convertedWorks =
        dbWorks.map(
          (work) => {
            const artist =
              artistMap.get(
                work.artist_id,
              );

            const youtube =
              work.source ===
              "youtube";

            return {
              id: String(
                work.id,
              ),

              artistId:
                work.artist_id,

              artistName:
                artist?.name ??
                "Unknown Artist",

              category:
                artist?.category ??
                "",

              type: youtube
                ? "youtube"
                : "image",

              videoId:
                youtube
                  ? work.source_id ??
                    undefined
                  : undefined,

              image:
                work.thumbnail_url ??
                (!youtube
                  ? work.source_url
                  : undefined),

              caption:
                work.description ??
                work.title ??
                null,
            } satisfies ProfilePickWork;
          },
        );

      setWorks(
        convertedWorks,
      );
    }

    loadWorks();
  }, [
    supabase,
    refreshKey,
  ]);

  async function togglePick(
    work: ProfilePickWork,
  ) {
    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const workId =
      String(work.id);

    const alreadyPicked =
      pickedWorkIds.has(
        workId,
      );

    if (alreadyPicked) {
      const { error } =
        await supabase
          .from("work_picks")
          .delete()
          .eq(
            "user_id",
            user.id,
          )
          .eq(
            "work_id",
            workId,
          );

      if (error) {
        console.error(
          "REMOVE PICK ERROR:",
          error,
        );
        return;
      }

      setPickedWorkIds(
        (current) => {
          const next =
            new Set(current);

          next.delete(
            workId,
          );

          return next;
        },
      );

      return;
    }

    const { error } =
      await supabase
        .from("work_picks")
        .insert({
          user_id:
            user.id,

          work_id:
            workId,

          artist_id:
            work.artistId,
        });

    if (error) {
      console.error(
        "SAVE PICK ERROR:",
        error,
      );
      return;
    }

    setPickedWorkIds(
      (current) => {
        const next =
          new Set(current);

        next.add(
          workId,
        );

        return next;
      },
    );
  }

  function closeWorkModal() {
    setSelectedWork(null);

    /*
      MyPicksPanel도 Supabase 최신 상태 재조회.
    */
    setRefreshKey(
      (current) =>
        current + 1,
    );
  }

  return (
    <>
      <MyPicksPanel
        addedCount={0}
        pulseKey={0}
        refreshKey={refreshKey}
        works={works}
        onWorkClick={(workId) => {
          const work =
            works.find(
              (item) =>
                String(
                  item.id,
                ) ===
                String(
                  workId,
                ),
            );

          if (work) {
            setSelectedWork(
              work,
            );
          }
        }}
      />

      {selectedWork && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={
            closeWorkModal
          }
        >
          <div
            className="relative flex max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
          >
            <div className="flex min-w-0 flex-1 items-center justify-center bg-neutral-900">
              {selectedWork.type ===
                "youtube" &&
              selectedWork.videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${selectedWork.videoId}?autoplay=1&rel=0`}
                  title={`${selectedWork.artistName} video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="aspect-[9/16] max-h-[80vh] w-full"
                />
              ) : (
                <img
                  src={
                    selectedWork.image
                  }
                  alt={`${selectedWork.artistName} work`}
                  draggable={
                    false
                  }
                  className="max-h-[80vh] w-full object-contain"
                />
              )}
            </div>

            <aside className="relative w-[300px] shrink-0 bg-white p-6">
              <button
                type="button"
                onClick={
                  closeWorkModal
                }
                aria-label="Close work"
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-600 transition hover:bg-gray-200 hover:text-gray-950"
              >
                ×
              </button>

              <div className="pr-10">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-600">
                  {
                    selectedWork.category
                  }
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-950">
                  {
                    selectedWork.artistName
                  }
                </h2>
              </div>

              {selectedWork.caption && (
                <p className="mt-5 line-clamp-[8] text-sm leading-6 text-gray-600">
                  {
                    selectedWork.caption
                  }
                </p>
              )}

              <button
                type="button"
                onClick={() =>
                  togglePick(
                    selectedWork,
                  )
                }
                className={`mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full border text-sm font-bold transition ${
                  pickedWorkIds.has(
                    String(
                      selectedWork.id,
                    ),
                  )
                    ? "border-fuchsia-600 bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                    : "border-gray-200 bg-white text-gray-800 hover:border-fuchsia-200 hover:text-fuchsia-600"
                }`}
              >
                <span>
                  {pickedWorkIds.has(
                    String(
                      selectedWork.id,
                    ),
                  )
                    ? "✓"
                    : "+"}
                </span>

                {pickedWorkIds.has(
                  String(
                    selectedWork.id,
                  ),
                )
                  ? "Picked"
                  : "Pick"}
              </button>

              <Link
                href={`/creator/${selectedWork.artistId}`}
                onClick={
                  closeWorkModal
                }
                className="mt-3 flex h-11 w-full items-center justify-center rounded-full bg-gray-950 px-5 text-sm font-bold text-white transition hover:bg-gray-800"
              >
                View Artist Profile
              </Link>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}