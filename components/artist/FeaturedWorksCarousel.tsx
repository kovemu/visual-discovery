"use client";

import {
  ChevronLeft,
  ChevronRight,
  Play,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ProfileWorkModal from "@/components/artist/ProfileWorkModal";
import TikTokThumbnail from "@/components/works/TikTokThumbnail";

type FeaturedWork = {
  id: string;
  type: "image" | "youtube" | "tiktok";
  image?: string;
  videoId?: string;
  caption: string | null;
  publishedAt?: string;
};

type FeaturedWorksCarouselProps = {
  works: FeaturedWork[];
  artistName: string;
};

function getFeaturedThumbnail(
  work: FeaturedWork,
) {
  if (work.image) {
    return work.image;
  }

  if (
    work.type === "youtube" &&
    work.videoId
  ) {
    return `https://i.ytimg.com/vi/${work.videoId}/hqdefault.jpg`;
  }

  return null;
}

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

  const [
    selectedWork,
    setSelectedWork,
  ] = useState<FeaturedWork | null>(
    null,
  );

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
    <>
      <div className="relative mt-6">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pr-[120px] [scrollbar-width:none] md:gap-5 [&::-webkit-scrollbar]:hidden"
        >
          {sortedWorks.map((work) => {
            const thumbnail =
              getFeaturedThumbnail(
                work,
              );

            return (
              <button
                key={work.id}
                type="button"
                onClick={() =>
                  setSelectedWork(work)
                }
                className="group w-[92%] min-w-[92%] shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-white text-left active:opacity-95 md:w-[calc((100%-20px)/2)] md:min-w-[calc((100%-20px)/2)]"
              >
                <div className="relative aspect-video overflow-hidden bg-black">
                  {work.type === "tiktok" &&
                  work.videoId ? (
                    <TikTokThumbnail
                      src={work.image}
                      alt={`${artistName} featured work`}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      placeholderClassName="h-full w-full"
                    />
                  ) : thumbnail ? (
                    <img
                      src={thumbnail}
                      alt={`${artistName} featured work`}
                      draggable={false}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-gray-100" />
                  )}

                  <div
                    aria-hidden="true"
                    className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition duration-300 group-hover:bg-black/70"
                  >
                    <Play
                      size={20}
                      className="fill-current"
                    />
                  </div>
                </div>

                {work.caption && (
                  <div className="p-3">
                    <p className="line-clamp-2 break-words text-sm font-semibold leading-5 text-gray-950">
                      {work.caption}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {sortedWorks.length > 2 && (
          <>
            <button
              type="button"
              onClick={scrollLeft}
              aria-label="Previous featured works"
              className={`absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 shadow-sm transition md:flex ${
                canScrollLeft
                  ? "cursor-pointer opacity-100 hover:scale-105"
                  : "cursor-default opacity-30"
              }`}
            >
              <ChevronLeft size={21} />
            </button>

            <button
              type="button"
              onClick={scrollRight}
              aria-label="Next featured works"
              className={`absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 shadow-sm transition md:flex ${
                canScrollRight
                  ? "cursor-pointer opacity-100 hover:scale-105"
                  : "cursor-default opacity-30"
              }`}
            >
              <ChevronRight size={21} />
            </button>
          </>
        )}
      </div>

      <ProfileWorkModal
        work={selectedWork}
        artistName={artistName}
        onClose={() =>
          setSelectedWork(null)
        }
      />
    </>
  );
}
