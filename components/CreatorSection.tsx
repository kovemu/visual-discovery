"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Creator } from "@/data/creators";
import CreatorCard from "./CreatorCard";

type CreatorSectionProps = {
  title: string;
  subtitle?: string;
  creators: Creator[];
};

export default function CreatorSection({
  title,
  subtitle,
  creators,
}: CreatorSectionProps) {
  const carouselRef = useRef<HTMLDivElement>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const carousel = carouselRef.current;

    if (!carousel) return;

    const { scrollLeft, scrollWidth, clientWidth } = carousel;
    const remainingScroll = scrollWidth - clientWidth - scrollLeft;

    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(remainingScroll > 4);
  }, []);

  useEffect(() => {
    const carousel = carouselRef.current;

    if (!carousel) return;

    updateScrollButtons();

    carousel.addEventListener("scroll", updateScrollButtons, {
      passive: true,
    });

    const resizeObserver = new ResizeObserver(updateScrollButtons);
    resizeObserver.observe(carousel);

    return () => {
      carousel.removeEventListener("scroll", updateScrollButtons);
      resizeObserver.disconnect();
    };
  }, [creators, updateScrollButtons]);

  const scrollCarousel = (direction: "left" | "right") => {
    const carousel = carouselRef.current;

    if (!carousel) return;

    const scrollAmount = Math.max(carousel.clientWidth * 0.8, 500);

    carousel.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <section className="group relative py-10">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-950">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">
              {subtitle}
            </p>
          )}
        </div>

        <button
          type="button"
          className="shrink-0 text-sm font-semibold text-gray-500 transition hover:text-fuchsia-600"
        >
          View all →
        </button>
      </div>

      <div className="relative">
        <div
          ref={carouselRef}
          aria-label={`${title} creators`}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-1 pt-4 pb-6 pr-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {creators.map((creator) => (
            <div key={creator.id} className="snap-start">
              <CreatorCard {...creator} />
            </div>
          ))}
        </div>

        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollCarousel("left")}
            aria-label={`Scroll ${title} left`}
            className="absolute left-3 top-[38%] z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/95 text-2xl font-medium text-gray-800 shadow-lg transition hover:scale-105 hover:text-fuchsia-600 md:flex md:opacity-0 md:group-hover:opacity-100"
          >
            ‹
          </button>
        )}

        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollCarousel("right")}
            aria-label={`Scroll ${title} right`}
            className="absolute right-3 top-[38%] z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/95 text-2xl font-medium text-gray-800 shadow-lg transition hover:scale-105 hover:text-fuchsia-600 md:flex md:opacity-0 md:group-hover:opacity-100"
          >
            ›
          </button>
        )}

        {canScrollRight && (
          <div className="pointer-events-none absolute bottom-4 right-0 top-0 w-16 bg-gradient-to-l from-white to-transparent" />
        )}
      </div>
    </section>
  );
}