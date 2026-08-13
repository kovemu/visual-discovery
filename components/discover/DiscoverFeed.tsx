"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type FeedItem = {
  id: string;
  artistId: string;
  artistName: string;
  category: string;

  type?: "image" | "youtube";

  image?: string;
  videoId?: string;

  caption?: string | null;

  sourceUrl?: string;
  artistUrl?: string;
};

const categories = [
  "For You",
  "Music",
  "Dance",
  "Film",
  "Art",
  "Cosplay",
];

const videoHeights = [
  "h-[210px]",
  "h-[270px]",
  "h-[330px]",
];

type DiscoverFeedProps = {
  works: FeedItem[];
};

function shuffleWorks(
  works: FeedItem[],
): FeedItem[] {
  const shuffled = [...works];

  for (
    let i = shuffled.length - 1;
    i > 0;
    i -= 1
  ) {
    const randomIndex = Math.floor(
      Math.random() * (i + 1),
    );

    [shuffled[i], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[i],
    ];
  }

  return shuffled;
}

function getWorkThumbnail(work: FeedItem) {
  if (
    work.type === "youtube" &&
    work.videoId
  ) {
    return `https://i.ytimg.com/vi/${work.videoId}/hqdefault.jpg`;
  }

  return work.image ?? "";
}

function getVideoHeight(
  work: FeedItem,
) {
  const key =
    work.videoId ?? work.id;

  let hash = 0;

  for (let i = 0; i < key.length; i += 1) {
    hash =
      (hash * 31 +
        key.charCodeAt(i)) %
      10000;
  }

  return videoHeights[
    hash % videoHeights.length
  ];
}

export default function DiscoverFeed({
  works,
}: DiscoverFeedProps) {
  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState("For You");

  const [displayWorks, setDisplayWorks] =
    useState<FeedItem[]>(works);

  const [selectedWork, setSelectedWork] =
    useState<FeedItem | null>(null);

  const [
    hoveredWorkId,
    setHoveredWorkId,
  ] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedWork) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setSelectedWork(null);
      }
    };

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        "";

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [selectedWork]);

  const handleCategoryClick = (
    category: string,
  ) => {
    setSelectedCategory(category);

    setDisplayWorks(
      shuffleWorks(works),
    );
  };

  const filteredWorks =
    selectedCategory === "For You"
      ? displayWorks
      : displayWorks.filter(
          (work) =>
            work.category.toLowerCase() ===
            selectedCategory.toLowerCase(),
        );

  return (
    <>
      {/* Category filter */}
      <nav className="border-b border-gray-100 bg-white py-4">
        <div className="flex items-center gap-7 overflow-x-auto text-sm font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map(
            (category) => {
              const active =
                selectedCategory ===
                category;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() =>
                    handleCategoryClick(
                      category,
                    )
                  }
                  className={`shrink-0 cursor-pointer border-b-2 pb-2 transition ${
                    active
                      ? "border-fuchsia-600 text-fuchsia-600"
                      : "border-transparent text-gray-500 hover:text-fuchsia-600"
                  }`}
                >
                  {category}
                </button>
              );
            },
          )}
        </div>
      </nav>

      {/* Masonry feed */}
      <div className="mt-4 columns-1 gap-4 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-4">
        {filteredWorks.map(
          (work, index) => {
            const isYoutube =
              work.type === "youtube" &&
              Boolean(work.videoId);

            const isPreviewing =
              isYoutube &&
              hoveredWorkId === work.id;

            const thumbnail =
              getWorkThumbnail(work);

            const videoHeight =
              getVideoHeight(work);

            return (
              <div
                key={`${work.id}-${index}`}
                role="button"
                tabIndex={0}
                onClick={() =>
                  setSelectedWork(work)
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                      "Enter" ||
                    event.key === " "
                  ) {
                    setSelectedWork(
                      work,
                    );
                  }
                }}
                onMouseEnter={() => {
                  if (isYoutube) {
                    setHoveredWorkId(
                      work.id,
                    );
                  }
                }}
                onMouseLeave={() => {
                  if (
                    hoveredWorkId ===
                    work.id
                  ) {
                    setHoveredWorkId(
                      null,
                    );
                  }
                }}
                className="group mb-4 block w-full cursor-pointer break-inside-avoid text-left"
              >
                <article className="overflow-hidden rounded-2xl bg-gray-100">
                  <div className="relative overflow-hidden">
                    {isYoutube &&
                    work.videoId ? (
                      <div
                        className={`${videoHeight} w-full overflow-hidden bg-black`}
                      >
                        {isPreviewing ? (
                          <iframe
                            src={`https://www.youtube.com/embed/${work.videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${work.videoId}&playsinline=1&rel=0`}
                            title={`${work.artistName} preview`}
                            allow="autoplay; encrypted-media"
                            className="pointer-events-none h-full w-full"
                          />
                        ) : (
                          <img
                            src={thumbnail}
                            alt={`${work.artistName} video`}
                            draggable={false}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        )}
                      </div>
                    ) : (
                      <img
                        src={thumbnail}
                        alt={`${work.artistName} work`}
                        draggable={false}
                        className="h-auto w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    )}

                    {/* Gradient */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent opacity-80 transition duration-300 group-hover:opacity-100" />

                    {/* Play icon */}
                    {isYoutube &&
                      !isPreviewing && (
                        <div className="pointer-events-none absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-lg text-white">
                          ▶
                        </div>
                      )}

                    {/* Artist info */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-white">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                        {work.category}
                      </p>

                      <h2 className="mt-1 text-lg font-black">
                        {
                          work.artistName
                        }
                      </h2>
                    </div>
                  </div>
                </article>
              </div>
            );
          },
        )}

        {filteredWorks.length === 0 && (
          <p className="text-sm text-gray-500">
            No works in this category
            yet.
          </p>
        )}
      </div>

      {/* Work modal */}
      {selectedWork && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() =>
            setSelectedWork(null)
          }
        >
          <div
            className="relative flex max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            {/* Viewer */}
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
              ) : (
                <img
                  src={
                    selectedWork.image
                  }
                  alt={`${selectedWork.artistName} work`}
                  draggable={false}
                  className="max-h-[80vh] w-full object-contain"
                />
              )}
            </div>

            {/* Information */}
            <aside className="relative w-[300px] shrink-0 bg-white p-6">
              <button
                type="button"
                onClick={() =>
                  setSelectedWork(null)
                }
                aria-label="Close work"
                className="absolute right-4 top-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-gray-600 text-xl text-white transition hover:bg-gray-700"
              >
                ×
              </button>

              <div className="pr-10">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-fuchsia-600">
                  {
                    selectedWork.category
                  }
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

              <Link
                href={`/creator/${selectedWork.artistId}`}
                className="mt-8 flex h-11 w-full cursor-pointer items-center justify-center rounded-full bg-fuchsia-600 px-5 text-sm font-bold text-white transition hover:bg-fuchsia-700"
              >
                View Artist Profile
              </Link>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}