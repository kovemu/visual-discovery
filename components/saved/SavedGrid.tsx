"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import WorkMediaModal from "@/components/works/WorkMediaModal";
import { trackProductEvent } from "@/lib/analytics/trackProductEvent";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import {
  getAnalyticsSource,
  getSourceLabel,
  getWorkThumbnail,
  isPlayableVideo,
  type WorkMediaItem,
} from "@/lib/works/workDisplay";

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
  artist_id: string;
  created_at: string;
  work:
    | PickedWorkRow
    | PickedWorkRow[]
    | null;
};

function mapPickedWork(
  work: PickedWorkRow,
): WorkMediaItem | null {
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
    sourceUrl: work.source_url,
  };
}

export default function SavedGrid() {
  const { t } = useTranslation();
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [works, setWorks] = useState<
    WorkMediaItem[]
  >([]);
  const [loading, setLoading] =
    useState(true);
  const [
    selectedWork,
    setSelectedWork,
  ] = useState<WorkMediaItem | null>(
    null,
  );

  const loadSaved = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setWorks([]);
      setLoading(false);
      return;
    }

    const { data, error } =
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
        "LOAD SAVED ERROR:",
        error,
      );
      setWorks([]);
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
        ): item is WorkMediaItem =>
          item !== null,
      );

    setWorks(mapped);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  async function handleUnsave(
    work: WorkMediaItem,
  ) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    setWorks((current) =>
      current.filter(
        (item) =>
          item.id !== work.id,
      ),
    );

    if (
      selectedWork?.id === work.id
    ) {
      setSelectedWork(null);
    }

    const { error } =
      await supabase
        .from("work_picks")
        .delete()
        .eq("user_id", user.id)
        .eq("work_id", work.id);

    if (error) {
      console.error(
        "UNSAVE ERROR:",
        error,
      );
      void loadSaved();
      return;
    }

    trackProductEvent({
      event_name: "save",
      artist_id: work.artistId,
      work_id: work.id,
      metadata: {
        action: "unsave",
      },
    });
  }

  function openWork(work: WorkMediaItem) {
    setSelectedWork(work);

    trackProductEvent({
      event_name: "card_open",
      work_id: work.id,
      metadata: {
        source: getAnalyticsSource(
          work,
        ),
      },
    });
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {Array.from({ length: 6 }).map(
          (_, index) => (
            <div
              key={index}
              className="aspect-[3/4] animate-pulse rounded-2xl bg-[#181818]"
            />
          ),
        )}
      </div>
    );
  }

  if (works.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        {t("noSaved")}
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {works.map((work) => {
          const thumbnail =
            getWorkThumbnail(work);
          const sourceLabel =
            getSourceLabel(work, {
              youtube: t("sourceYoutube"),
              tiktok: t("sourceTiktok"),
              image: t("sourceImage"),
            });

          return (
            <button
              key={work.id}
              type="button"
              onClick={() =>
                openWork(work)
              }
              className="group text-left"
            >
              <article className="relative overflow-hidden rounded-2xl bg-neutral-950">
                <div className="aspect-[3/4] w-full">
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt=""
                      draggable={false}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-white/30">
                      —
                    </div>
                  )}
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-3">
                  {work.artistName && (
                    <p className="line-clamp-1 text-sm font-medium text-white">
                      {work.artistName}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/70">
                    {sourceLabel}
                  </p>
                </div>

                {isPlayableVideo(work) && (
                  <div className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-[10px] text-white/90">
                    ▶
                  </div>
                )}

                <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold text-gray-950">
                  {t("savedState")}
                </div>
              </article>
            </button>
          );
        })}
      </div>

      {selectedWork && (
        <WorkMediaModal
          work={selectedWork}
          isSaved
          onClose={() =>
            setSelectedWork(null)
          }
          onToggleSave={() =>
            void handleUnsave(
              selectedWork,
            )
          }
          onOriginalClick={() =>
            trackProductEvent({
              event_name:
                "original_click",
              work_id:
                selectedWork.id,
              metadata: {
                source:
                  getAnalyticsSource(
                    selectedWork,
                  ),
              },
            })
          }
        />
      )}
    </>
  );
}
