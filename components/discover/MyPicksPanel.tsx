"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

type PickPanelWork = {
  id: string;
  artistId: string;
  artistName: string;
  image?: string;
  videoId?: string;
  type?: "image" | "youtube";
};

type PickRow = {
  work_id: number | string;
  artist_id: string;
  created_at: string;
};

type PickedArtist = {
  artistId: string;
  artistName: string;
  count: number;
  works: PickPanelWork[];
};

type MyPicksPanelProps = {
  addedCount: number;
  pulseKey: number;
  refreshKey: number;
  works: PickPanelWork[];
  onWorkClick: (
    workId: string,
  ) => void;
};

function getThumbnail(
  work: PickPanelWork,
) {
  if (work.image) {
    return work.image;
  }

  if (
    work.type === "youtube" &&
    work.videoId
  ) {
    return `https://i.ytimg.com/vi/${work.videoId}/maxresdefault.jpg`;
  }

  return "";
}

function isToday(
  dateString: string,
) {
  const date =
    new Date(dateString);

  const today =
    new Date();

  return (
    date.getFullYear() ===
      today.getFullYear() &&
    date.getMonth() ===
      today.getMonth() &&
    date.getDate() ===
      today.getDate()
  );
}

export default function MyPicksPanel({
  addedCount,
  pulseKey,
  works,
  refreshKey,
  onWorkClick,
}: MyPicksPanelProps) {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [open, setOpen] =
    useState(false);

  const [
    showAdded,
    setShowAdded,
  ] = useState(false);

  const [
    filter,
    setFilter,
  ] =
    useState<
      "today" | "all"
    >("today");
  useEffect(() => {
  const savedFilter =
    window.localStorage.getItem(
      "kovemu-my-picks-filter",
    );

  if (
    savedFilter === "today" ||
    savedFilter === "all"
  ) {
    setFilter(
      savedFilter,
    );
  }
}, []);

  const [
    pickRows,
    setPickRows,
  ] = useState<PickRow[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    hoveredArtistId,
    setHoveredArtistId,
  ] =
    useState<string | null>(
      null,
    );
function changeFilter(
  nextFilter:
    | "today"
    | "all",
) {
  setFilter(
    nextFilter,
  );

  window.localStorage.setItem(
    "kovemu-my-picks-filter",
    nextFilter,
  );
}
  /*
    DB에서 Pick 목록 불러오기
  */
  useEffect(() => {
    async function loadPicks() {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        setPickRows([]);
        setLoading(false);
        return;
      }

      const {
        data,
        error,
      } =
        await supabase
          .from("work_picks")
          .select(
            "work_id, artist_id, created_at",
          )
          .eq(
            "user_id",
            user.id,
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          );

      if (error) {
        console.error(
          "LOAD MY PICKS ERROR:",
          error,
        );

        setLoading(false);
        return;
      }

      setPickRows(
        (data ?? []) as PickRow[],
      );

      setLoading(false);
    }

    loadPicks();
  }, [
    supabase,
    pulseKey,
    refreshKey,
  ]);

  /*
    +n effect
  */
  useEffect(() => {
    if (
      pulseKey === 0 ||
      addedCount <= 0
    ) {
      return;
    }

    setShowAdded(true);

    const timer =
      window.setTimeout(
        () => {
          setShowAdded(false);
        },
        1400,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    pulseKey,
    addedCount,
  ]);

  /*
    Today / All
  */
  const filteredRows =
    useMemo(() => {
      if (
        filter === "all"
      ) {
        return pickRows;
      }

      return pickRows.filter(
        (pick) =>
          isToday(
            pick.created_at,
          ),
      );
    }, [
      pickRows,
      filter,
    ]);

  /*
    Work 검색용 Map
  */
  const workMap =
    useMemo(() => {
      return new Map(
        works.map(
          (work) => [
            String(
              work.id,
            ),
            work,
          ],
        ),
      );
    }, [works]);

  /*
    Artist 단위 grouping
  */
  const pickedArtists =
    useMemo(() => {
      const artistMap =
        new Map<
          string,
          PickedArtist
        >();

      for (
        const pick of
        filteredRows
      ) {
        const work =
          workMap.get(
            String(
              pick.work_id,
            ),
          );

        if (!work) {
          continue;
        }

        const existing =
          artistMap.get(
            pick.artist_id,
          );

        if (existing) {
          existing.count += 1;

          existing.works.push(
            work,
          );

          continue;
        }

        artistMap.set(
          pick.artist_id,
          {
            artistId:
              pick.artist_id,

            artistName:
              work.artistName,

            count: 1,

            works: [
              work,
            ],
          },
        );
      }

      return Array.from(
        artistMap.values(),
      ).sort(
        (a, b) =>
          b.count -
          a.count,
      );
    }, [
      filteredRows,
      workMap,
    ]);

  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className={`fixed bottom-[69px] right-0 top-[72px] z-40 overflow-x-hidden hidden transition-all duration-100 xl:block ${
        open
          ? "w-[340px]"
          : "w-[100px]"
      }`} //픽창(pickpanel) 크기 조정
    >
      <div
        className={`relative h-full border-l border-gray-200 bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.04)] transition-all duration-300 ${
          showAdded
            ? "shadow-[-8px_0_30px_rgba(217,70,239,0.18)]"
            : ""
        }`}
      >
        {/* Toggle */}
        <button
          type="button"
          className="absolute left-0 top-1/2 flex h-[126px] w-[100px] -translate-y-1/2 flex-col items-center justify-center gap-3 border-y border-l border-gray-200 bg-white text-gray-600 transition hover:text-fuchsia-600"
        > 
          {open ? (
            <ChevronRight
              size={17}
            />
          ) : (
            <ChevronLeft
              size={17}
            />
          )}

          {!open && (
            <span
              className="text-xs font-bold tracking-wide"
              style={{
                writingMode:
                  "vertical-rl",
                transform:
                  "rotate(180deg)",
              }}
            >
              My Picks
            </span>
          )}
        </button>

        {/* 접힌 상태 +n */}
        {!open &&
          showAdded && (
            <div className="pointer-events-none absolute left-1/2 top-[calc(50%-92px)] -translate-x-1/2">
              <span className="animate-[pickPulse_1.4s_ease-out_forwards] whitespace-nowrap text-sm font-black text-fuchsia-600">
                +{addedCount}
              </span>
            </div>
          )}

        {/* 펼친 Panel */}
<div
  className={`h-full overflow-x-hidden overflow-y-auto pb-10 pl-[78px] pr-5 pt-7 transition-opacity duration-100 ${
    open
      ? "opacity-100"
      : "pointer-events-none opacity-0"
  }`}
>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-950">
                My Picks
              </h2>

              {showAdded && (
                <span className="animate-[pickPop_0.45s_ease-out] rounded-full bg-fuchsia-50 px-2.5 py-1 text-xs font-bold text-fuchsia-600">
                  +{addedCount}
                </span>
              )}
            </div>

            {/* Filter */}
            <div className="mt-4 flex items-center gap-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() =>
                  changeFilter(
                    "today",
                  )
                }
                className={
                  filter ===
                  "today"
                    ? "text-fuchsia-600"
                    : "text-gray-500 transition hover:text-gray-900"
                }
              >
                Today
              </button>

              <span className="text-gray-300">
                |
              </span>

              <button
                type="button"
                onClick={() =>
                  changeFilter(
                    "all",
                  )
                }
                className={
                  filter ===
                  "all"
                    ? "text-fuchsia-600"
                    : "text-gray-500 transition hover:text-gray-900"
                }
              >
                All
              </button>
            </div>

            {/* Artist List */}
            <div className="mt-8 space-y-10">
              {loading ? (
                <p className="text-xs text-gray-400">
                  Loading...
                </p>
              ) : pickedArtists.length ===
                0 ? (
                <p className="text-sm leading-6 text-gray-400">
                  {filter ===
                  "today"
                    ? "No Picks today."
                    : "No Picks yet."}
                </p>
              ) : (
                pickedArtists.map(
                  (artist) => {
                    /*
                      Artist당 최대 5개
                    */
                    const visibleWorks =
                      artist.works.slice(
                        0,
                        5,
                      );

                    const hiddenCount =
                      Math.max(
                        0,
                        artist.count -
                          visibleWorks.length,
                      );

                    const expanded =
                      hoveredArtistId ===
                      artist.artistId;

                    return (
                      <div
                        key={
                          artist.artistId
                        }
                        onMouseEnter={() =>
                          setHoveredArtistId(
                            artist.artistId,
                          )
                        }
                        onMouseLeave={() =>
                          setHoveredArtistId(
                            null,
                          )
                        }
                      >
                        {/* Artist header */}
                        <div className="flex items-center justify-between gap-3">
                          <Link
                            href={`/creator/${artist.artistId}`}
                            className="min-w-0 truncate text-sm font-bold text-gray-950 transition hover:text-fuchsia-600"
                          >
                            {
                              artist.artistName
                            }
                          </Link>

                          <span className="shrink-0 text-[11px] font-semibold text-gray-400">
                            {
                              artist.count
                            }{" "}
                            {artist.count ===
                            1
                              ? "Pick"
                              : "Picks"}
                          </span>
                        </div>

                        {/* Work Stack */}
                        <div className="relative mt-3 h-[126px]">
                          {visibleWorks.map(
                            (
                              work,
                              index,
                            ) => {
                              const thumbnail =
                                getThumbnail(
                                  work,
                                );

                              if (
                                !thumbnail
                              ) {
                                return null;
                              }

                              /*
                                평소 21px 간격.
                                Hover 시 36px 간격.

                                첫 카드가 최상단.
                                오른쪽 카드일수록 아래에 깔림.
                              */
                              const gap =
  expanded ? 36 : 21;

const right =
  hiddenCount > 0
    ? (visibleWorks.length - index) * gap
    : (visibleWorks.length - 1 - index) * gap;

                              return (
                                <button
                                  key={
                                    work.id
                                  }
                                  type="button"
                                  onClick={() =>
                                    onWorkClick(
                                      String(
                                        work.id,
                                      ),
                                    )
                                  }
                                  className="absolute top-0 h-[120px] w-[86px] overflow-hidden rounded-xl border-2 border-white bg-gray-100 shadow-md transition-all duration-300 ease-out hover:-translate-y-2"
                                  style={{
                                    right: `${right}px`,

                                    zIndex:
                                      visibleWorks.length -
                                      index +
                                      2,
                                  }}
                                  aria-label={`Open ${artist.artistName} work`}
                                >
                                  <img
                                    src={
                                      thumbnail
                                    }
                                    alt=""
                                    draggable={
                                      false
                                    }
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                              );
                            },
                          )}

                          {/* +N */}
                          {hiddenCount >
                            0 && (
                            <div
                              className="absolute top-0 flex h-[120px] w-[86px] items-center justify-end rounded-xl border-2 border-white bg-gray-950 pr-3 text-base font-black text-white shadow-md transition-all duration-300"
                              style={{
  right: "0px",
  zIndex: 1,
}}
                            >
                              +
                              {
                                hiddenCount
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  },
                )
              )}
            </div>
          </div>
        
      </div>
    </div>
  );
}