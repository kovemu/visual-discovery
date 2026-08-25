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

import TikTokThumbnail from "@/components/works/TikTokThumbnail";
import ProfileWorkModal from "@/components/artist/ProfileWorkModal";

type LatestWork = {
  id: string;
  type: "image" | "youtube" | "tiktok";
  image?: string;
  videoId?: string;
  caption: string | null;
  publishedAt?: string;
};

type LatestWorksCarouselProps = {
  works: LatestWork[];
  artistName: string;
};

export default function LatestWorksCarousel({
  works,
  artistName,
}: LatestWorksCarouselProps) {
  const scrollRef =
    useRef<HTMLDivElement | null>(null);

  const [canScrollLeft, setCanScrollLeft] =
    useState(false);

  const [canScrollRight, setCanScrollRight] =
    useState(false);

  const [selectedWork, setSelectedWork] =
    useState<LatestWork | null>(null);

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
          className="flex gap-3 overflow-x-auto pr-[80px] [scrollbar-width:none] md:gap-4 [&::-webkit-scrollbar]:hidden"
        >
          {sortedWorks.map((work) => (
            <button
              key={work.id}
              type="button"
              onClick={() =>
                setSelectedWork(work)
              }
              className="group w-[37%] min-w-[37%] shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-white text-left md:w-[23%] md:min-w-[23%]"
            >
              {work.type === "youtube" &&
              work.videoId ? (
                <div className="relative aspect-[9/16] overflow-hidden bg-black">
                  <img
                    src={`https://i.ytimg.com/vi/${work.videoId}/hqdefault.jpg`}
                    alt={`${artistName} latest work`}
                    draggable={false}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 bg-black/10 transition group-hover:bg-black/20" />

                  <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white">
                    ▶
                  </div>
                </div>
              ) : work.type === "tiktok" &&
                work.videoId ? (
                <div className="relative aspect-[9/16] overflow-hidden bg-black">
                  <TikTokThumbnail
                    src={work.image}
                    alt={`${artistName} latest work`}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    placeholderClassName="h-full w-full"
                  />

                  <div className="absolute inset-0 bg-black/10 transition group-hover:bg-black/20" />

                  <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white">
                    ▶
                  </div>
                </div>
              ) : work.image ? (
                <TikTokThumbnail
                  src={work.image}
                  alt={`${artistName} latest work`}
                  className="aspect-[9/16] w-full object-cover transition duration-300 group-hover:scale-105"
                  placeholderClassName="aspect-[9/16] w-full"
                />
              ) : (
                <TikTokThumbnail
                  src={null}
                  alt={`${artistName} latest work`}
                  placeholderClassName="aspect-[9/16] w-full"
                />
              )}

              {work.caption && (
                <div className="p-2 md:p-3">
                  <p className="line-clamp-2 text-sm text-gray-600">
                    {work.caption}
                  </p>
                </div>
              )}
            </button>
          ))}
        </div>

        {sortedWorks.length > 4 && (
          <>
            <button
              type="button"
              onClick={scrollLeft}
              aria-label="Previous latest works"
              className={`absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 shadow-sm transition md:h-10 md:w-10 ${
                canScrollLeft
                  ? "cursor-pointer opacity-100 hover:scale-105"
                  : "cursor-default opacity-30"
              }`}
            >
              <ChevronLeft size={20} />
            </button>

            <button
              type="button"
              onClick={scrollRight}
              aria-label="Next latest works"
              className={`absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 shadow-sm transition md:h-10 md:w-10 ${
                canScrollRight
                  ? "cursor-pointer opacity-100 hover:scale-105"
                  : "cursor-default opacity-30"
              }`}
            >
              <ChevronRight size={20} />
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