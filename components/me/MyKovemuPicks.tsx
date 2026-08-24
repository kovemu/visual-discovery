"use client";

import { ChevronsLeft } from "lucide-react";
import { Play, Trash2 } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import RemoveAllPicksDialog from "@/components/me/RemoveAllPicksDialog";
import TikTokPlayerEmbed from "@/components/works/TikTokPlayerEmbed";
import { createClient } from "@/lib/supabase/client";

type PickWork = {
  id: string;
  artistId: string;
  artistName: string;
  category: string;
  type: "image" | "youtube" | "tiktok";
  image?: string;
  videoId?: string;
  caption: string | null;
  sourceUrl?: string;
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
  artist:
    | {
        id: string;
        name: string;
        category: string;
      }
    | {
        id: string;
        name: string;
        category: string;
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

type ArtistPickGroup = {
  artistId: string;
  artistName: string;
  category: string;
  latestPickAt: string;
  works: PickWork[];
};

type CategoryFilter =
  | "Music"
  | "Dance"
  | "Art"
  | "Cosplay";

const CATEGORY_FILTERS: CategoryFilter[] =
  [
    "Music",
    "Dance",
    "Art",
    "Cosplay",
  ];

function sortArtistGroups(
  groups: ArtistPickGroup[],
) {
  return [...groups].sort((a, b) => {
    const countDiff =
      b.works.length - a.works.length;

    if (countDiff !== 0) {
      return countDiff;
    }

    return b.latestPickAt.localeCompare(
      a.latestPickAt,
    );
  });
}

function getDefaultCategoryFilter(
  groups: ArtistPickGroup[],
): CategoryFilter {
  const counts = new Map<
    CategoryFilter,
    number
  >(
    CATEGORY_FILTERS.map(
      (category) => [
        category,
        0,
      ],
    ),
  );

  for (const group of groups) {
    const matchedCategory =
      CATEGORY_FILTERS.find(
        (category) =>
          normalizeCategory(
            group.category,
          ) ===
          normalizeCategory(
            category,
          ),
      );

    if (!matchedCategory) {
      continue;
    }

    counts.set(
      matchedCategory,
      (counts.get(
        matchedCategory,
      ) ?? 0) +
        group.works.length,
    );
  }

  return CATEGORY_FILTERS.reduce(
    (best, category) => {
      const count =
        counts.get(category) ?? 0;
      const bestCount =
        counts.get(best) ?? 0;

      return count > bestCount
        ? category
        : best;
    },
    "Music",
  );
}

function normalizeCategory(
  category: string,
) {
  return category.trim().toLowerCase();
}

function formatCategory(
  category: string,
) {
  if (!category) {
    return "";
  }

  return (
    category.charAt(0).toUpperCase() +
    category.slice(1)
  );
}

function mapPickedWork(
  work: PickedWorkRow,
  pickedAt: string,
): PickWork | null {
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
    category: artist.category,
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
    pickedAt,
  };
}

function buildArtistGroups(
  pickRows: PickRow[],
): ArtistPickGroup[] {
  const groupMap = new Map<
    string,
    ArtistPickGroup
  >();

  for (const pick of pickRows) {
    if (!pick.work) {
      continue;
    }

    const workRow = Array.isArray(pick.work)
      ? pick.work[0]
      : pick.work;

    if (!workRow) {
      continue;
    }

    const mappedWork = mapPickedWork(
      workRow,
      pick.created_at,
    );

    if (!mappedWork) {
      continue;
    }

    const existing = groupMap.get(
      pick.artist_id,
    );

    if (existing) {
      existing.works.push(mappedWork);

      if (
        pick.created_at >
        existing.latestPickAt
      ) {
        existing.latestPickAt =
          pick.created_at;
      }

      continue;
    }

    groupMap.set(pick.artist_id, {
      artistId: pick.artist_id,
      artistName: mappedWork.artistName,
      category: mappedWork.category,
      latestPickAt: pick.created_at,
      works: [mappedWork],
    });
  }

  return sortArtistGroups(
    Array.from(
      groupMap.values(),
    ).map((group) => ({
      ...group,
      works: [...group.works].sort(
        (a, b) =>
          b.pickedAt.localeCompare(
            a.pickedAt,
          ),
      ),
    })),
  );
}

function PickWorkCard({
  work,
  artistName,
  onClick,
}: {
  work: PickWork;
  artistName: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full overflow-hidden rounded-xl border border-gray-200 bg-white text-left md:rounded-2xl"
    >
      {work.type === "youtube" &&
      work.videoId ? (
        <div className="relative aspect-[9/16] overflow-hidden bg-black">
          <img
            src={`https://i.ytimg.com/vi/${work.videoId}/hqdefault.jpg`}
            alt={`${artistName} picked work`}
            draggable={false}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-black/10 transition group-hover:bg-black/20" />

          <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white md:right-2 md:top-2 md:h-7 md:w-7">
            <Play
              size={10}
              className="fill-white md:hidden"
            />
            <Play
              size={12}
              className="hidden fill-white md:block"
            />
          </div>
        </div>
      ) : work.image ? (
        <img
          src={work.image}
          alt={`${artistName} picked work`}
          draggable={false}
          className="aspect-[9/16] w-full object-cover transition duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="aspect-[9/16] bg-gray-100" />
      )}

      {work.caption && (
        <div className="p-1.5 md:p-3">
          <p className="line-clamp-1 break-words text-[10px] leading-4 text-gray-600 md:line-clamp-2 md:text-sm md:leading-normal">
            {work.caption}
          </p>
        </div>
      )}
    </button>
  );
}

export default function MyKovemuPicks() {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [
    artistGroups,
    setArtistGroups,
  ] = useState<ArtistPickGroup[]>([]);

  const [
    pickedWorkIds,
    setPickedWorkIds,
  ] = useState<Set<string>>(
    new Set(),
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState<CategoryFilter>("Music");

  const initialCategorySetRef =
    useRef(false);

  const [
    selectedWork,
    setSelectedWork,
  ] = useState<PickWork | null>(null);

  const [
    removeTarget,
    setRemoveTarget,
  ] = useState<ArtistPickGroup | null>(
    null,
  );

  const [
    removingAll,
    setRemovingAll,
  ] = useState(false);

  const loadPicks = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setArtistGroups([]);
      setPickedWorkIds(new Set());
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
                name,
                category
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
        "LOAD MY KOVEMU PICKS ERROR:",
        error,
      );
      setLoading(false);
      return;
    }

    const rows =
      (data ?? []) as unknown as PickRow[];
    const groups =
      buildArtistGroups(rows);

    setArtistGroups(groups);
    setPickedWorkIds(
      new Set(
        rows.map((pick) =>
          String(pick.work_id),
        ),
      ),
    );

    if (
      !initialCategorySetRef.current
    ) {
      setCategoryFilter(
        getDefaultCategoryFilter(
          groups,
        ),
      );
      initialCategorySetRef.current =
        true;
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadPicks();
  }, [loadPicks]);

  const filteredGroups = useMemo(() => {
    return sortArtistGroups(
      artistGroups.filter(
        (group) =>
          normalizeCategory(
            group.category,
          ) ===
          normalizeCategory(
            categoryFilter,
          ),
      ),
    );
  }, [
    artistGroups,
    categoryFilter,
  ]);

  async function togglePick(
    work: PickWork,
  ) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const workId = String(work.id);
    const alreadyPicked =
      pickedWorkIds.has(workId);

    if (alreadyPicked) {
      const { error } =
        await supabase
          .from("work_picks")
          .delete()
          .eq("user_id", user.id)
          .eq("work_id", workId);

      if (error) {
        console.error(
          "REMOVE PICK ERROR:",
          error,
        );
        return;
      }

      setPickedWorkIds((current) => {
        const next = new Set(current);
        next.delete(workId);
        return next;
      });

      setArtistGroups((current) =>
        current
          .map((group) => {
            if (
              group.artistId !==
              work.artistId
            ) {
              return group;
            }

            const nextWorks =
              group.works.filter(
                (item) =>
                  item.id !== workId,
              );

            if (
              nextWorks.length === 0
            ) {
              return null;
            }

            return {
              ...group,
              works: nextWorks,
              latestPickAt:
                nextWorks[0]?.pickedAt ??
                group.latestPickAt,
            };
          })
          .filter(
            (
              group,
            ): group is ArtistPickGroup =>
              group !== null,
          ),
      );

      return;
    }

    const { error } =
      await supabase
        .from("work_picks")
        .insert({
          user_id: user.id,
          work_id: workId,
          artist_id: work.artistId,
        });

    if (error) {
      console.error(
        "SAVE PICK ERROR:",
        error,
      );
      return;
    }

    setPickedWorkIds((current) => {
      const next = new Set(current);
      next.add(workId);
      return next;
    });
  }

  async function confirmRemoveAll() {
    if (!removeTarget) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    setRemovingAll(true);

    const { error } =
      await supabase
        .from("work_picks")
        .delete()
        .eq("user_id", user.id)
        .eq(
          "artist_id",
          removeTarget.artistId,
        );

    setRemovingAll(false);

    if (error) {
      console.error(
        "REMOVE ALL PICKS ERROR:",
        error,
      );
      return;
    }

    const removedWorkIds =
      new Set(
        removeTarget.works.map(
          (work) => work.id,
        ),
      );

    setPickedWorkIds((current) => {
      const next = new Set(current);

      for (const workId of removedWorkIds) {
        next.delete(workId);
      }

      return next;
    });

    setArtistGroups((current) =>
      current.filter(
        (group) =>
          group.artistId !==
          removeTarget.artistId,
      ),
    );

    if (
      selectedWork &&
      removedWorkIds.has(
        selectedWork.id,
      )
    ) {
      setSelectedWork(null);
    }

    setRemoveTarget(null);
  }

  function closeWorkModal() {
    setSelectedWork(null);
  }

  if (loading) {
    return (
      <p className="text-sm text-gray-400">
        Loading...
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
        {CATEGORY_FILTERS.map(
          (filter) => (
            <button
              key={filter}
              type="button"
              onClick={() =>
                setCategoryFilter(
                  filter,
                )
              }
              className={
                categoryFilter ===
                filter
                  ? "text-fuchsia-600"
                  : "text-gray-500 transition hover:text-gray-900"
              }
            >
              {filter}
            </button>
          ),
        )}
      </div>

      {artistGroups.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-gray-100 px-6 py-16 text-center">
          <p className="font-bold text-gray-900">
            No Picks yet.
          </p>

          <p className="mt-2 text-sm text-gray-500">
            Discover creators you love.
          </p>

          <Link
            href="/discover"
            className="mt-6 inline-flex rounded-full bg-fuchsia-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-fuchsia-700"
          >
            Discover
          </Link>
        </div>
      ) : filteredGroups.length ===
        0 ? (
        <div className="mt-16 rounded-2xl border border-gray-100 px-6 py-16 text-center">
          <p className="font-bold text-gray-900">
            No {categoryFilter} Picks
            yet.
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          {filteredGroups.map(
            (group) => (
              <section
                key={group.artistId}
              >
<div className="min-w-0">
  {/* Pick 관리 */}
  <div className="flex items-center gap-1.5">
    <span className="text-sm font-semibold text-gray-500">
      {group.works.length}{" "}
      {group.works.length === 1
        ? "Pick /"
        : "Picks /"}
    </span>

    <button
      type="button"
      onClick={() =>
        setRemoveTarget(group)
      }
      className="inline-flex items-center gap-px text-[12px] font-bold text-gray-700 transition hover:text-red-600"
    >
      <span>ALL</span>
      <Trash2 size={12} />
    </button>
  </div>

  {/* Artist */}
  <div className="mt-1.5 flex items-center">
    <h2 className="truncate text-xl font-black text-gray-950">
      {group.artistName}
    </h2>

    <Link
      href={`/creator/${group.artistId}`}
      className="ml-8 text-sm font-semibold text-fuchsia-600 transition hover:text-fuchsia-700"
    >
      View Artist →
    </Link>
  </div>
</div>

                <div className="mt-5 grid w-full grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {group.works.map(
                    (work) => (
                      <PickWorkCard
                        key={work.id}
                        work={work}
                        artistName={
                          group.artistName
                        }
                        onClick={() =>
                          setSelectedWork(
                            work,
                          )
                        }
                      />
                    ),
                  )}
                </div>
              </section>
            ),
          )}
        </div>
      )}

      {selectedWork && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={closeWorkModal}
        >
          <div
            className="relative flex max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex min-w-0 flex-1 items-center justify-center bg-neutral-900">
              {selectedWork.type ===
                "youtube" &&
              selectedWork.videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${selectedWork.videoId}?autoplay=1&rel=0`}
                  title={`${selectedWork.artistName} video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="aspect-[9/16] max-h-[80vh] w-full"
                />
              ) : selectedWork.type ===
                  "tiktok" &&
                selectedWork.videoId ? (
                <TikTokPlayerEmbed
                  videoId={
                    selectedWork.videoId
                  }
                  title={`${selectedWork.artistName} TikTok`}
                />
              ) : selectedWork.image ? (
                <img
                  src={
                    selectedWork.image
                  }
                  alt={`${selectedWork.artistName} work`}
                  draggable={false}
                  referrerPolicy="no-referrer"
                  className="max-h-[80vh] w-full object-contain"
                />
              ) : null}
            </div>

            <aside className="relative w-[300px] shrink-0 bg-white p-6">
              <button
                type="button"
                onClick={closeWorkModal}
                aria-label="Close work"
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-600 transition hover:bg-gray-200 hover:text-gray-950"
              >
                ×
              </button>

              <div className="pr-10">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-600">
                  {formatCategory(
                    selectedWork.category,
                  )}
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-950">
                  {
                    selectedWork.artistName
                  }
                </h2>
              </div>

              {selectedWork.caption && (
                <p className="mt-5 line-clamp-[8] text-sm leading-6 text-gray-600">
                  {
                    selectedWork.caption
                  }
                </p>
              )}

              <button
                type="button"
                onClick={() =>
                  togglePick(
                    selectedWork,
                  )
                }
                className={`mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full border text-sm font-bold transition ${
                  pickedWorkIds.has(
                    selectedWork.id,
                  )
                    ? "border-fuchsia-600 bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                    : "border-gray-200 bg-white text-gray-800 hover:border-fuchsia-200 hover:text-fuchsia-600"
                }`}
              >
                <span>
                  {pickedWorkIds.has(
                    selectedWork.id,
                  )
                    ? "✓"
                    : "+"}
                </span>

                {pickedWorkIds.has(
                  selectedWork.id,
                )
                  ? "Picked"
                  : "Pick"}
              </button>

              <Link
                href={`/creator/${selectedWork.artistId}`}
                onClick={closeWorkModal}
                className="mt-3 flex h-11 w-full items-center justify-center rounded-full bg-gray-950 px-5 text-sm font-bold text-white transition hover:bg-gray-800"
              >
                View Artist Profile
              </Link>
            </aside>
          </div>
        </div>
      )}

      {removeTarget && (
        <RemoveAllPicksDialog
          artistName={
            removeTarget.artistName
          }
          pickCount={
            removeTarget.works.length
          }
          removing={removingAll}
          onCancel={() => {
            if (!removingAll) {
              setRemoveTarget(null);
            }
          }}
          onConfirm={() => {
            void confirmRemoveAll();
          }}
        />
      )}
    </>
  );
}
