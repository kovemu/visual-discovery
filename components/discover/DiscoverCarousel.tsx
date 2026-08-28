"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
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
const PREFETCH_CARD_THRESHOLD = 2.5;
const LEFT_BUFFER_CARDS = 5;
const MIN_WINDOW_CARDS = 8;
const WHEEL_MULTIPLIER = 1.85;
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

  worksRef.current = works;

  const cardWidth =
    trackWidth > 0
      ? getCarouselCardWidth(trackWidth)
      : 167;

  const cardHeight =
    cardWidth * CARD_PORTRAIT_RATIO;
  const viewportHeight = cardHeight;

  const scrollStep =
    (cardWidth + CAROUSEL_GAP) * 2.5;

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

      const maxScrollLeft = Math.max(
        0,
        track.scrollWidth -
          track.clientWidth,
      );
      const canScrollLeftNow =
        track.scrollLeft >
        SCROLL_EDGE_EPS;
      const canScrollRightNow =
        track.scrollLeft <
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

      track.scrollLeft +=
        delta * WHEEL_MULTIPLIER;
    };

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
    };
  }, [isLoading, works.length]);

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
        cardWidth <= 0
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
    updateArrowState();
  }, [works, updateArrowState]);

  function scrollByCards(
    direction: 1 | -1,
  ) {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    track.scrollBy({
      left: scrollStep * direction,
      behavior: "smooth",
    });
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
              rotationDegrees={work.rotationDegrees}
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
