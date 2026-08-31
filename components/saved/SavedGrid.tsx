"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import WorkMediaModal from "@/components/works/WorkMediaModal";
import RotatedWorkThumbnail from "@/components/works/RotatedWorkThumbnail";
import ImportClipForm from "@/components/saved/ImportClipForm";
import { trackProductEvent } from "@/lib/analytics/trackProductEvent";
import { useOverlayHistory } from "@/lib/hooks/useOverlayHistory";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import {
  getAnalyticsSource,
  getWorkThumbnail,
  type WorkMediaItem,
} from "@/lib/works/workDisplay";

const DRAG_ACTIVATION_DISTANCE_PX = 8;
const TOUCH_ACTIVATION_DELAY_MS = 200;
const TOUCH_ACTIVATION_TOLERANCE_PX = 8;
const SAVED_GRID_CLASS =
  "grid grid-cols-3 gap-1.5 sm:grid-cols-[repeat(auto-fill,150px)] sm:gap-2";
const SAVED_CARD_MEDIA_CLASS =
  "aspect-[9/16] w-full sm:aspect-auto sm:h-[260px]";
const SAVED_CARD_BUTTON_CLASS =
  "group w-full sm:w-[150px] text-left";
const SAVED_SKELETON_CLASS =
  "aspect-[9/16] w-full animate-pulse rounded-2xl bg-[#181818] sm:aspect-auto sm:h-[260px] sm:w-[150px]";

type PickedWorkRow = {
  id: number | string;
  source: string;
  source_id: string | null;
  source_url: string;
  thumbnail_url: string | null;
  title: string | null;
  description: string | null;
  rotation_degrees: number | null;
  thumbnail_rotation_degrees: number | null;
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
  artist_id: string | null;
  created_at: string;
  sort_order: number | string | null;
  work:
    | PickedWorkRow
    | PickedWorkRow[]
    | null;
};

function asSortOrder(
  value: unknown,
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function compareSavedPickRows(
  left: PickRow,
  right: PickRow,
) {
  const leftOrder = asSortOrder(left.sort_order);
  const rightOrder = asSortOrder(right.sort_order);

  if (
    leftOrder !== null &&
    rightOrder !== null &&
    leftOrder !== rightOrder
  ) {
    return leftOrder - rightOrder;
  }

  if (leftOrder !== null && rightOrder === null) {
    return -1;
  }

  if (leftOrder === null && rightOrder !== null) {
    return 1;
  }

  return (
    new Date(right.created_at).getTime() -
    new Date(left.created_at).getTime()
  );
}

function mapPickedWork(
  work: PickedWorkRow,
): WorkMediaItem | null {
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
    sourceUrl: work.source_url,
    title: work.title,
    description: work.description,
    caption:
      work.description ??
      work.title ??
      null,
    rotationDegrees: work.rotation_degrees ?? 0,
    thumbnailRotationDegrees:
      work.thumbnail_rotation_degrees ?? 0,
  };
}

function SavedCardFace({
  work,
}: {
  work: WorkMediaItem;
}) {
  const thumbnail = getWorkThumbnail(work);

  return (
    <article className="relative overflow-hidden rounded-2xl bg-neutral-950">
      <div className={SAVED_CARD_MEDIA_CLASS}>
        {thumbnail ? (
          <RotatedWorkThumbnail
            src={thumbnail}
            alt=""
            rotationDegrees={
              work.thumbnailRotationDegrees
            }
            draggable={false}
            imgClassName="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-white/30">
            —
          </div>
        )}
      </div>
    </article>
  );
}

function SortableSavedCard({
  work,
  onOpen,
}: {
  work: WorkMediaItem;
  onOpen: (work: WorkMediaItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: work.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${SAVED_CARD_BUTTON_CLASS} relative`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(work)}
        className="w-full text-left"
      >
        <SavedCardFace work={work} />
      </button>
      <button
        type="button"
        aria-label="Reorder"
        className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 touch-none items-center justify-center rounded-md bg-black/55 text-white/90 backdrop-blur-sm"
        {...attributes}
        {...listeners}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          listeners?.onPointerDown?.(event);
        }}
      >
        <GripVertical size={14} />
      </button>
    </div>
  );
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
  const [
    activeWork,
    setActiveWork,
  ] = useState<WorkMediaItem | null>(
    null,
  );

  const suppressClickRef = useRef(false);

  function closeSavedWorkModal() {
    setSelectedWork(null);
  }

  const {
    requestClose: requestCloseSavedWorkModal,
  } = useOverlayHistory(
    "work",
    selectedWork !== null,
    closeSavedWorkModal,
  );

  useEffect(() => {
    if (!selectedWork) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        requestCloseSavedWorkModal();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    selectedWork,
    requestCloseSavedWorkModal,
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: DRAG_ACTIVATION_DISTANCE_PX,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: TOUCH_ACTIVATION_DELAY_MS,
        tolerance: TOUCH_ACTIVATION_TOLERANCE_PX,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter:
        sortableKeyboardCoordinates,
    }),
  );

  const workIds = useMemo(
    () => works.map((work) => work.id),
    [works],
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
            sort_order,
            work:works (
              id,
              source,
              source_id,
              source_url,
              thumbnail_url,
              title,
              description,
              rotation_degrees,
              thumbnail_rotation_degrees,
              artist:creators (
                id,
                name
              )
            )
          `,
        )
        .eq("user_id", user.id)
        .order("sort_order", {
          ascending: true,
          nullsFirst: false,
        })
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

    const mapped = ((data ?? []) as PickRow[])
      .slice()
      .sort(compareSavedPickRows)
      .map((pickRow) => {
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

    function onPicksChanged() {
      void loadSaved();
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
  }, [loadSaved, supabase]);

  async function persistSavedOrder(
    orderedWorks: WorkMediaItem[],
  ) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: new Error("Not signed in.") };
    }

    const results = await Promise.all(
      orderedWorks.map((work, index) =>
        supabase
          .from("work_picks")
          .update({
            sort_order: index,
          })
          .eq("user_id", user.id)
          .eq("work_id", work.id),
      ),
    );

    const failed = results.find(
      (result) => result.error,
    );

    return {
      error: failed?.error ?? null,
    };
  }

  function handleDragStart(
    event: DragStartEvent,
  ) {
    suppressClickRef.current = true;
    const current = works.find(
      (work) => work.id === String(event.active.id),
    );
    setActiveWork(current ?? null);
  }

  function releaseClickSuppression() {
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 50);
  }

  async function handleDragEnd(
    event: DragEndEvent,
  ) {
    setActiveWork(null);
    releaseClickSuppression();

    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const previousWorks = works;
    const oldIndex = previousWorks.findIndex(
      (work) => work.id === String(active.id),
    );
    const newIndex = previousWorks.findIndex(
      (work) => work.id === String(over.id),
    );

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const nextWorks = arrayMove(
      previousWorks,
      oldIndex,
      newIndex,
    );

    setWorks(nextWorks);

    const { error } =
      await persistSavedOrder(nextWorks);

    if (error) {
      console.error(
        "SAVE SAVED ORDER ERROR:",
        error,
      );
      setWorks(previousWorks);
    }
  }

  function handleDragCancel() {
    setActiveWork(null);
    releaseClickSuppression();
  }

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
      requestCloseSavedWorkModal();
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
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

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
      <>
        <ImportClipForm
          onImported={() => {
            void loadSaved();
          }}
        />
        <div className={SAVED_GRID_CLASS}>
          {Array.from({ length: 6 }).map(
            (_, index) => (
              <div
                key={index}
                className={SAVED_SKELETON_CLASS}
              />
            ),
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <ImportClipForm
        onImported={() => {
          void loadSaved();
        }}
      />

      {works.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {t("noSaved")}
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={(event) => {
            void handleDragEnd(event);
          }}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={workIds}
            strategy={rectSortingStrategy}
          >
            <div className={SAVED_GRID_CLASS}>
              {works.map((work) => (
                <SortableSavedCard
                  key={work.id}
                  work={work}
                  onOpen={openWork}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeWork ? (
              <div className="aspect-[9/16] w-[calc((100vw-1.5rem)/3)] scale-[1.02] shadow-[0_12px_28px_rgba(0,0,0,0.55)] sm:aspect-auto sm:h-[260px] sm:w-[150px]">
                <SavedCardFace work={activeWork} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {selectedWork && (
        <WorkMediaModal
          work={selectedWork}
          isSaved
          onClose={requestCloseSavedWorkModal}
          onToggleSave={() =>
            void handleUnsave(
              selectedWork,
            )
          }
        />
      )}
    </>
  );
}
