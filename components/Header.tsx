"use client";

import Link from "next/link";
import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LoginForm from "@/components/LoginForm";

type OpenMenu = "categories" | "rankings" | null;

const categories = [
  { label: "Music", href: "/categories/music" },
  { label: "Dance", href: "/categories/dance" },
  { label: "Film", href: "/categories/film" },
  { label: "Art", href: "/categories/art" },
  { label: "Cosplay", href: "/categories/cosplay" },
];

const rankings = [
  { label: "Trending", href: "/rankings/trending" },
  { label: "Popular", href: "/rankings/popular" },
  { label: "Rising", href: "/rankings/rising" },
];

export default function Header() {
 const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
 const [accountMenuOpen, setAccountMenuOpen] = useState(false);
 const [loginModalOpen, setLoginModalOpen] = useState(false);
 const [userEmail, setUserEmail] = useState<string | null>(null);
 const [supabase] = useState(() => createClient());

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUserEmail(user?.email ?? null);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const toggleMenu = (menu: Exclude<OpenMenu, null>) => {
    setOpenMenu((current) => (current === menu ? null : menu));
    setAccountMenuOpen(false);
  };

  const closeMenu = () => {
    setOpenMenu(null);
  };

  const submenuItems =
    openMenu === "categories"
      ? categories
      : openMenu === "rankings"
        ? rankings
        : [];

  return (
    <>
    <header className="border-b border-gray-200 bg-white">
      {/* 상단 메인 메뉴 */}
      <div className="mx-auto grid h-[72px] max-w-7xl grid-cols-[auto_auto_1fr_auto] items-center gap-7 px-6 lg:px-10">
        <Link
          href="/"
          onClick={() => {
            closeMenu();
            setAccountMenuOpen(false);
          }}
          className="shrink-0 text-[34px] font-black leading-none text-fuchsia-600"
        >
          Kovemu
        </Link>

        <nav
          aria-label="Main navigation"
          className="hidden h-full items-center gap-8 pt-1 md:flex"
        >
          <Link
            href="/discover"
            onClick={closeMenu}
            className="flex h-full items-center border-b-2 border-transparent text-base font-semibold text-gray-700 transition hover:text-fuchsia-600"
          >
            Discover
          </Link>

          <button
            type="button"
            onClick={() => toggleMenu("categories")}
            aria-expanded={openMenu === "categories"}
            aria-controls="categories-submenu"
            className={`flex h-full cursor-pointer items-center gap-1 border-b-2 text-base font-semibold transition ${
              openMenu === "categories"
                ? "border-fuchsia-600 text-fuchsia-600"
                : "border-transparent text-gray-700 hover:text-fuchsia-600"
            }`}
          >
            Categories

            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${
                openMenu === "categories" ? "rotate-180" : ""
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => toggleMenu("rankings")}
            aria-expanded={openMenu === "rankings"}
            aria-controls="rankings-submenu"
            className={`flex h-full cursor-pointer items-center gap-1 border-b-2 text-base font-semibold transition ${
              openMenu === "rankings"
                ? "border-fuchsia-600 text-fuchsia-600"
                : "border-transparent text-gray-700 hover:text-fuchsia-600"
            }`}
          >
            Rankings

            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${
                openMenu === "rankings" ? "rotate-180" : ""
              }`}
            />
          </button>

          <Link
            href="/new"
            onClick={closeMenu}
            className="flex h-full items-center border-b-2 border-transparent text-base font-semibold text-gray-700 transition hover:text-fuchsia-600"
          >
            New
          </Link>
        </nav>

        <div />

        <div className="flex items-center gap-5 pt-1">
          <div className="hidden w-[220px] md:block">
            <label className="relative block">
              <span className="sr-only">Search creators</span>

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

          {userEmail ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setAccountMenuOpen((current) => !current);
                  closeMenu();
                }}
                aria-expanded={accountMenuOpen}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-fuchsia-300 hover:text-fuchsia-600"
              >
                My Profile

                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${
                    accountMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {accountMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-48 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                  <Link
                    href="/account"
                    onClick={() => setAccountMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-fuchsia-600"
                  >
                    My Profile
                  </Link>

                  <Link
                    href="/account/upload"
                    onClick={() => setAccountMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-fuchsia-600"
                  >
                    Upload Work
                  </Link>

                  <button
                    type="button"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setAccountMenuOpen(false);
                    }}
                    className="mt-1 block w-full cursor-pointer border-t border-gray-100 px-3 pb-2 pt-3 text-left text-sm font-medium text-gray-500 transition hover:text-red-500"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
       type="button"
       onClick={() => {
           closeMenu();
           setAccountMenuOpen(false);
           setLoginModalOpen(true);
          }}
       className="shrink-0 cursor-pointer rounded-full border border-gray-300 bg-gray-100 px-5 py-2 text-sm font-semibold text-gray-800 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-600"
>
       Login
</button>
          )}
        </div>
      </div>

      {/* 네이버웹툰식 가로 부목록 */}
      {openMenu && (
        <div className="border-t border-gray-100 bg-white">
          <div className="mx-auto grid h-[52px] max-w-7xl grid-cols-[auto_auto_1fr] items-center gap-7 px-6 lg:px-10">
            <div className="invisible shrink-0 text-[34px] font-black leading-none">
              Kovemu
            </div>

            <nav
              id={`${openMenu}-submenu`}
              aria-label={`${openMenu} submenu`}
              className="flex items-center gap-10 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {submenuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="shrink-0 text-sm font-semibold text-gray-600 transition hover:text-fuchsia-600"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
     {loginModalOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4">
        <div className="relative w-full max-w-[460px] rounded-2xl bg-white p-8 shadow-2xl">
          <button
            type="button"
            onClick={() => setLoginModalOpen(false)}
            aria-label="Close login"
            className="absolute right-5 top-5 text-gray-400 transition hover:text-gray-900"
          >
            <X size={24} />
          </button>

          <LoginForm
            onSuccess={() => {
              setLoginModalOpen(false);
            }}
          />
        </div>
      </div>
    )}
  </>
  );
}
