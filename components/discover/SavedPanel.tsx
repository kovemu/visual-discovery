"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import RotatedWorkThumbnail from "@/components/works/RotatedWorkThumbnail";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import {
  getWorkThumbnail,
  type WorkMediaItem,
} from "@/lib/works/workDisplay";
import { useOverlayHistory } from "@/lib/hooks/useOverlayHistory";

export type SavedPanelWork = WorkMediaItem & {
  caption?: string | null;
  pickedAt: string;
};

type PickedWorkRow = {
  id: number | string;
  source: string;
  source_id: string | null;
  source_url: string;
  thumbnail_url: string | null;
  title: string | null;
  description: string | null;
  rotation_degrees: number | null;
  artist:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

type PickRow = {
  work_id: number | string;
  created_at: string;
  work:
    | PickedWorkRow
    | PickedWorkRow[]
    | null;
};

type SavedPanelProps = {
  refreshKey: number;
  addedCount?: number;
  pulseKey?: number;
  onWorkClick: (
    work: SavedPanelWork,
  ) => void;
  onUnsave: (
    work: SavedPanelWork,
  ) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (
    open: boolean,
  ) => void;
};

const SAVED_STACK_ID = "saved-panel-stack";
const CARDS_PER_ROW = 6;
const CARD_WIDTH_PX = 108;
const STACK_GAP_COLLAPSED_PX = 21;
const STACK_GAP_EXPANDED_PX = 36;
const CARD_LIFT_PX = 8;
const HOVERED_CARD_Z_INDEX = 50;
const CARD_SCRUB_THRESHOLD_PX = 8;

function getEffectiveGap(isExpanded: boolean) {
  return isExpanded
    ? STACK_GAP_EXPANDED_PX
    : STACK_GAP_COLLAPSED_PX;
}

function getCardRightOffset(
  index: number,
  count: number,
  gap: number,
) {
  return (count - 1 - index) * gap;
}

function resolveActiveCardIndexFromRight(
  distanceFromRight: number,
  count: number,
  gap: number,
): number | null {
  if (count <= 0) {
    return null;
  }

  const stripAreaWidth = (count - 1) * gap;

  if (
    distanceFromRight < 0 ||
    distanceFromRight > stripAreaWidth + CARD_WIDTH_PX
  ) {
    return null;
  }

  if (distanceFromRight < stripAreaWidth) {
    const stripIndex = Math.floor(
      distanceFromRight / gap,
    );

    return count - 1 - stripIndex;
  }

  return 0;
}

function resolveHoveredCardIdFromPointer(
  clientX: number,
  containerRect: DOMRect,
  works: SavedPanelWork[],
  gap: number,
) {
  const distanceFromRight =
    containerRect.right - clientX;
  const cardIndex = resolveActiveCardIndexFromRight(
    distanceFromRight,
    works.length,
    gap,
  );

  if (cardIndex === null) {
    return null;
  }

  return works[cardIndex]?.id ?? null;
}

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function chunkWorksIntoRows(
  works: SavedPanelWork[],
) {
  const rows: SavedPanelWork[][] = [];

  for (
    let index = 0;
    index < works.length;
    index += CARDS_PER_ROW
  ) {
    rows.push(
      works.slice(index, index + CARDS_PER_ROW),
    );
  }

  return rows;
}

function mapPickedWork(
  work: PickedWorkRow,
  pickedAt: string,
): SavedPanelWork | null {
  const artist = Array.isArray(work.artist)
    ? work.artist[0]
    : work.artist;

  const isYoutube =
    work.source === "youtube" &&
    Boolean(work.source_id);
  const isTikTok =
    work.source === "tiktok" &&
    Boolean(work.source_id);

  return {
    id: String(work.id),
    artistId: artist?.id ?? "",
    artistName: artist?.name ?? "",
    source: work.source,
    type: isYoutube
      ? "youtube"
      : isTikTok
        ? "tiktok"
        : "image",
    videoId:
      isYoutube || isTikTok
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
    title: work.title,
    description: work.description,
    sourceUrl: work.source_url,
    rotationDegrees: work.rotation_degrees ?? 0,
    pickedAt,
  };
}

function isCoarsePointer(
  event: ReactPointerEvent,
) {
  return (
    event.pointerType === "touch" ||
    event.pointerType === "pen"
  );
}

type SavedCardStackRowProps = {
  works: SavedPanelWork[];
  stackId: string;
  onWorkClick: (
    work: SavedPanelWork,
  ) => void;
  onUnsave: (
    work: SavedPanelWork,
  ) => void;
};

function SavedCardStackRow({
  works,
  stackId,
  onWorkClick,
  onUnsave,
}: SavedCardStackRowProps) {
  const [hoveredStack, setHoveredStack] =
    useState(false);
  const [touchingStack, setTouchingStack] =
    useState(false);
  const [scrubbingStack, setScrubbingStack] =
    useState(false);
  const [activeWorkId, setActiveWorkId] =
    useState<string | null>(null);

  const cardScrubRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    mode: "undecided" | "scrub" | "scroll";
    captured: boolean;
  } | null>(null);
  const suppressCardClickRef = useRef(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const expanded =
    hoveredStack ||
    touchingStack ||
    scrubbingStack;
  const effectiveGap = getEffectiveGap(expanded);
  const maxStackWidth =
    CARD_WIDTH_PX +
    Math.max(0, works.length - 1) *
      STACK_GAP_EXPANDED_PX;

  function resolveCardIdFromPointer(
    clientX: number,
    gapPx: number,
  ) {
    const row = rowRef.current;

    if (!row) {
      return null;
    }

    return resolveHoveredCardIdFromPointer(
      clientX,
      row.getBoundingClientRect(),
      works,
      gapPx,
    );
  }

  const updateActiveCardFromPointer = useCallback(
    (clientX: number, gapPx: number) => {
      const nextId = resolveCardIdFromPointer(
        clientX,
        gapPx,
      );

      setActiveWorkId(nextId);
      return nextId;
    },
    [works],
  );

  function resetTouchInteraction() {
    cardScrubRef.current = null;
    setTouchingStack(false);
    setScrubbingStack(false);
  }

  function onStackPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!isCoarsePointer(event)) {
      return;
    }

    suppressCardClickRef.current = true;
    setTouchingStack(true);
    updateActiveCardFromPointer(
      event.clientX,
      getEffectiveGap(true),
    );
    cardScrubRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      mode: "undecided",
      captured: false,
    };
  }

  function onStackPointerMove(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const state = cardScrubRef.current;

    if (
      isCoarsePointer(event) &&
      state &&
      state.pointerId === event.pointerId &&
      state.mode !== "scroll"
    ) {
      updateActiveCardFromPointer(
        event.clientX,
        getEffectiveGap(true),
      );

      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (state.mode === "undecided") {
        if (
          Math.max(absDx, absDy) <
          CARD_SCRUB_THRESHOLD_PX
        ) {
          return;
        }

        if (absDy > absDx * 1.15) {
          state.mode = "scroll";
          resetTouchInteraction();
          setActiveWorkId(null);
          return;
        }

        if (absDx > absDy * 1.15) {
          state.mode = "scrub";
          setScrubbingStack(true);
          state.captured = true;
          event.currentTarget.setPointerCapture(
            event.pointerId,
          );
        }

        return;
      }

      return;
    }

    if (
      !isCoarsePointer(event) &&
      hoveredStack
    ) {
      updateActiveCardFromPointer(
        event.clientX,
        effectiveGap,
      );
    }
  }

  function openWorkFromPointer(
    clientX: number,
    gapPx: number,
  ) {
    const cardId = resolveCardIdFromPointer(
      clientX,
      gapPx,
    );

    if (!cardId) {
      return;
    }

    const work = works.find(
      (item) => item.id === cardId,
    );

    if (work) {
      onWorkClick(work);
    }
  }

  function onStackPointerUp(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const state = cardScrubRef.current;

    if (
      !state ||
      state.pointerId !== event.pointerId
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
    setTouchingStack(false);
    setScrubbingStack(false);

    if (mode === "scroll") {
      setActiveWorkId(null);
      return;
    }

    openWorkFromPointer(
      event.clientX,
      getEffectiveGap(true),
    );
    setActiveWorkId(null);
    window.setTimeout(() => {
      suppressCardClickRef.current = false;
    }, 0);
  }

  function onStackPointerCancel() {
    resetTouchInteraction();
    setActiveWorkId(null);
  }

  return (
    <div
      ref={rowRef}
      className="relative ml-auto h-[168px] touch-pan-y overflow-visible"
      style={{ width: maxStackWidth }}
      onMouseEnter={() =>
        setHoveredStack(true)
      }
      onMouseLeave={() => {
        setHoveredStack(false);
        setActiveWorkId(null);
      }}
      onMouseMove={(event) => {
        updateActiveCardFromPointer(
          event.clientX,
          effectiveGap,
        );
      }}
      onPointerDown={onStackPointerDown}
      onPointerMove={onStackPointerMove}
      onPointerUp={onStackPointerUp}
      onPointerCancel={
        onStackPointerCancel
      }
    >
      {works.map((work, index) => {
        const thumbnail =
          getWorkThumbnail(work);

        if (
          !thumbnail &&
          work.type !== "tiktok"
        ) {
          return null;
        }

        const right = getCardRightOffset(
          index,
          works.length,
          effectiveGap,
        );

        const isRaised =
          activeWorkId === work.id;

        return (
          <div
            key={work.id}
            data-pick-card-id={work.id}
            data-pick-stack={stackId}
            className={`group/card absolute top-0 h-[156px] w-[108px] overflow-visible rounded-xl border-0 bg-[#141414] shadow-[0_8px_24px_rgba(0,0,0,0.45)] outline-none transition-all duration-300 ease-out focus:outline-none focus-visible:outline-none ${
              isRaised
                ? "pointer-events-auto"
                : "pointer-events-none"
            }`}
            style={{
              right: `${right}px`,
              zIndex: isRaised
                ? HOVERED_CARD_Z_INDEX
                : works.length - index,
              transform: isRaised
                ? `translateY(-${CARD_LIFT_PX}px)`
                : "translateY(0)",
            }}
          >
            <button
              type="button"
              onClick={(event) => {
                if (
                  suppressCardClickRef.current
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  return;
                }

                onWorkClick(work);
              }}
              className="absolute inset-0 overflow-hidden rounded-[10px] border-0 text-left outline-none focus:outline-none focus-visible:outline-none"
              aria-label={
                work.artistName
                  ? `Open ${work.artistName} clip`
                  : "Open saved clip"
              }
            >
              {thumbnail ? (
                <RotatedWorkThumbnail
                  src={thumbnail}
                  alt=""
                  rotationDegrees={work.rotationDegrees}
                  draggable={false}
                  imgClassName="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-[10px] font-semibold text-white/50">
                  TikTok
                </div>
              )}

            </button>

            <button
              type="button"
              aria-label="Unsave"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onUnsave(work);
              }}
              className={`absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white/90 backdrop-blur-sm transition hover:bg-black/75 ${
                isRaised
                  ? "opacity-100"
                  : "opacity-0 group-hover/card:opacity-100"
              }`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

type SavedCardStackProps = {
  works: SavedPanelWork[];
  onWorkClick: (
    work: SavedPanelWork,
  ) => void;
  onUnsave: (
    work: SavedPanelWork,
  ) => void;
};

function SavedCardStack({
  works,
  onWorkClick,
  onUnsave,
}: SavedCardStackProps) {
  const rows = chunkWorksIntoRows(works);

  return (
    <div className="space-y-4 overflow-visible">
      {rows.map((rowWorks, rowIndex) => (
        <SavedCardStackRow
          key={`${rowWorks[0]?.id ?? "row"}-${rowIndex}`}
          works={rowWorks}
          stackId={`${SAVED_STACK_ID}-${rowIndex}`}
          onWorkClick={onWorkClick}
          onUnsave={onUnsave}
        />
      ))}
    </div>
  );
}

export default function SavedPanel({
  refreshKey,
  addedCount = 0,
  pulseKey = 0,
  onWorkClick,
  onUnsave,
  mobileOpen = false,
  onMobileOpenChange,
}: SavedPanelProps) {
  const { t } = useTranslation();
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [open, setOpen] =
    useState(false);
  const [loading, setLoading] =
    useState(true);
  const [items, setItems] = useState<
    SavedPanelWork[]
  >([]);
  const [
    showAdded,
    setShowAdded,
  ] = useState(false);
  const [savedFilter, setSavedFilter] =
    useState<"today" | "all">("all");

  const loadSaved = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data, error } =
      await supabase
        .from("work_picks")
        .select(
          `
            work_id,
            created_at,
            work:works (
              id,
              source,
              source_id,
              source_url,
              thumbnail_url,
              title,
              description,
              rotation_degrees,
              artist:creators (
                id,
                name
              )
            )
          `,
        )
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      console.error(
        "LOAD SAVED PANEL ERROR:",
        error,
      );
      setItems([]);
      setLoading(false);
      return;
    }

    const mapped = (data ?? [])
      .map((row) => {
        const pickRow = row as PickRow;

        if (!pickRow.work) {
          return null;
        }

        const workRow = Array.isArray(
          pickRow.work,
        )
          ? pickRow.work[0]
          : pickRow.work;

        return workRow
          ? mapPickedWork(
              workRow,
              pickRow.created_at,
            )
          : null;
      })
      .filter(
        (
          item,
        ): item is SavedPanelWork =>
          item !== null,
      );

    setItems(mapped);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved, refreshKey]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED"
      ) {
        void loadSaved();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadSaved, supabase]);

  useEffect(() => {
    function onPicksChanged() {
      void loadSaved();
    }

    window.addEventListener(
      "kovemu-picks-changed",
      onPicksChanged,
    );

    return () => {
      window.removeEventListener(
        "kovemu-picks-changed",
        onPicksChanged,
      );
    };
  }, [loadSaved]);

  useEffect(() => {
    if (pulseKey === 0 || addedCount <= 0) {
      return;
    }

    setShowAdded(true);
    const timer = window.setTimeout(
      () => setShowAdded(false),
      1400,
    );

    return () =>
      window.clearTimeout(timer);
  }, [pulseKey, addedCount]);

  function closeMobileDrawer() {
    onMobileOpenChange?.(false);
  }

  const { requestClose: requestCloseMobileDrawer } =
    useOverlayHistory(
      "picks",
      Boolean(
        mobileOpen &&
          onMobileOpenChange,
      ),
      closeMobileDrawer,
    );

  function panelBody(
    compact = false,
  ) {
    const filteredItems =
      savedFilter === "today"
        ? items.filter((item) =>
            isToday(item.pickedAt),
          )
        : items;

    return (
      <>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">
              {t("myPicks")}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {filteredItems.length}{" "}
              {t("picked")}
            </p>
          </div>

          <Link
  href="/saved"
  className="shrink-0 whitespace-nowrap text-xs font-semibold text-violet-400 transition hover:text-violet-300"
>
  {t("all")} →
</Link>
        </div>

        <div className="mt-4 flex items-center gap-3 text-xs font-semibold">
          <button
            type="button"
            onClick={() =>
              setSavedFilter("today")
            }
            className={
              savedFilter === "today"
                ? "text-violet-400"
                : "text-zinc-500 transition hover:text-zinc-300"
            }
          >
            Today
          </button>

          <span className="text-zinc-700">
            |
          </span>

          <button
            type="button"
            onClick={() =>
              setSavedFilter("all")
            }
            className={
              savedFilter === "all"
                ? "text-violet-400"
                : "text-zinc-500 transition hover:text-zinc-300"
            }
          >
            All
          </button>
        </div>

        <div className="mt-5 overflow-visible">
          {loading ? (
            <div className="relative ml-auto h-[168px] w-[108px] overflow-visible">
              <div className="absolute right-0 top-0 h-[156px] w-[108px] animate-pulse rounded-xl bg-[#181818]" />
              <div className="absolute right-[21px] top-0 h-[156px] w-[108px] animate-pulse rounded-xl bg-[#141414]" />
              <div className="absolute right-[42px] top-0 h-[156px] w-[108px] animate-pulse rounded-xl bg-[#101010]" />
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {savedFilter === "today"
                ? "Nothing picked today."
                : t("noSaved")}
            </p>
          ) : (
            <SavedCardStack
              works={filteredItems}
              onWorkClick={onWorkClick}
              onUnsave={onUnsave}
            />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop side panel */}
      <div
        onMouseEnter={() =>
          setOpen(true)
        }
        onMouseLeave={() =>
          setOpen(false)
        }
        className={`fixed bottom-[69px] right-0 top-12 z-40 hidden overflow-hidden transition-all duration-200 md:top-14 xl:block ${
          open
            ? "w-[340px]"
            : "w-[72px]"
        }`}
      >
        <div
          className={`relative h-full border-l border-[#262626] bg-[#111111] shadow-[-8px_0_24px_rgba(0,0,0,0.45)] ${
            showAdded
              ? "shadow-[-8px_0_30px_rgba(168,85,247,0.22)]"
              : ""
          }`}
        >
          <button
            type="button"
            aria-label={
              open
                ? "Collapse saved panel"
                : "Expand saved panel"
            }
            className={`absolute top-1/2 -translate-y-1/2 transition-colors ${
              open
                ? "left-0 flex h-10 w-7 items-center justify-center rounded-l-md border border-r-0 border-[#262626] bg-[#141414] text-zinc-400 hover:text-violet-400"
                : "left-1/2 flex -translate-x-1/2 flex-col items-center text-zinc-500 hover:text-violet-400"
            }`}
          >
            {open ? (
              <ChevronRight size={16} />
            ) : (
              <>
                <ChevronLeft
                  size={28}
                  strokeWidth={1.2}
                />
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
                  {t("myPicks")}
                </span>
              </>
            )}
          </button>

          {!open && showAdded && (
            <span className="pointer-events-none absolute left-1/2 top-[calc(50%+48px)] -translate-x-1/2 animate-[pickPulse_1.4s_ease-out_forwards] whitespace-nowrap text-sm font-bold text-violet-400">
              +{addedCount}
            </span>
          )}

          <div
            className={`h-full overflow-x-visible overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-8 pl-10 pr-4 pt-6 transition-opacity duration-150 ${
              open
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
          >
            {panelBody()}
          </div>
        </div>
      </div>

      {/* Mobile drawer trigger */}
      {onMobileOpenChange && (
        <>
          <button
            type="button"
            aria-label="Open saved panel"
            aria-expanded={mobileOpen}
            onClick={() =>
              onMobileOpenChange(true)
            }
            className={`fixed right-0 top-1/2 z-[52] flex h-16 w-11 -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-[#262626] bg-[#111111]/95 text-zinc-300 shadow-[-2px_0_12px_rgba(0,0,0,0.4)] xl:hidden ${
              mobileOpen
                ? "pointer-events-none opacity-0"
                : "opacity-100"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] [writing-mode:vertical-rl]">
              {t("myPicks")}
            </span>
            {showAdded && (
              <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 animate-[pickPulse_0.75s_ease-out_forwards] text-xs font-bold text-violet-400">
                +{addedCount}
              </span>
            )}
          </button>

          <div
            className={`fixed inset-0 z-[55] bg-black/60 transition-opacity xl:hidden ${
              mobileOpen
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
            onClick={
              requestCloseMobileDrawer
            }
          />

          <div
            className={`fixed inset-y-0 right-0 z-[56] w-[88vw] max-w-[360px] border-l border-[#262626] bg-[#111111] shadow-[-8px_0_24px_rgba(0,0,0,0.5)] transition-transform duration-300 xl:hidden ${
              mobileOpen
                ? "translate-x-0"
                : "pointer-events-none translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#262626] px-4 py-3">
              <span className="text-sm font-semibold text-white">
                {t("myPicks")}
              </span>
              <button
                type="button"
                aria-label="Close"
                onClick={
                  requestCloseMobileDrawer
                }
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-[#1a1a1a] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-4 py-4">
              {panelBody(true)}
            </div>
          </div>
        </>
      )}
    </>
  );
}
