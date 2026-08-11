"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const featuredCreators = [
  {
    id: "mina-studio",
    label: "Featured Creator",
    name: "Mina Studio",
    headline:
      "Reimagining Korean folklore through futuristic digital art.",
    description:
      "Traditional Korean myths become vivid new worlds through bold color, digital textures and a distinctly modern imagination.",
    image:
      "https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=1800&q=85",
  },
  {
    id: "joon-films",
    label: "Featured Filmmaker",
    name: "Joon Films",
    headline:
      "Cinematic stories capturing Seoul after midnight.",
    description:
      "Independent films exploring quiet streets, restless youth and the hidden emotions of Korea’s modern cities.",
    image:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1800&q=85",
  },
  {
    id: "haru-sound",
    label: "Featured Musician",
    name: "Haru Sound",
    headline:
      "Dreamlike electronic music inspired by Korean city life.",
    description:
      "Layered synthesizers, field recordings and delicate melodies turn everyday Korean sounds into immersive music.",
    image:
      "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=1800&q=85",
  },
];

const SLIDE_DURATION = 7000;

export default function FeaturedCreator() {
  const [activeIndex, setActiveIndex] = useState(0);

  const activeCreator = featuredCreators[activeIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((currentIndex) =>
        currentIndex === featuredCreators.length - 1
          ? 0
          : currentIndex + 1,
      );
    }, SLIDE_DURATION);

    return () => window.clearInterval(timer);
  }, []);

  const showPreviousSlide = () => {
    setActiveIndex((currentIndex) =>
      currentIndex === 0
        ? featuredCreators.length - 1
        : currentIndex - 1,
    );
  };

  const showNextSlide = () => {
    setActiveIndex((currentIndex) =>
      currentIndex === featuredCreators.length - 1
        ? 0
        : currentIndex + 1,
    );
  };

  return (
    <section className="px-6 pt-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <article className="group relative h-[420px] overflow-hidden rounded-2xl bg-gray-950 md:h-[460px]">
          {featuredCreators.map((creator, index) => (
            <img
              key={creator.id}
              src={creator.image}
              alt={`${creator.name} featured artwork`}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                index === activeIndex ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}

          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/10" />

          <div className="relative flex h-full items-center px-8 py-14 md:px-16">
            <div
              key={activeCreator.id}
              className="max-w-xl animate-[fadeIn_500ms_ease-out] text-white"
            >
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-fuchsia-300">
                {activeCreator.label}
              </p>

              <h1 className="mt-5 text-5xl font-black tracking-tight md:text-6xl">
                {activeCreator.name}
              </h1>

              <p className="mt-5 text-xl font-semibold leading-snug text-white/95 md:text-2xl">
                {activeCreator.headline}
              </p>

              <p className="mt-6 max-w-lg text-base leading-7 text-white/75 md:text-lg md:leading-8">
                {activeCreator.description}
              </p>

              <Link
                href={`/creator/${activeCreator.id}`}
                className="mt-9 inline-flex rounded-full bg-fuchsia-600 px-8 py-4 font-bold text-white transition hover:bg-fuchsia-700"
              >
                Explore Creator
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={showPreviousSlide}
            aria-label="Previous featured creator"
            className="absolute left-5 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-2xl text-white opacity-0 backdrop-blur transition hover:bg-black/65 group-hover:opacity-100 md:flex"
          >
            ‹
          </button>

          <button
            type="button"
            onClick={showNextSlide}
            aria-label="Next featured creator"
            className="absolute right-5 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-2xl text-white opacity-0 backdrop-blur transition hover:bg-black/65 group-hover:opacity-100 md:flex"
          >
            ›
          </button>

          <div className="absolute bottom-6 right-7 flex items-center gap-2">
            {featuredCreators.map((creator, index) => (
              <button
                key={creator.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show ${creator.name}`}
                className={`h-2 rounded-full transition-all ${
                  index === activeIndex
                    ? "w-8 bg-white"
                    : "w-2 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}