"use client";

import Link from "next/link";
import { Search } from "lucide-react";

export default function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6 lg:px-10">
        {/* Logo */}
        <Link
          href="/"
          className="shrink-0 text-[34px] font-black leading-none text-fuchsia-600"
        >
          Kovemu
        </Link>

        {/* Search */}
        <div className="hidden w-[260px] md:block">
          <label className="relative block">
            <span className="sr-only">
              Search creators
            </span>

            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="search"
              placeholder="Search creators"
              className="h-10 w-full rounded-full border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm outline-none transition focus:border-fuchsia-300"
            />
          </label>
        </div>
      </div>
    </header>
  );
}