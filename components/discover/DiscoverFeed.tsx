"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import SavedPanel, {
  type SavedPanelWork,
} from "@/components/discover/SavedPanel";
import DiscoverCarousel from "@/components/discover/DiscoverCarousel";
import { useDiscoverFeed } from "@/components/discover/useDiscoverFeed";
import WorkMediaModal from "@/components/works/WorkMediaModal";
import {
  ensurePickSession,
  PickSessionError,
} from "@/lib/auth/ensurePickSession";
import { useOverlayHistory } from "@/lib/hooks/useOverlayHistory";
import { trackProductEvent } from "@/lib/analytics/trackProductEvent";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { getAnalyticsSource } from "@/lib/works/workDisplay";
import { createClient } from "@/lib/supabase/client";
import { insertWorkPick } from "@/lib/picks/insertWorkPick";
import {
  CREATOR_CATEGORY_OPTIONS,
  type CreatorCategory,
} from "@/lib/creator/creatorCategories";
import {
  buildDiscoverCategorySignature,
  createAllSelectedCategories,
  handleAllCategoryClick,
  handleCreatorCategoryClick,
  isAllDiscoverCategoriesSelected,
} from "@/lib/discover/discoverCategorySelection";

export type FeedItem = {
  id: string;
  artistId?: string;
  artistName?: string;
  category: string;
  artistTags?: string[];
  type?: "image" | "youtube" | "tiktok";
  source?: string;
  image?: string;
  videoId?: string;
  caption?: string | null;
  title?: string | null;
  description?: string | null;
  sourceUrl?: string;
  artistUrl?: string;
  durationSeconds?: number;
  rotationDegrees?: number;
};

type DiscoverFeedProps = {
  works: FeedItem[];
};

const DISCOVER_SEARCH_DEBOUNCE_MS = 300;
const DISCOVER_SEARCH_ANALYTICS_DEBOUNCE_MS = 800;
const DISCOVER_SEARCH_QUERY_MAX_LENGTH = 100;

function normalizeDiscoverSearchQueryForAnalytics(
  value: string,
) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, DISCOVER_SEARCH_QUERY_MAX_LENGTH);
}

export default function DiscoverFeed({
  works: _initialWorks,
}: DiscoverFeedProps) {
  const { t } = useTranslation();
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [selectedCategories, setSelectedCategories] =
    useState<Set<CreatorCategory>>(
      () => createAllSelectedCategories(),
    );

  const categorySignature = useMemo(
    () =>
      buildDiscoverCategorySignature(
        selectedCategories,
      ),
    [selectedCategories],
  );

  const categorySignatureRef = useRef(
    categorySignature,
  );
  const lastSearchEventKeyRef = useRef<
    string | null
  >(null);

  const isAllActive = isAllDiscoverCategoriesSelected(
    selectedCategories,
  );

  const [pickedWorkIds, setPickedWorkIds] =
    useState<Set<string>>(new Set());
  const [picksLoaded, setPicksLoaded] =
    useState(false);

  const [searchInput, setSearchInput] =
    useState("");
  const [
    debouncedSearch,
    setDebouncedSearch,
  ] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, DISCOVER_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    const normalizedQuery =
      normalizeDiscoverSearchQueryForAnalytics(
        searchInput,
      );

    if (!normalizedQuery) {
      lastSearchEventKeyRef.current = null;
      return;
    }

    const timer = window.setTimeout(() => {
      const settledQuery =
        normalizeDiscoverSearchQueryForAnalytics(
          searchInput,
        );

      if (!settledQuery) {
        lastSearchEventKeyRef.current = null;
        return;
      }

      const dedupeKey = `${categorySignature}:${settledQuery}`;

      if (
        lastSearchEventKeyRef.current ===
        dedupeKey
      ) {
        return;
      }

      lastSearchEventKeyRef.current =
        dedupeKey;

      trackProductEvent({
        event_name: "search",
        metadata: {
          query: settledQuery,
          category: categorySignature,
        },
      });
    }, DISCOVER_SEARCH_ANALYTICS_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput, categorySignature]);

  const feed = useDiscoverFeed(
    categorySignature,
    pickedWorkIds,
    picksLoaded,
    debouncedSearch,
  );

  const discoverViewTrackedRef = useRef(false);

  useEffect(() => {
    if (
      discoverViewTrackedRef.current ||
      feed.isLoading ||
      feed.works.length === 0
    ) {
      return;
    }

    discoverViewTrackedRef.current = true;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const deviceType =
      viewportWidth < 768
        ? "mobile"
        : viewportWidth < 1024
          ? "tablet"
          : "desktop";

    const metadata: Record<string, string | number> = {
      path: window.location.pathname,
      device_type: deviceType,
      viewport_width: viewportWidth,
      viewport_height: viewportHeight,
    };

    if (document.referrer) {
      metadata.referrer = document.referrer;
    }

    const utmSource = new URLSearchParams(
      window.location.search,
    ).get("utm_source");

    if (utmSource) {
      metadata.utm_source = utmSource;
    }

    trackProductEvent({
      event_name: "discover_view",
      metadata,
    });
  }, [feed.isLoading, feed.works.length]);

  function applyCategorySelection(
    nextCategories: Set<CreatorCategory>,
  ) {
    const nextSignature =
      buildDiscoverCategorySignature(
        nextCategories,
      );
    const previousSignature =
      categorySignatureRef.current;

    setSelectedCategories(nextCategories);

    if (
      nextSignature === previousSignature
    ) {
      return;
    }

    categorySignatureRef.current =
      nextSignature;

    trackProductEvent({
      event_name: "filter_change",
      metadata: {
        from: previousSignature,
        to: nextSignature,
      },
    });
  }

  const categoryButtonClass = (isActive: boolean) =>
    `h-[30px] rounded border px-4 text-[10px] font-semibold uppercase tracking-[0.08em] transition ${
      isActive
        ? "border-[rgba(192,132,252,0.65)] bg-[rgba(168,85,247,0.07)] text-[#c084fc] shadow-[0_0_0_1px_rgba(168,85,247,0.08)]"
        : "border-white/15 bg-transparent text-white/[0.78] hover:border-white/28 hover:bg-white/[0.025]"
    }`;

  const [pickPanelAddedCount] = useState(0);
  const [pickPanelPulseKey] = useState(0);
  const [pickPanelRefreshKey, setPickPanelRefreshKey] =
    useState(0);
  const [mobilePicksOpen, setMobilePicksOpen] =
    useState(false);
  const [selectedWork, setSelectedWork] =
    useState<FeedItem | null>(null);
  const [pickError, setPickError] = useState("");

  useEffect(() => {
    async function loadPicks() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPickedWorkIds(new Set());
        setPicksLoaded(true);
        return;
      }

      const { data, error } = await supabase
        .from("work_picks")
        .select("work_id")
        .eq("user_id", user.id);

      if (error) {
        console.error("LOAD PICKS ERROR:", error);
        setPicksLoaded(true);
        return;
      }

      setPickedWorkIds(
        new Set(
          (data ?? []).map((item) =>
            String(item.work_id),
          ),
        ),
      );
      setPicksLoaded(true);
    }

    void loadPicks();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED"
      ) {
        void loadPicks();
      }
    });

    function onPicksChanged() {
      void loadPicks();
    }

    window.addEventListener(
      "kovemu-picks-changed",
      onPicksChanged,
    );

    return () => {
      subscription.unsubscribe();
      window.removeEventListener(
        "kovemu-picks-changed",
        onPicksChanged,
      );
    };
  }, [supabase]);

  function closeWorkModalFromHistory() {
    setSelectedWork(null);
    setPickPanelRefreshKey((current) => current + 1);
  }

  const { requestClose: requestCloseWorkModal } =
    useOverlayHistory(
      "work",
      selectedWork !== null,
      closeWorkModalFromHistory,
    );

  useEffect(() => {
    if (!selectedWork) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestCloseWorkModal();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedWork, requestCloseWorkModal]);

  async function togglePick(work: FeedItem) {
    setPickError("");

    let userId: string;

    try {
      const user = await ensurePickSession();
      userId = user.id;
    } catch (error) {
      setPickError(
        error instanceof PickSessionError
          ? error.message
          : "Could not save this pick.",
      );
      return;
    }

    const alreadyPicked = pickedWorkIds.has(work.id);

    if (alreadyPicked) {
      setPickedWorkIds((current) => {
        const next = new Set(current);
        next.delete(work.id);
        return next;
      });

      const { error } = await supabase
        .from("work_picks")
        .delete()
        .eq("user_id", userId)
        .eq("work_id", work.id);

      if (error) {
        console.error("REMOVE PICK ERROR:", error);
        setPickedWorkIds((current) => {
          const next = new Set(current);
          next.add(work.id);
          return next;
        });
      } else {
        trackProductEvent({
          event_name: "save",
          artist_id: work.artistId,
          work_id: work.id,
          metadata: {
            action: "unsave",
          },
        });
        setPickPanelRefreshKey((current) => current + 1);
      }

      return;
    }

    setPickedWorkIds((current) => {
      const next = new Set(current);
      next.add(work.id);
      return next;
    });

    const { error } = await insertWorkPick(supabase, {
      userId,
      workId: work.id,
      artistId: work.artistId,
    });

    if (error) {
      console.error("SAVE PICK ERROR:", error);
      setPickedWorkIds((current) => {
        const next = new Set(current);
        next.delete(work.id);
        return next;
      });
      return;
    }

    trackProductEvent({
      event_name: "save",
      artist_id: work.artistId,
      work_id: work.id,
      metadata: {
        action: "save",
      },
    });
    setPickPanelRefreshKey((current) => current + 1);
    feed.removePickedWork(work.id);
    void feed.appendNextBatch();
  }

  function savedPanelWorkToFeedItem(
    work: SavedPanelWork,
  ): FeedItem {
    return {
      id: work.id,
      artistId: work.artistId,
      artistName: work.artistName,
      category: "",
      type: work.type,
      source: work.source,
      image: work.image,
      videoId: work.videoId,
      title: work.title,
      description: work.description,
      caption: work.caption,
      sourceUrl: work.sourceUrl,
      rotationDegrees: work.rotationDegrees,
    };
  }

  function openWork(work: FeedItem) {
    setSelectedWork(work);

    trackProductEvent({
      event_name: "card_open",
      work_id: work.id,
      metadata: {
        source: getAnalyticsSource(work),
      },
    });
  }

  function openPickedWork(work: SavedPanelWork) {
    const fromFeed = feed.works.find(
      (item) => item.id === work.id,
    );

    openWork(fromFeed ?? savedPanelWorkToFeedItem(work));
  }

  function handlePanelUnsave(work: SavedPanelWork) {
    void togglePick(savedPanelWorkToFeedItem(work));
  }

  return (
    <>
      <div className="w-full min-w-0">
        <div className="mb-[22px]">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-5 w-0.5 shrink-0 rounded-full bg-[#a855f7]"
            />
            <h1 className="text-xl font-semibold leading-tight text-white/[0.94]">
              Discover
            </h1>
          </div>
          <div className="h-5" aria-hidden="true" />
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-[11px] md:mb-6">
          <button
            type="button"
            onClick={() =>
              applyCategorySelection(
                handleAllCategoryClick(
                  selectedCategories,
                ),
              )
            }
            className={categoryButtonClass(
              isAllActive,
            )}
          >
            ALL
          </button>

          {CREATOR_CATEGORY_OPTIONS.map((tab) => {
            const isActive = selectedCategories.has(
              tab.value,
            );

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() =>
                  applyCategorySelection(
                    handleCreatorCategoryClick(
                      selectedCategories,
                      tab.value,
                    ),
                  )
                }
                className={categoryButtonClass(
                  isActive,
                )}
              >
                {tab.label}
              </button>
            );
          })}

          <input
            type="search"
            value={searchInput}
            onChange={(event) =>
              setSearchInput(
                event.target.value,
              )
            }
            placeholder="Search clips"
            aria-label="Search clips"
            className="ml-0 h-8 min-w-[140px] flex-1 rounded border border-white/12 bg-white/[0.04] px-2.5 text-[10px] text-white outline-none transition placeholder:text-white/[0.32] focus:border-white/25 sm:max-w-[180px] sm:flex-none md:ml-2 md:text-[11px]"          />
        </div>

        {pickError ? (
          <p className="mb-3 text-sm text-zinc-500">
            {pickError}
          </p>
        ) : null}

        <DiscoverCarousel
          key={`${categorySignature}:${debouncedSearch}`}
          works={feed.works}
          pickedWorkIds={pickedWorkIds}
          isLoading={feed.isLoading}
          isLoadingMore={feed.isLoadingMore}
          onWorkClick={openWork}
          onNearEnd={() => {
            void feed.appendNextBatch();
          }}
          onPrune={feed.prune}
        />

        <div className="mt-7 text-center md:mt-8">
          <p className="text-sm text-white/[0.38]">
            {t("discoverHint")}
          </p>
          <p className="mt-1 hidden text-xs text-white/25 md:block">
            {t("discoverWheelHint")}
          </p>
        </div>
      </div>

      <SavedPanel
        refreshKey={pickPanelRefreshKey}
        addedCount={pickPanelAddedCount}
        pulseKey={pickPanelPulseKey}
        onWorkClick={openPickedWork}
        onUnsave={handlePanelUnsave}
        mobileOpen={mobilePicksOpen}
        onMobileOpenChange={setMobilePicksOpen}
      />
      {selectedWork && (
        <WorkMediaModal
          work={selectedWork}
          isSaved={pickedWorkIds.has(selectedWork.id)}
          onClose={requestCloseWorkModal}
          onToggleSave={() => void togglePick(selectedWork)}
        />
      )}

    </>
  );
}
