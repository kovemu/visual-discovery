"use client";

import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type FeaturedWork = {
  id: string;
  type: "image" | "youtube";
  image?: string;
  videoId?: string;
  caption: string | null;
  publishedAt?: string;
};

type FeaturedWorksCarouselProps = {
  works: FeaturedWork[];
  artistName: string;
};

export default function FeaturedWorksCarousel({
  works,
  artistName,
}: FeaturedWorksCarouselProps) {
  const scrollRef =
    useRef<HTMLDivElement | null>(null);

  const [canScrollLeft, setCanScrollLeft] =
    useState(false);

  const [canScrollRight, setCanScrollRight] =
    useState(false);

  const sortedWorks = useMemo(() => {
    return [...works].sort((a, b) => {
      const aTime = a.publishedAt
        ? new Date(a.publishedAt).getTime()
        : 0;

      const bTime = b.publishedAt
        ? new Date(b.publishedAt).getTime()
        : 0;

      return bTime - aTime;
    });
  }, [works]);

  const updateScrollState = () => {
    const container = scrollRef.current;

    if (!container) return;

    setCanScrollLeft(
      container.scrollLeft > 5,
    );

    setCanScrollRight(
      container.scrollLeft +
        container.clientWidth <
        container.scrollWidth - 5,
    );
  };

  useEffect(() => {
    updateScrollState();

    const container = scrollRef.current;

    if (!container) return;

    container.addEventListener(
      "scroll",
      updateScrollState,
    );

    window.addEventListener(
      "resize",
      updateScrollState,
    );

    return () => {
      container.removeEventListener(
        "scroll",
        updateScrollState,
      );

      window.removeEventListener(
        "resize",
        updateScrollState,
      );
    };
  }, [sortedWorks]);

  const scrollLeft = () => {
    const container = scrollRef.current;

    if (!container || !canScrollLeft) {
      return;
    }

    container.scrollBy({
      left: -container.clientWidth * 0.8,
      behavior: "smooth",
    });
  };

  const scrollRight = () => {
    const container = scrollRef.current;

    if (!container || !canScrollRight) {
      return;
    }

    container.scrollBy({
      left: container.clientWidth * 0.8,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative mt-6">
      {/* Track */}
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto pr-[120px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sortedWorks.map((work) => (
          <article
            key={work.id}
            className="w-[calc((100%-20px)/2)] min-w-[calc((100%-20px)/2)] shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white"
          >
            {work.type === "youtube" &&
            work.videoId ? (
              <iframe
                src={`https://www.youtube.com/embed/${work.videoId}?rel=0`}
                title={`${artistName} featured work`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full"
              />
            ) : work.image ? (
              <img
                src={work.image}
                alt={`${artistName} featured work`}
                draggable={false}
                className="aspect-video w-full object-cover"
              />
            ) : null}

            {work.caption && (
              <div className="p-4">
                <p className="line-clamp-1 text-sm font-semibold leading-5 text-gray-950">
                  {work.caption}
                </p>
              </div>
            )}
          </article>
        ))}
      </div>

      {/* Left */}
      {sortedWorks.length > 2 && (
        <button
          type="button"
          onClick={scrollLeft}
          aria-label="Previous featured works"
          className={`absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 shadow-sm transition ${
            canScrollLeft
              ? "cursor-pointer opacity-100 hover:scale-105"
              : "cursor-default opacity-30"
          }`}
        >
          <ChevronLeft size={21} />
        </button>
      )}

      {/* Right */}
      {sortedWorks.length > 2 && (
        <button
          type="button"
          onClick={scrollRight}
          aria-label="Next featured works"
          className={`absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 shadow-sm transition ${
            canScrollRight
              ? "cursor-pointer opacity-100 hover:scale-105"
              : "cursor-default opacity-30"
          }`}
        >
          <ChevronRight size={21} />
        </button>
      )}
    </div>
  );
}