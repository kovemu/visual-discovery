"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const categories = [
  { label: "Music", href: "/categories/music" },
  { label: "Dance", href: "/categories/dance" },
  { label: "Film", href: "/categories/film" },
  { label: "Art", href: "/categories/art" },
  { label: "Cosplay", href: "/categories/cosplay" },
];

const rankings = [
  {
    label: "Weekly Rankings",
    href: "/rankings",
  },
];

export default function Navigation() {
  const [openMenu, setOpenMenu] = useState<
    "categories" | "rankings" | null
  >(null);

  return (
    <nav className="relative border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-center px-6 lg:px-10">
        <div className="flex items-center gap-10">
          <Link
            href="/discover"
            className="text-sm font-semibold text-zinc-800 transition hover:text-fuchsia-600"
          >
            Discover
          </Link>

          <div
            className="relative"
            onMouseEnter={() => setOpenMenu("categories")}
            onMouseLeave={() => setOpenMenu(null)}
          >
            <button
              type="button"
              onClick={() =>
                setOpenMenu((current) =>
                  current === "categories" ? null : "categories",
                )
              }
              aria-expanded={openMenu === "categories"}
              aria-haspopup="menu"
              className="flex items-center gap-1 text-sm font-semibold text-zinc-800 transition hover:text-fuchsia-600"
            >
              Categories

              <ChevronDown
                size={16}
                className={`transition-transform ${
                  openMenu === "categories" ? "rotate-180" : ""
                }`}
              />
            </button>

            {openMenu === "categories" && (
              <div className="absolute left-1/2 top-full z-50 w-48 -translate-x-1/2 pt-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl">
                  {categories.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpenMenu(null)}
                      className="block rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-fuchsia-50 hover:text-fuchsia-600"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div
            className="relative"
            onMouseEnter={() => setOpenMenu("rankings")}
            onMouseLeave={() => setOpenMenu(null)}
          >
            <button
              type="button"
              onClick={() =>
                setOpenMenu((current) =>
                  current === "rankings" ? null : "rankings",
                )
              }
              aria-expanded={openMenu === "rankings"}
              aria-haspopup="menu"
              className="flex items-center gap-1 text-sm font-semibold text-zinc-800 transition hover:text-fuchsia-600"
            >
              Rankings

              <ChevronDown
                size={16}
                className={`transition-transform ${
                  openMenu === "rankings" ? "rotate-180" : ""
                }`}
              />
            </button>

            {openMenu === "rankings" && (
              <div className="absolute left-1/2 top-full z-50 w-48 -translate-x-1/2 pt-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl">
                  {rankings.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpenMenu(null)}
                      className="block rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-fuchsia-50 hover:text-fuchsia-600"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link
            href="/new"
            className="text-sm font-semibold text-zinc-800 transition hover:text-fuchsia-600"
          >
            New
          </Link>
        </div>
      </div>
    </nav>
  );
}