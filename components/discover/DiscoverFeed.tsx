"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type FeedItem = {
  id: string;
  artistId: string;
  artistName: string;
  category: string;
  image: string;
  caption?: string | null;
};

const categories = [
  "For You",
  "Music",
  "Dance",
  "Film",
  "Art",
  "Cosplay",
];

type DiscoverFeedProps = {
  works: FeedItem[];
};

function shuffleWorks(works: FeedItem[]): FeedItem[] {
  const shuffled = [...works];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
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

export default function DiscoverFeed({
  works,
}: DiscoverFeedProps) {
  const [selectedCategory, setSelectedCategory] =
    useState("For You");

  const [displayWorks, setDisplayWorks] =
    useState<FeedItem[]>(works);

  const [selectedWork, setSelectedWork] =
    useState<FeedItem | null>(null);

  useEffect(() => {
    if (!selectedWork) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedWork(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedWork]);

  const handleCategoryClick = (category: string) => {
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
      {/* Discover category filter */}
      <nav className="border-b border-gray-100 bg-white py-4">
        <div className="flex items-center gap-7 overflow-x-auto text-sm font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((category) => {
            const active =
              selectedCategory === category;

            return (
              <button
                key={category}
                type="button"
                onClick={() =>
                  handleCategoryClick(category)
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
          })}
        </div>
      </nav>

      {/* Work masonry feed */}
      <div className="mt-4 columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {filteredWorks.map((work, index) => (
          <button
            key={`${work.id}-${index}`}
            type="button"
            onClick={() =>
              setSelectedWork(work)
            }
            className="group mb-4 block w-full cursor-pointer break-inside-avoid text-left"
          >
            <article className="overflow-hidden rounded-2xl bg-gray-100">
              <div className="relative overflow-hidden">
                <img
                  src={work.image}
                  alt={`${work.artistName} work`}
                  draggable={false}
                  className="h-auto w-full object-cover transition duration-500 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent opacity-80 transition duration-300 group-hover:opacity-100" />

                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                    {work.category}
                  </p>

                  <h2 className="mt-1 text-lg font-black">
                    {work.artistName}
                  </h2>
                </div>
              </div>
            </article>
          </button>
        ))}

        {filteredWorks.length === 0 && (
          <p className="text-sm text-gray-500">
            No works in this category yet.
          </p>
        )}
      </div>

      {/* Work detail modal */}
      {selectedWork && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() =>
            setSelectedWork(null)
          }
        >
          <div
  className="relative flex max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white"
  onClick={(event) => event.stopPropagation()}
>
            {/* Work image */}
            <div className="flex min-w-0 flex-1 items-center justify-center bg-neutral-900">
              <img
  src={selectedWork.image}
  alt={`${selectedWork.artistName} work`}
  draggable={false}
  className="max-h-[80vh] w-full object-contain"
/>
            </div>

            {/* Work information */}
            <aside className="relative w-[300px] shrink-0 bg-white p-6">
              {/* Close */}
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
                  {selectedWork.category}
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-950">
                  {selectedWork.artistName}
                </h2>
              </div>

              {selectedWork.caption && (
                <p className="mt-5 line-clamp-[8] text-sm leading-6 text-gray-600">
                  {selectedWork.caption}
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