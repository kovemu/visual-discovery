"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import AuthModal from "@/components/AuthModal";
import { createClient } from "@/lib/supabase/client";

type PickPanelWork = {
  id: string;
  artistId: string;
  artistName: string;
  category?: string;
  image?: string;
  videoId?: string;
  type?: "image" | "youtube" | "tiktok";
  caption?: string | null;
  sourceUrl?: string;
};

type PickedWorkRow = {
  id: number | string;
  source: string;
  source_id: string | null;
  source_url: string;
  thumbnail_url: string | null;
  title: string | null;
  description: string | null;
  artist: {
    id: string;
    name: string;
    category: string;
  } | {
    id: string;
    name: string;
    category: string;
  }[] | null;
};

type PickRow = {
  work_id: number | string;
  artist_id: string;
  created_at: string;
  work:
    | PickedWorkRow
    | PickedWorkRow[]
    | null;
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
    work: PickPanelWork,
  ) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (
    open: boolean,
  ) => void;
  plusOneKey?: number;
};

function mapPickedWork(
  work: PickedWorkRow,
): PickPanelWork | null {
  const artist =
    Array.isArray(work.artist)
      ? work.artist[0]
      : work.artist;

  if (!artist) {
    return null;
  }

  const isYoutube =
    work.source === "youtube" &&
    Boolean(work.source_id);
  const isTikTok =
    work.source === "tiktok" &&
    Boolean(work.source_id);

  return {
    id: String(work.id),
    artistId: artist.id,
    artistName: artist.name,
    category:
      artist.category,
    type: isYoutube
      ? "youtube"
      : isTikTok
        ? "tiktok"
        : "image",
    videoId: isYoutube || isTikTok
      ? work.source_id ?? undefined
      : undefined,
    image:
      work.thumbnail_url ??
      (isYoutube || isTikTok
        ? undefined
        : work.source_url),
    caption:
      work.description ??
      work.title ??
      null,
    sourceUrl: work.source_url,
  };
}

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

function isCoarsePointer(
  event: ReactPointerEvent,
) {
  return (
    event.pointerType === "touch" ||
    event.pointerType === "pen"
  );
}

function hitTestPickCardId(
  clientX: number,
  clientY: number,
  artistId: string,
) {
  const nodes =
    document.elementsFromPoint(
      clientX,
      clientY,
    );

  for (const node of nodes) {
    if (!(node instanceof Element)) {
      continue;
    }

    const card = node.closest(
      "[data-pick-card-id]",
    );

    if (!(card instanceof HTMLElement)) {
      continue;
    }

    if (
      card.dataset.pickStack !== artistId
    ) {
      continue;
    }

    return card.dataset.pickCardId ?? null;
  }

  return null;
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
  mobileOpen = false,
  onMobileOpenChange,
  plusOneKey = 0,
}: MyPicksPanelProps) {
  const router = useRouter();
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [open, setOpen] =
    useState(false);

  const handleSwipeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const closeZoneSwipeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    captured: boolean;
  } | null>(null);
  const cardScrubRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    artistId: string;
    mode: "undecided" | "scrub" | "scroll";
    captured: boolean;
  } | null>(null);
  const suppressCardClickRef = useRef(false);
  const ignoreHandleClickRef = useRef(false);

  const [
    isAuthenticated,
    setIsAuthenticated,
  ] = useState(false);

  const [
    showAuthModal,
    setShowAuthModal,
  ] = useState(false);

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
    authVersion,
    setAuthVersion,
  ] = useState(0);

  const [
    hoveredArtistId,
    setHoveredArtistId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    scrubArtistId,
    setScrubArtistId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    scrubWorkId,
    setScrubWorkId,
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

  useEffect(() => {
    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (event, session) => {
          setIsAuthenticated(
            Boolean(
              session?.user,
            ),
          );

          if (
            event ===
              "SIGNED_OUT" ||
            !session?.user
          ) {
            setPickRows([]);
            setLoading(false);
          }

          if (
            event === "SIGNED_IN"
          ) {
            setPickRows([]);
            setLoading(true);
          }

          if (
            event !==
            "INITIAL_SESSION"
          ) {
            setAuthVersion(
              (current) =>
                current + 1,
            );
          }
        },
      );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!mobileOpen) {
      cardScrubRef.current = null;
      closeZoneSwipeRef.current = null;
      setScrubArtistId(null);
      setScrubWorkId(null);
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [mobileOpen]);

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
        setIsAuthenticated(false);
        setPickRows([]);
        setLoading(false);
        return;
      }

      setIsAuthenticated(true);

      const {
        data,
        error,
      } =
        await supabase
          .from("work_picks")
          .select(
            `
              work_id,
              artist_id,
              created_at,
              work:works (
                id,
                source,
                source_id,
                source_url,
                thumbnail_url,
                title,
                description,
                artist:creators (
                  id,
                  name,
                  category
                )
              )
            `,
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
        (data ??
          []) as unknown as PickRow[],
      );

      setLoading(false);
    }

    loadPicks();
  }, [
    supabase,
    pulseKey,
    refreshKey,
    authVersion,
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
      const map = new Map(
        works.map(
          (work) => [
            String(
              work.id,
            ),
            work,
          ],
        ),
      );

      for (const pick of pickRows) {
        if (!pick.work) {
          continue;
        }

        const workRow =
          Array.isArray(pick.work)
            ? pick.work[0]
            : pick.work;

        if (!workRow) {
          continue;
        }

        const pickedWork =
          mapPickedWork(
            workRow,
          );

        if (pickedWork) {
          map.set(
            pickedWork.id,
            pickedWork,
          );
        }
      }

      return map;
    }, [
      works,
      pickRows,
    ]);

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

  function handleViewAllClick() {
    if (isAuthenticated) {
      router.push("/me");
      return;
    }

    setShowAuthModal(true);
  }

  function openMobileDrawer() {
    onMobileOpenChange?.(true);
  }

  function closeMobileDrawer() {
    cardScrubRef.current = null;
    closeZoneSwipeRef.current = null;
    setScrubArtistId(null);
    setScrubWorkId(null);
    onMobileOpenChange?.(false);
  }

  function resetCardScrub() {
    cardScrubRef.current = null;
    setScrubArtistId(null);
    setScrubWorkId(null);
  }

  function onHandlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    handleSwipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    ignoreHandleClickRef.current =
      false;
    event.currentTarget.setPointerCapture(
      event.pointerId,
    );
  }

  function onHandlePointerMove(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const state = handleSwipeRef.current;

    if (
      !state ||
      state.pointerId !== event.pointerId
    ) {
      return;
    }

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;

    if (
      Math.abs(dx) > 10 ||
      Math.abs(dy) > 10
    ) {
      state.moved = true;
    }
  }

  function onHandlePointerUp(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const state = handleSwipeRef.current;

    if (
      !state ||
      state.pointerId !== event.pointerId
    ) {
      return;
    }

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    handleSwipeRef.current = null;

    if (
      dx < -48 &&
      Math.abs(dx) > Math.abs(dy)
    ) {
      ignoreHandleClickRef.current =
        true;
      openMobileDrawer();
      return;
    }

    if (state.moved) {
      ignoreHandleClickRef.current =
        true;
    }
  }

  function onHandleClick() {
    if (ignoreHandleClickRef.current) {
      ignoreHandleClickRef.current =
        false;
      return;
    }

    openMobileDrawer();
  }

  function onCloseZonePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!mobileOpen) {
      return;
    }

    closeZoneSwipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      captured: false,
    };
  }

  function onCloseZonePointerMove(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const state = closeZoneSwipeRef.current;

    if (
      !state ||
      state.pointerId !== event.pointerId
    ) {
      return;
    }

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;

    if (
      state.captured ||
      !(
        Math.abs(dx) > 12 &&
        Math.abs(dx) >
          Math.abs(dy) * 1.2
      )
    ) {
      return;
    }

    state.captured = true;

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );
  }

  function onCloseZonePointerUp(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const state = closeZoneSwipeRef.current;

    if (
      !state ||
      state.pointerId !== event.pointerId
    ) {
      return;
    }

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;

    if (state.captured) {
      try {
        event.currentTarget.releasePointerCapture(
          event.pointerId,
        );
      } catch {
        // pointer already released
      }
    }

    closeZoneSwipeRef.current = null;

    if (
      dx > 56 &&
      Math.abs(dx) >
        Math.abs(dy) * 1.2
    ) {
      closeMobileDrawer();
    }
  }

  function onStackPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    artistId: string,
  ) {
    if (!isCoarsePointer(event)) {
      return;
    }

    suppressCardClickRef.current = true;
    cardScrubRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      artistId,
      mode: "undecided",
      captured: false,
    };
  }

  function onStackPointerMove(
    event: ReactPointerEvent<HTMLDivElement>,
    artistId: string,
  ) {
    const state = cardScrubRef.current;

    if (
      !state ||
      state.pointerId !== event.pointerId ||
      state.artistId !== artistId ||
      state.mode === "scroll"
    ) {
      return;
    }

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (state.mode === "undecided") {
      if (Math.max(absDx, absDy) < 8) {
        return;
      }

      if (absDy > absDx * 1.15) {
        state.mode = "scroll";
        resetCardScrub();
        return;
      }

      if (absDx > absDy * 1.15) {
        state.mode = "scrub";
        setScrubArtistId(artistId);
        setScrubWorkId(
          hitTestPickCardId(
            event.clientX,
            event.clientY,
            artistId,
          ),
        );
        state.captured = true;
        event.currentTarget.setPointerCapture(
          event.pointerId,
        );
      }

      return;
    }

    setScrubWorkId(
      hitTestPickCardId(
        event.clientX,
        event.clientY,
        artistId,
      ),
    );
  }

  function onStackPointerUp(
    event: ReactPointerEvent<HTMLDivElement>,
    artist: PickedArtist,
  ) {
    const state = cardScrubRef.current;

    if (
      !state ||
      state.pointerId !== event.pointerId ||
      state.artistId !== artist.artistId
    ) {
      return;
    }

    if (state.captured) {
      try {
        event.currentTarget.releasePointerCapture(
          event.pointerId,
        );
      } catch {
        // pointer already released
      }
    }

    const mode = state.mode;
    cardScrubRef.current = null;

    if (mode === "scroll") {
      setScrubArtistId(null);
      setScrubWorkId(null);
      return;
    }

    const cardId = hitTestPickCardId(
      event.clientX,
      event.clientY,
      artist.artistId,
    );

    setScrubArtistId(null);
    setScrubWorkId(null);

    if (!cardId) {
      return;
    }

    const work = artist.works.find(
      (item) => item.id === cardId,
    );

    if (work) {
      onWorkClick(work);
    }
  }

  function onStackPointerCancel() {
    resetCardScrub();
  }

  const picksPanelContent = (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-gray-950">
          My Picks
        </h2>

        <button
          type="button"
          onClick={handleViewAllClick}
          className="text-xs font-semibold text-fuchsia-600 transition hover:text-fuchsia-700"
        >
          View all →
        </button>
      </div>

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
                  artist.artistId ||
                scrubArtistId ===
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

                  <div
                    className="relative mt-3 h-[126px] touch-pan-y"
                    onPointerDown={(
                      event,
                    ) =>
                      onStackPointerDown(
                        event,
                        artist.artistId,
                      )
                    }
                    onPointerMove={(
                      event,
                    ) =>
                      onStackPointerMove(
                        event,
                        artist.artistId,
                      )
                    }
                    onPointerUp={(
                      event,
                    ) =>
                      onStackPointerUp(
                        event,
                        artist,
                      )
                    }
                    onPointerCancel={
                      onStackPointerCancel
                    }
                  >
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
                          !thumbnail &&
                          work.type !==
                            "tiktok"
                        ) {
                          return null;
                        }

                        const gap =
                          expanded ? 36 : 21;

                        const right =
                          hiddenCount > 0
                            ? (visibleWorks.length - index) * gap
                            : (visibleWorks.length - 1 - index) * gap;

                        const isScrubActive =
                          scrubWorkId ===
                          work.id;

                        return (
                          <button
                            key={
                              work.id
                            }
                            type="button"
                            data-pick-card-id={
                              work.id
                            }
                            data-pick-stack={
                              artist.artistId
                            }
                            onClick={(
                              event,
                            ) => {
                              if (
                                suppressCardClickRef.current
                              ) {
                                event.preventDefault();
                                event.stopPropagation();
                                suppressCardClickRef.current =
                                  false;
                                return;
                              }

                              onWorkClick(
                                work,
                              );
                            }}
                            className={`absolute top-0 h-[120px] w-[86px] overflow-hidden rounded-xl border-2 border-white bg-gray-100 shadow-md transition-all duration-300 ease-out hover:-translate-y-2 ${
                              isScrubActive
                                ? "-translate-y-2 scale-[1.03] shadow-lg"
                                : ""
                            }`}
                            style={{
                              right: `${right}px`,
                              zIndex:
                                isScrubActive
                                  ? visibleWorks.length +
                                    10
                                  : visibleWorks.length -
                                    index +
                                    2,
                            }}
                            aria-label={`Open ${artist.artistName} work`}
                          >
                            {thumbnail ? (
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
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-[10px] font-semibold text-white/50">
                                TikTok
                              </div>
                            )}
                          </button>
                        );
                      },
                    )}

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
    </>
  );

  return (
    <>
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
        className={`relative h-full border-l bg-white transition-all duration-300 ${
          open
            ? showAdded
              ? "border-gray-200 shadow-[-8px_0_30px_rgba(217,70,239,0.18)]"
              : "border-gray-200 shadow-[-8px_0_24px_rgba(0,0,0,0.04)]"
            : "border-gray-200 shadow-[-8px_0_24px_rgba(0,0,0,0.04)]"
        }`}
      >
        {/* Toggle */}
        <button
          type="button"
          aria-label={
            open
              ? "Collapse My Picks panel"
              : "Expand My Picks panel"
          }
          className={`absolute top-1/2 transition-colors ${
            open
              ? "left-0 flex h-[46px] w-[30px] -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-gray-200 bg-white text-gray-500 shadow-[-2px_0_8px_rgba(0,0,0,0.06)] hover:text-fuchsia-600"
              : "left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-gray-400 transition hover:text-fuchsia-600"
          }`}
        >
          {open ? (
            <ChevronRight
              size={16}
            />
          ) : (
            <>
            <div className="flex items-center -space-x-3">
              <ChevronLeft
                size={32}
                strokeWidth={1.15}
              />
              <ChevronLeft
                size={32}
                strokeWidth={1.15}
              />
              <ChevronLeft
                size={32}
                strokeWidth={1.15}
              />
            </div>
          
            <div className="mt-2 text-center leading-[1.45]">
              <div className="text-[12px] font-medium tracking-[0.22em]">
                My
              </div>
              <div className="text-[12px] font-medium tracking-[0.22em]">
                picks
              </div>
            </div>

            
          </>
          )}
        </button>
{/* Collapsed Pick feedback */}
{!open && showAdded && (
  <>
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-[150px] w-[88px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-300/30 blur-3xl" />

    <span className="pointer-events-none absolute left-1/2 top-[calc(50%+67px)] -translate-x-1/2 animate-[pickPulse_1.4s_ease-out_forwards] whitespace-nowrap text-sm font-bold text-fuchsia-400">
      +{addedCount}
    </span>
  </>
)}
        {/* 펼친 Panel */}
<div
  className={`h-full overflow-x-hidden overflow-y-auto pb-10 pl-[78px] pr-5 pt-7 transition-opacity duration-100 ${
    open
      ? "opacity-100"
      : "pointer-events-none opacity-0"
  }`}
>
  {picksPanelContent}
</div>
        
      </div>
    </div>

    {onMobileOpenChange && (
      <>
        <button
          type="button"
          aria-label="Open My Picks"
          aria-expanded={mobileOpen}
          onClick={onHandleClick}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          className={`fixed right-0 top-1/2 z-[52] flex h-[84px] w-12 -translate-y-1/2 translate-x-1 touch-none items-center justify-center rounded-l-2xl border border-r-0 border-gray-200/80 bg-white/75 shadow-[-2px_0_10px_rgba(0,0,0,0.06)] backdrop-blur-[2px] transition-opacity duration-200 xl:hidden ${
            mobileOpen
              ? "pointer-events-none opacity-0"
              : "opacity-100"
          }`}
        >
          <span
            className="relative block h-[18px] w-[22px]"
            aria-hidden="true"
          >
            <span className="absolute bottom-0 left-0 h-3 w-3.5 rounded-[3px] border border-gray-300 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]" />
            <span className="absolute bottom-[3px] left-[5px] h-3 w-3.5 rounded-[3px] border border-gray-300 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]" />
            <span className="absolute bottom-[6px] left-[10px] h-3 w-3.5 rounded-[3px] border border-gray-400 bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]" />
          </span>

          {plusOneKey > 0 && (
            <span
              key={plusOneKey}
              className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 animate-[pickPulse_0.65s_ease-out_forwards] whitespace-nowrap text-sm font-bold text-fuchsia-500"
            >
              +1
            </span>
          )}
        </button>

        <div
          className={`fixed inset-0 z-[55] bg-black/25 transition-opacity duration-300 xl:hidden ${
            mobileOpen
              ? "opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          onClick={closeMobileDrawer}
          aria-hidden={!mobileOpen}
        />

        <div
          className={`fixed inset-y-0 right-0 z-[56] w-[88vw] max-w-[380px] touch-pan-y border-l border-gray-200 bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.08)] transition-transform duration-300 xl:hidden ${
            mobileOpen
              ? "translate-x-0"
              : "pointer-events-none translate-x-full"
          }`}
        >
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 z-10 w-8 touch-none"
            onPointerDown={
              onCloseZonePointerDown
            }
            onPointerMove={
              onCloseZonePointerMove
            }
            onPointerUp={
              onCloseZonePointerUp
            }
            onPointerCancel={
              onCloseZonePointerUp
            }
          />

          <div className="relative h-full touch-pan-y overflow-x-hidden overflow-y-auto pb-10 pl-8 pr-5 pt-7">
            {picksPanelContent}
          </div>
        </div>
      </>
    )}

    <AuthModal
      open={showAuthModal}
      onClose={() =>
        setShowAuthModal(false)
      }
      onSuccess={() => {
        router.push("/me");
      }}
    />
    </>
  );
}