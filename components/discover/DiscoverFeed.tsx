"use client";

import { useEffect, useMemo, useState } from "react";

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

  const feed = useDiscoverFeed(
    categorySignature,
    pickedWorkIds,
    picksLoaded,
    debouncedSearch,
  );

  const categoryButtonClass = (isActive: boolean) =>
    `rounded-sm border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] transition md:px-3 md:py-1.5 md:text-xs ${
      isActive
        ? "border-white/75 text-white"
        : "border-transparent text-white/35 hover:border-white/20 hover:text-white/70"
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
      <div className="w-full min-w-0 pt-8 md:pt-12">
        <div className="mb-5 flex flex-wrap items-center gap-2 md:mb-6 md:gap-3">
          <button
            type="button"
            onClick={() =>
              setSelectedCategories(
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
                  setSelectedCategories(
                    (current) =>
                      handleCreatorCategoryClick(
                        current,
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
            className="h-8 min-w-[140px] flex-1 rounded-sm border border-white/15 bg-white/5 px-2.5 text-xs text-white outline-none transition placeholder:text-white/35 focus:border-white/30 sm:max-w-[200px] sm:flex-none"
          />
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
          <p className="text-sm text-zinc-400">
            {t("discoverHint")}
          </p>
          <p className="mt-1 hidden text-xs text-zinc-600 md:block">
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
