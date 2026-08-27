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

import AuthModal from "@/components/AuthModal";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import {
  getSourceLabel,
  getWorkThumbnail,
  type WorkMediaItem,
} from "@/lib/works/workDisplay";
import { useOverlayHistory } from "@/lib/hooks/useOverlayHistory";

export type SavedPanelWork = WorkMediaItem & {
  caption?: string | null;
};

type PickedWorkRow = {
  id: number | string;
  source: string;
  source_id: string | null;
  source_url: string;
  thumbnail_url: string | null;
  title: string | null;
  description: string | null;
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
const MAX_VISIBLE_CARDS = 5;

function mapPickedWork(
  work: PickedWorkRow,
): SavedPanelWork | null {
  const artist = Array.isArray(work.artist)
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
    sourceUrl: work.source_url,
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

function hitTestPickCardId(
  clientX: number,
  clientY: number,
  stackId: string,
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
      card.dataset.pickStack !== stackId
    ) {
      continue;
    }

    return card.dataset.pickCardId ?? null;
  }

  return null;
}

type SavedCardStackProps = {
  works: SavedPanelWork[];
  onWorkClick: (
    work: SavedPanelWork,
  ) => void;
  onUnsave: (
    work: SavedPanelWork,
  ) => void;
  sourceLabels: {
    youtube: string;
    tiktok: string;
    image: string;
  };
};

function SavedCardStack({
  works,
  onWorkClick,
  onUnsave,
  sourceLabels,
}: SavedCardStackProps) {
  const [
    hoveredStack,
    setHoveredStack,
  ] = useState(false);
  const [
    scrubWorkId,
    setScrubWorkId,
  ] = useState<string | null>(null);
  const [
    scrubbingStack,
    setScrubbingStack,
  ] = useState(false);

  const cardScrubRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    mode: "undecided" | "scrub" | "scroll";
    captured: boolean;
  } | null>(null);
  const suppressCardClickRef = useRef(false);

  const visibleWorks = works.slice(
    0,
    MAX_VISIBLE_CARDS,
  );
  const hiddenCount = Math.max(
    0,
    works.length - visibleWorks.length,
  );
  const expanded =
    hoveredStack || scrubbingStack;
  const gap = expanded ? 36 : 21;

  function resetCardScrub() {
    cardScrubRef.current = null;
    setScrubbingStack(false);
    setScrubWorkId(null);
  }

  function onStackPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!isCoarsePointer(event)) {
      return;
    }

    suppressCardClickRef.current = true;
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
      !state ||
      state.pointerId !== event.pointerId ||
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
        setScrubbingStack(true);
        setScrubWorkId(
          hitTestPickCardId(
            event.clientX,
            event.clientY,
            SAVED_STACK_ID,
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
        SAVED_STACK_ID,
      ),
    );
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

    if (mode === "scroll") {
      resetCardScrub();
      return;
    }

    const cardId = hitTestPickCardId(
      event.clientX,
      event.clientY,
      SAVED_STACK_ID,
    );

    setScrubbingStack(false);
    setScrubWorkId(null);

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

  function onStackPointerCancel() {
    resetCardScrub();
  }

  return (
    <div
      className="relative mt-2 h-[168px] touch-pan-y"
      onMouseEnter={() =>
        setHoveredStack(true)
      }
      onMouseLeave={() =>
        setHoveredStack(false)
      }
      onPointerDown={onStackPointerDown}
      onPointerMove={onStackPointerMove}
      onPointerUp={onStackPointerUp}
      onPointerCancel={
        onStackPointerCancel
      }
    >
      {visibleWorks.map((work, index) => {
        const thumbnail =
          getWorkThumbnail(work);

        if (
          !thumbnail &&
          work.type !== "tiktok"
        ) {
          return null;
        }

        const right =
          hiddenCount > 0
            ? (visibleWorks.length - index) *
              gap
            : (visibleWorks.length -
                1 -
                index) *
              gap;

        const isScrubActive =
          scrubWorkId === work.id;

        const sourceLabel =
          getSourceLabel(
            work,
            sourceLabels,
          );

        return (
          <div
            key={work.id}
            data-pick-card-id={work.id}
            data-pick-stack={SAVED_STACK_ID}
            className={`group/card absolute top-0 h-[156px] w-[108px] overflow-hidden rounded-xl border-2 border-[#262626] bg-[#141414] shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-all duration-300 ease-out hover:-translate-y-2 ${
              isScrubActive
                ? "-translate-y-2 scale-[1.03] shadow-[0_12px_28px_rgba(0,0,0,0.55)]"
                : ""
            }`}
            style={{
              right: `${right}px`,
              zIndex:
                isScrubActive
                  ? visibleWorks.length + 10
                  : visibleWorks.length -
                    index +
                    2,
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
                  suppressCardClickRef.current =
                    false;
                  return;
                }

                onWorkClick(work);
              }}
              className="absolute inset-0 text-left"
              aria-label={
                work.artistName
                  ? `Open ${work.artistName} clip`
                  : "Open saved clip"
              }
            >
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-[10px] font-semibold text-white/50">
                  TikTok
                </div>
              )}

              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-2 pb-2 pt-8">
                {work.artistName && (
                  <p className="truncate text-[10px] font-medium text-white">
                    {work.artistName}
                  </p>
                )}
                <p className="truncate text-[9px] uppercase tracking-wide text-white/55">
                  {sourceLabel}
                </p>
              </div>
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
                isScrubActive
                  ? "opacity-100"
                  : "opacity-0 group-hover/card:opacity-100"
              }`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}

      {hiddenCount > 0 && (
        <div
          className="absolute top-0 flex h-[156px] w-[108px] items-center justify-end rounded-xl border-2 border-[#262626] bg-[#0a0a0a] pr-3 text-base font-black text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-all duration-300"
          style={{
            right: "0px",
            zIndex: 1,
          }}
        >
          +{hiddenCount}
        </div>
      )}
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
    showAuthModal,
    setShowAuthModal,
  ] = useState(false);
  const [
    isAuthenticated,
    setIsAuthenticated,
  ] = useState(false);
  const [
    showAdded,
    setShowAdded,
  ] = useState(false);

  const sourceLabels = useMemo(
    () => ({
      youtube: t("sourceYoutube"),
      tiktok: t("sourceTiktok"),
      image: t("sourceImage"),
    }),
    [t],
  );

  const loadSaved = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsAuthenticated(false);
      setItems([]);
      setLoading(false);
      return;
    }

    setIsAuthenticated(true);

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
          ? mapPickedWork(workRow)
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
    return (
      <>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">
              {t("saved")}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {items.length}{" "}
              {t("savedState").toLowerCase()}
            </p>
          </div>

          <Link
            href="/saved"
            className="text-xs font-semibold text-violet-400 transition hover:text-violet-300"
          >
            {compact
              ? "→"
              : `${t("saved")} →`}
          </Link>
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="relative h-[168px]">
              <div className="absolute right-0 top-0 h-[156px] w-[108px] animate-pulse rounded-xl bg-[#181818]" />
              <div className="absolute right-[21px] top-0 h-[156px] w-[108px] animate-pulse rounded-xl bg-[#141414]" />
              <div className="absolute right-[42px] top-0 h-[156px] w-[108px] animate-pulse rounded-xl bg-[#101010]" />
            </div>
          ) : !isAuthenticated ? (
            <button
              type="button"
              onClick={() =>
                setShowAuthModal(true)
              }
              className="text-sm text-zinc-400 underline"
            >
              {t("login")}
            </button>
          ) : items.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {t("noSaved")}
            </p>
          ) : (
            <SavedCardStack
              works={items}
              onWorkClick={onWorkClick}
              onUnsave={onUnsave}
              sourceLabels={sourceLabels}
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
        className={`fixed bottom-[69px] right-0 top-14 z-40 hidden overflow-hidden transition-all duration-200 md:top-16 xl:block ${
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
                  {t("saved")}
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
            className={`h-full overflow-y-auto pb-8 pl-10 pr-4 pt-6 transition-opacity duration-150 ${
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
              {t("saved")}
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
                {t("saved")}
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

            <div className="overflow-y-auto px-4 py-4">
              {panelBody(true)}
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
          setShowAuthModal(false);
          void loadSaved();
        }}
      />
    </>
  );
}
