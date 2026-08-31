"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { FeedItem } from "@/components/discover/DiscoverFeed";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import RotatedWorkThumbnail from "@/components/works/RotatedWorkThumbnail";
import {
  formatDurationSeconds,
  getWorkThumbnail,
} from "@/lib/works/workDisplay";

const CAROUSEL_GAP = 12;
const CARD_PORTRAIT_RATIO = 2.35;
const PREFETCH_CARD_THRESHOLD = 9;   ///다음 카드로딩 9개전
const LEFT_BUFFER_CARDS = 5;
const MIN_WINDOW_CARDS = 8;
const WHEEL_MULTIPLIER = 1.85;
const WHEEL_LERP_FACTOR = 0.28;
const WHEEL_SCROLL_SNAP_EPS = 0.5;
const DRAG_MULTIPLIER = 1.28;
const DRAG_THRESHOLD_PX = 8;
const SCROLL_EDGE_EPS = 2;

type DiscoverCarouselProps = {
  works: FeedItem[];
  pickedWorkIds: Set<string>;
  isLoading: boolean;
  isLoadingMore?: boolean;
  onWorkClick: (work: FeedItem) => void;
  onNearEnd?: () => void;
  onPrune?: (workIds: string[]) => void;
};

function getVisibleCardTarget(
  trackWidth: number,
): number {
  if (trackWidth < 480) {
    return 2.2;
  }

  if (trackWidth < 768) {
    return 3.0;
  }

  if (trackWidth < 1024) {
    return 3.6;
  }

  if (trackWidth < 1280) {
    return 5.8;
  }

  return 6.9;
}

function getCarouselCardWidth(
  trackWidth: number,
): number {
  const target =
    getVisibleCardTarget(trackWidth);
  const gapSlots = Math.max(
    1,
    Math.floor(target),
  );

  return Math.max(
    120,
    Math.round(
      (trackWidth -
        gapSlots * CAROUSEL_GAP) /
        target,
    ),
  );
}

const ARROW_SCROLL_CARD_COUNT = 3;
const ARROW_APPEND_MAX_ATTEMPTS = 3;
const ARROW_SCROLL_TIMEOUT_MS = 900;
const ARROW_FEED_GROW_TIMEOUT_MS = 10000;

function getArrowScrollDistance(
  track: HTMLDivElement,
  fallbackStride: number,
): number {
  const cards = track.querySelectorAll<HTMLElement>(
    "[data-carousel-card]",
  );

  if (cards.length === 0) {
    return fallbackStride * ARROW_SCROLL_CARD_COUNT;
  }

  const firstCard = cards[0];
  const cardWidthActual =
    firstCard.getBoundingClientRect().width;

  let gap = CAROUSEL_GAP;

  if (cards.length > 1) {
    const secondCard = cards[1];
    const measuredGap =
      secondCard.offsetLeft -
      firstCard.offsetLeft -
      firstCard.offsetWidth;

    if (
      Number.isFinite(measuredGap) &&
      measuredGap >= 0
    ) {
      gap = measuredGap;
    }
  }

  return (
    (cardWidthActual + gap) *
    ARROW_SCROLL_CARD_COUNT
  );
}

function getTrackMaxScrollLeft(
  track: HTMLDivElement,
) {
  return Math.max(
    0,
    track.scrollWidth - track.clientWidth,
  );
}

function needsRightArrowRoom(
  track: HTMLDivElement,
  distance: number,
) {
  return (
    track.scrollLeft + distance >
    getTrackMaxScrollLeft(track) +
      SCROLL_EDGE_EPS
  );
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

function waitForLoadingComplete(
  isLoadingMoreRef: RefObject<boolean>,
) {
  return new Promise<void>((resolve) => {
    const startedAt = Date.now();

    const check = () => {
      if (
        !isLoadingMoreRef.current ||
        Date.now() - startedAt >=
          ARROW_FEED_GROW_TIMEOUT_MS
      ) {
        resolve();
        return;
      }

      requestAnimationFrame(check);
    };

    requestAnimationFrame(check);
  });
}

function waitForFeedGrowth(
  track: HTMLDivElement,
  previousScrollWidth: number,
  previousWorksLength: number,
  worksRef: RefObject<FeedItem[]>,
) {
  return new Promise<void>((resolve) => {
    const startedAt = Date.now();

    const check = () => {
      const grew =
        track.scrollWidth >
          previousScrollWidth +
            SCROLL_EDGE_EPS ||
        worksRef.current.length >
          previousWorksLength;

      if (
        grew ||
        Date.now() - startedAt >=
          ARROW_FEED_GROW_TIMEOUT_MS
      ) {
        void waitForNextFrame().then(resolve);
        return;
      }

      requestAnimationFrame(check);
    };

    requestAnimationFrame(check);
  });
}

function smoothScrollTo(
  track: HTMLDivElement,
  left: number,
) {
  return new Promise<void>((resolve) => {
    const targetLeft = Math.max(0, left);
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      track.removeEventListener(
        "scrollend",
        finish,
      );
      window.clearTimeout(fallbackTimer);
      resolve();
    };

    track.addEventListener(
      "scrollend",
      finish,
      { once: true },
    );

    const fallbackTimer = window.setTimeout(
      finish,
      ARROW_SCROLL_TIMEOUT_MS,
    );

    track.scrollTo({
      left: targetLeft,
      behavior: "smooth",
    });
  });
}

export default function DiscoverCarousel({
  works,
  pickedWorkIds,
  isLoading,
  isLoadingMore = false,
  onWorkClick,
  onNearEnd,
  onPrune,
}: DiscoverCarouselProps) {
  const { t } = useTranslation();
  const trackRef =
    useRef<HTMLDivElement | null>(
      null,
    );
  const dragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });
  const suppressClickRef = useRef(false);
  const pendingScrollAdjustRef = useRef(0);
  const worksRef = useRef(works);

  const [trackWidth, setTrackWidth] =
    useState(0);
  const [isDragging, setIsDragging] =
    useState(false);
  const [
    canScrollLeft,
    setCanScrollLeft,
  ] = useState(false);
  const [
    canScrollRight,
    setCanScrollRight,
  ] = useState(true);

  const suppressPruneRef = useRef(false);
  const arrowScrollInProgressRef = useRef(false);
  const onNearEndRef = useRef(onNearEnd);
  const isLoadingMoreRef = useRef(isLoadingMore);
  const targetScrollLeftRef = useRef(0);
  const wheelRafRef = useRef<number | null>(null);
  const tickWheelSmoothingRef = useRef<() => void>(
    () => {},
  );

  onNearEndRef.current = onNearEnd;
  isLoadingMoreRef.current = isLoadingMore;

  worksRef.current = works;

  const cancelWheelSmoothing = useCallback(() => {
    if (wheelRafRef.current !== null) {
      cancelAnimationFrame(wheelRafRef.current);
      wheelRafRef.current = null;
    }

    const track = trackRef.current;

    if (track) {
      targetScrollLeftRef.current =
        track.scrollLeft;
    }
  }, []);

  tickWheelSmoothingRef.current = () => {
    const track = trackRef.current;

    if (!track) {
      wheelRafRef.current = null;
      return;
    }

    const maxScrollLeft =
      getTrackMaxScrollLeft(track);
    targetScrollLeftRef.current = Math.max(
      0,
      Math.min(
        targetScrollLeftRef.current,
        maxScrollLeft,
      ),
    );

    const current = track.scrollLeft;
    const target =
      targetScrollLeftRef.current;
    const diff = target - current;

    if (
      Math.abs(diff) <= WHEEL_SCROLL_SNAP_EPS
    ) {
      if (current !== target) {
        track.scrollLeft = target;
      }

      wheelRafRef.current = null;
      return;
    }

    track.scrollLeft =
      current + diff * WHEEL_LERP_FACTOR;
    wheelRafRef.current =
      requestAnimationFrame(() => {
        tickWheelSmoothingRef.current();
      });
  };

  const scheduleWheelSmoothing =
    useCallback(() => {
      if (wheelRafRef.current !== null) {
        return;
      }

      wheelRafRef.current =
        requestAnimationFrame(() => {
          tickWheelSmoothingRef.current();
        });
    }, []);

  const cardWidth =
    trackWidth > 0
      ? getCarouselCardWidth(trackWidth)
      : 167;

  const cardHeight =
    cardWidth * CARD_PORTRAIT_RATIO;
  const viewportHeight = cardHeight;

  const updateArrowState =
    useCallback(() => {
      const track = trackRef.current;

      if (!track) {
        return;
      }

      const remaining =
        track.scrollWidth -
        track.scrollLeft -
        track.clientWidth;

      setCanScrollLeft(
        track.scrollLeft > 4,
      );
      setCanScrollRight(
        remaining > 8 || isLoadingMore,
      );
    }, [isLoadingMore]);

  const updateTrackWidth =
    useCallback(() => {
      const track = trackRef.current;

      if (!track) {
        return;
      }

      setTrackWidth(
        track.getBoundingClientRect()
          .width,
      );
    }, []);

  useEffect(() => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    updateTrackWidth();

    const observer =
      new ResizeObserver(updateTrackWidth);

    observer.observe(track);

    return () => {
      observer.disconnect();
    };
  }, [updateTrackWidth]);

  useEffect(() => {
    if (isLoading || works.length === 0) {
      return;
    }

    const track = trackRef.current;

    if (!track) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);

      if (absX > absY && absX > 0) {
        return;
      }

      if (absY < 1) {
        return;
      }

      const maxScrollLeft =
        getTrackMaxScrollLeft(track);
      const scrollPos =
        targetScrollLeftRef.current;
      const canScrollLeftNow =
        scrollPos > SCROLL_EDGE_EPS;
      const canScrollRightNow =
        scrollPos <
        maxScrollLeft - SCROLL_EDGE_EPS;
      const scrollingRight =
        event.deltaY > 0;
      const scrollingLeft =
        event.deltaY < 0;

      if (
        scrollingRight &&
        !canScrollRightNow
      ) {
        return;
      }

      if (
        scrollingLeft &&
        !canScrollLeftNow
      ) {
        return;
      }

      event.preventDefault();

      let delta = event.deltaY;

      if (event.deltaMode === 1) {
        delta *= 16;
      } else if (event.deltaMode === 2) {
        delta *= track.clientWidth;
      }

      targetScrollLeftRef.current = Math.max(
        0,
        Math.min(
          targetScrollLeftRef.current +
            delta * WHEEL_MULTIPLIER,
          maxScrollLeft,
        ),
      );
      scheduleWheelSmoothing();
    };

    targetScrollLeftRef.current =
      track.scrollLeft;

    track.addEventListener(
      "wheel",
      onWheel,
      { passive: false },
    );

    return () => {
      track.removeEventListener(
        "wheel",
        onWheel,
      );
      cancelWheelSmoothing();
    };
  }, [
    isLoading,
    works.length,
    scheduleWheelSmoothing,
    cancelWheelSmoothing,
  ]);

  useEffect(() => {
    const track = trackRef.current;

    if (!track || !onNearEnd) {
      return;
    }

    const checkNearEnd = () => {
      const remaining =
        track.scrollWidth -
        track.scrollLeft -
        track.clientWidth;
      const threshold =
        (cardWidth + CAROUSEL_GAP) *
        PREFETCH_CARD_THRESHOLD;

      if (remaining <= threshold) {
        onNearEnd();
      }
    };

    const maybePrune = () => {
      if (
        !onPrune ||
        dragRef.current.active ||
        cardWidth <= 0 ||
        suppressPruneRef.current ||
        arrowScrollInProgressRef.current
      ) {
        return;
      }

      const stride =
        cardWidth + CAROUSEL_GAP;
      const currentWorks =
        worksRef.current;

      if (currentWorks.length === 0) {
        return;
      }

      const firstVisibleIndex = Math.floor(
        track.scrollLeft / stride,
      );
      let pruneCount =
        firstVisibleIndex -
        LEFT_BUFFER_CARDS;

      if (pruneCount < 1) {
        return;
      }

      const maxPrune =
        currentWorks.length -
        MIN_WINDOW_CARDS;

      if (maxPrune < 1) {
        return;
      }

      pruneCount = Math.min(
        pruneCount,
        maxPrune,
      );

      const removedIds = currentWorks
        .slice(0, pruneCount)
        .map((work) => work.id);

      if (removedIds.length === 0) {
        return;
      }

      pendingScrollAdjustRef.current +=
        pruneCount * stride;
      onPrune(removedIds);
    };

    const onScroll = () => {
      checkNearEnd();
      maybePrune();
      updateArrowState();
    };

    checkNearEnd();
    updateArrowState();
    track.addEventListener(
      "scroll",
      onScroll,
      { passive: true },
    );

    return () => {
      track.removeEventListener(
        "scroll",
        onScroll,
      );
    };
  }, [
    cardWidth,
    works.length,
    isLoadingMore,
    onNearEnd,
    onPrune,
    updateArrowState,
  ]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const adjust =
      pendingScrollAdjustRef.current;

    if (!track || adjust <= 0) {
      return;
    }

    track.scrollLeft = Math.max(
      0,
      track.scrollLeft - adjust,
    );
    pendingScrollAdjustRef.current = 0;

    if (wheelRafRef.current !== null) {
      cancelAnimationFrame(wheelRafRef.current);
      wheelRafRef.current = null;
    }

    targetScrollLeftRef.current =
      track.scrollLeft;
    updateArrowState();
  }, [works, updateArrowState]);

  const ensureRightArrowScrollRoom =
    useCallback(
      async (
        track: HTMLDivElement,
        fallbackStride: number,
      ) => {
        if (!onNearEndRef.current) {
          return;
        }

        for (
          let attempt = 0;
          attempt < ARROW_APPEND_MAX_ATTEMPTS;
          attempt += 1
        ) {
          const distance =
            getArrowScrollDistance(
              track,
              fallbackStride,
            );

          if (
            !needsRightArrowRoom(
              track,
              distance,
            )
          ) {
            return;
          }

          if (isLoadingMoreRef.current) {
            await waitForLoadingComplete(
              isLoadingMoreRef,
            );
            continue;
          }

          const previousScrollWidth =
            track.scrollWidth;
          const previousWorksLength =
            worksRef.current.length;

          onNearEndRef.current();

          await waitForFeedGrowth(
            track,
            previousScrollWidth,
            previousWorksLength,
            worksRef,
          );
        }
      },
      [],
    );

  const executeArrowScroll = useCallback(
    async (direction: 1 | -1) => {
      if (arrowScrollInProgressRef.current) {
        return;
      }

      const track = trackRef.current;

      if (!track) {
        return;
      }

      cancelWheelSmoothing();
      arrowScrollInProgressRef.current = true;
      suppressPruneRef.current = true;

      try {
        const fallbackStride =
          cardWidth + CAROUSEL_GAP;

        if (direction === 1) {
          await ensureRightArrowScrollRoom(
            track,
            fallbackStride,
          );
        }

        const distance =
          getArrowScrollDistance(
            track,
            fallbackStride,
          );
        const maxScrollLeft =
          getTrackMaxScrollLeft(track);
        const target = Math.max(
          0,
          Math.min(
            track.scrollLeft +
              distance * direction,
            maxScrollLeft,
          ),
        );

        await smoothScrollTo(track, target);
      } finally {
        arrowScrollInProgressRef.current = false;
        suppressPruneRef.current = false;
        updateArrowState();
        requestAnimationFrame(() => {
          trackRef.current?.dispatchEvent(
            new Event("scroll"),
          );
        });
      }
    },
    [
      cardWidth,
      cancelWheelSmoothing,
      ensureRightArrowScrollRoom,
      updateArrowState,
    ],
  );

  function scrollByCards(
    direction: 1 | -1,
  ) {
    void executeArrowScroll(direction);
  }

  function onTrackPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (event.button !== 0) {
      return;
    }

    if (
      event.target instanceof Element &&
      event.target.closest("button")
    ) {
      return;
    }

    const track = trackRef.current;

    if (!track) {
      return;
    }

    cancelWheelSmoothing();

    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: track.scrollLeft,
      moved: false,
    };
  }

  function onTrackPointerMove(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const state = dragRef.current;
    const track = trackRef.current;

    if (
      !state.active ||
      !track ||
      state.pointerId !== event.pointerId
    ) {
      return;
    }

    const deltaX =
      event.clientX - state.startX;

    if (!state.moved) {
      if (
        Math.abs(deltaX) <
        DRAG_THRESHOLD_PX
      ) {
        return;
      }

      state.moved = true;
      suppressClickRef.current = true;
      setIsDragging(true);
      track.setPointerCapture(
        event.pointerId,
      );
    }

    track.scrollLeft =
      state.scrollLeft -
      deltaX * DRAG_MULTIPLIER;
  }

  function endDrag(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const state = dragRef.current;
    const track = trackRef.current;

    if (
      !state.active ||
      state.pointerId !== event.pointerId
    ) {
      return;
    }

    const didDrag = state.moved;

    if (didDrag) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    state.active = false;
    state.pointerId = -1;
    state.moved = false;
    setIsDragging(false);

    if (track) {
      if (didDrag) {
        try {
          track.releasePointerCapture(
            event.pointerId,
          );
        } catch {
          // already released
        }

        requestAnimationFrame(() => {
          track.dispatchEvent(
            new Event("scroll"),
          );
        });
      }
    }
  }

  function handleCardActivate(
    work: FeedItem,
  ) {
    if (suppressClickRef.current) {
      return;
    }

    onWorkClick(work);
  }

  function renderCard(work: FeedItem, feedIndex: number) {
    const thumbnail = getWorkThumbnail(work);

    return (
      <div
        key={work.id}
        data-feed-index={feedIndex}
        data-carousel-card=""
        className="shrink-0"
        style={{
          width: cardWidth,
          aspectRatio: "1 / 2.35",
        }}
      >
        <article
          role="button"
          tabIndex={0}
          onClick={() =>
            handleCardActivate(work)
          }
          onKeyDown={(
            event: ReactKeyboardEvent,
          ) => {
            if (
              event.key === "Enter" ||
              event.key === " "
            ) {
              handleCardActivate(work);
            }
          }}
          className={`group relative h-full w-full cursor-pointer overflow-hidden rounded-2xl bg-neutral-950 text-left transition-all duration-300 ${
            pickedWorkIds.has(work.id)
              ? "ring-2 ring-violet-500 ring-offset-2 ring-offset-[#050505]"
              : ""
          }`}
        >
          {thumbnail ? (
            <RotatedWorkThumbnail
              src={thumbnail}
              alt={
                work.artistName
                  ? `${work.artistName} work`
                  : "Discover work"
              }
              rotationDegrees={
                work.thumbnailRotationDegrees
              }
              draggable={false}
              referrerPolicy={
                work.type === "tiktok"
                  ? "no-referrer"
                  : undefined
              }
              imgClassName="h-full w-full object-cover object-center transition duration-500 ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-white/30">
              No thumbnail
            </div>
          )}

          {pickedWorkIds.has(work.id) && (
            <div className="pointer-events-none absolute left-2 top-2 flex h-7 items-center justify-center rounded-full bg-violet-600/95 px-2.5 text-[10px] font-semibold text-white shadow md:h-8 md:px-3 md:text-[11px]">
              {t("savedState")}
            </div>
          )}

          {work.durationSeconds &&
            work.durationSeconds > 0 && (
              <div className="pointer-events-none absolute bottom-2 right-2 z-[1] rounded px-1 py-0.5 text-[10px] font-medium leading-none text-white bg-black/75 md:px-1.5 md:py-1 md:text-[11px]">
                {formatDurationSeconds(
                  work.durationSeconds,
                )}
              </div>
            )}
        </article>
      </div>
    );
  }

  function renderSkeletons(count: number, keyPrefix: string) {
    return Array.from({ length: count }).map(
      (_, index) => (
        <div
          key={`${keyPrefix}-${index}`}
          className="shrink-0 animate-pulse rounded-2xl bg-[#181818]"
          style={{
            width: cardWidth,
            aspectRatio: "1 / 2.35",
          }}
        />
      ),
    );
  }

  if (isLoading) {
    return (
      <div
        ref={trackRef}
        className="overflow-hidden"
        style={{ height: viewportHeight }}
      >
        <div className="flex w-max gap-3">
          {renderSkeletons(5, "skeleton")}
        </div>
      </div>
    );
  }

  if (works.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        {t("noWorks")}
      </p>
    );
  }

  return (
    <div className="relative w-full min-w-0">
    <div
      ref={trackRef}
      className={`touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        isDragging
          ? "cursor-grabbing select-none"
          : "cursor-grab"
      }`}
      style={{ height: viewportHeight }}
      onPointerDown={onTrackPointerDown}
      onPointerMove={onTrackPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="flex w-max gap-3">
        {works.map((work, index) =>
          renderCard(work, index),
        )}
        {isLoadingMore &&
          renderSkeletons(2, "more")}
      </div>
    </div>
    {canScrollLeft && (
      <button
        type="button"
        aria-label="Scroll left"
        onClick={() =>
          scrollByCards(-1)
        }
        onPointerDown={(event) =>
          event.stopPropagation()
        }
        className="absolute left-2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur transition hover:bg-black/65 md:flex"
        style={{ top: viewportHeight / 2 }}
      >
        <ChevronLeft size={21} />
      </button>
    )}
    {canScrollRight && (
      <button
        type="button"
        aria-label="Scroll right"
        onClick={() =>
          scrollByCards(1)
        }
        onPointerDown={(event) =>
          event.stopPropagation()
        }
        className="absolute right-2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur transition hover:bg-black/65 md:flex"
        style={{ top: viewportHeight / 2 }}
      >
        <ChevronRight size={21} />
      </button>
    )}
    </div>
  );
}
