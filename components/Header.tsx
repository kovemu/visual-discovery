"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AuthModal from "@/components/AuthModal";
import { createClient } from "@/lib/supabase/client";
import { useOverlayHistory } from "@/lib/hooks/useOverlayHistory";
import LogoutButton from "@/components/LogoutButton";

type SearchArtist = {
  id: string;
  name: string;
  profile_image: string | null;
  category: string;
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]?.toUpperCase() ??
        "",
    )
    .join("");
}

export default function Header() {
  const router = useRouter();
  const supabase = useMemo(
    () => createClient(),
    [],
  );
  const searchRef =
    useRef<HTMLDivElement>(null);
  const mobileSearchRef =
    useRef<HTMLDivElement>(null);
  const mobileSearchInputRef =
    useRef<HTMLInputElement>(null);

  const [
    userEmail,
    setUserEmail,
  ] = useState<string | null>(
    null,
  );

  const [
    authLoading,
    setAuthLoading,
  ] = useState(true);

  const [
    showAuthModal,
    setShowAuthModal,
  ] = useState(false);

  const [query, setQuery] =
    useState("");
  const [results, setResults] =
    useState<SearchArtist[]>([]);
  const [searchLoading, setSearchLoading] =
    useState(false);
  const [
    dropdownOpen,
    setDropdownOpen,
  ] = useState(false);
  const [
    mobileSearchOpen,
    setMobileSearchOpen,
  ] = useState(false);

  function closeMobileSearchFromHistory() {
    setMobileSearchOpen(false);
    setDropdownOpen(false);
    setQuery("");
    setResults([]);
  }

  const {
    requestClose:
      requestCloseMobileSearch,
  } = useOverlayHistory(
    "search",
    mobileSearchOpen,
    closeMobileSearchFromHistory,
  );

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      setUserEmail(
        user?.email ?? null,
      );

      setAuthLoading(false);
    }

    loadUser();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (
          _event,
          session,
        ) => {
          setUserEmail(
            session?.user
              ?.email ??
              null,
          );

          setAuthLoading(false);
        },
      );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const trimmed =
      query.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);

    const timer =
      window.setTimeout(
        async () => {
          const { data, error } =
            await supabase
              .from("creators")
              .select(
                "id, name, profile_image, category",
              )
              .ilike(
                "name",
                `%${trimmed}%`,
              )
              .limit(6);

          if (error) {
            console.error(
              "SEARCH ARTISTS ERROR:",
              error,
            );
            setResults([]);
          } else {
            setResults(
              (data ??
                []) as SearchArtist[],
            );
          }

          setSearchLoading(false);
        },
        250,
      );

    return () => {
      window.clearTimeout(timer);
    };
  }, [query, supabase]);

  useEffect(() => {
    function handlePointerDown(
      event: MouseEvent,
    ) {
      const target =
        event.target as Node;

      if (
        !searchRef.current?.contains(
          target,
        ) &&
        !mobileSearchRef.current?.contains(
          target,
        )
      ) {
        setDropdownOpen(false);
      }
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        if (mobileSearchOpen) {
          requestCloseMobileSearch();
          return;
        }

        setDropdownOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );
    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    mobileSearchOpen,
    requestCloseMobileSearch,
  ]);

  useEffect(() => {
    if (
      !mobileSearchOpen ||
      !mobileSearchInputRef.current
    ) {
      return;
    }

    mobileSearchInputRef.current.focus();
  }, [mobileSearchOpen]);

  function openMobileSearch() {
    setMobileSearchOpen(true);

    if (query.trim().length >= 2) {
      setDropdownOpen(true);
    }
  }

  function selectArtist(
    artistId: string,
  ) {
    const wasMobileSearchOpen =
      mobileSearchOpen;

    setQuery("");
    setResults([]);
    setDropdownOpen(false);
    setMobileSearchOpen(false);

    if (wasMobileSearchOpen) {
      router.replace(
        `/creator/${artistId}`,
      );
      return;
    }

    router.push(
      `/creator/${artistId}`,
    );
  }

  function handleSearchChange(
    value: string,
  ) {
    setQuery(value);
    setDropdownOpen(true);
  }

  function handleSearchKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (
      event.key === "Enter" &&
      results.length > 0
    ) {
      event.preventDefault();
      selectArtist(
        results[0].id,
      );
    }
  }

  const trimmedQuery =
    query.trim();
  const showDropdown =
    dropdownOpen &&
    trimmedQuery.length >= 2;

  const searchDropdown = (
    <div className="absolute top-full z-[60] mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
      {searchLoading ? (
        <p className="px-4 py-3 text-sm text-gray-400">
          Searching...
        </p>
      ) : results.length ===
        0 ? (
        <p className="px-4 py-3 text-sm text-gray-400">
          No artists found.
        </p>
      ) : (
        <ul>
          {results.map(
            (artist) => (
              <li
                key={
                  artist.id
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    selectArtist(
                      artist.id,
                    )
                  }
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-gray-50"
                >
                  {artist.profile_image ? (
                    <img
                      src={
                        artist.profile_image
                      }
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                      {getInitials(
                        artist.name,
                      )}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-950">
                      {
                        artist.name
                      }
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {
                        artist.category
                      }
                    </p>
                  </div>
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-4 md:gap-4 md:px-6 lg:px-10">
        {/* Logo */}
        <Link
          href="/"
          className="shrink-0 text-[34px] font-black leading-none text-fuchsia-600"
        >
          Kovemu
        </Link>

        {/* Right */}
        <div className="flex shrink-0 items-center gap-2 md:gap-4">
          <button
            type="button"
            aria-label="Open search"
            aria-expanded={
              mobileSearchOpen
            }
            onClick={
              openMobileSearch
            }
            className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-700 transition hover:text-fuchsia-600 active:text-fuchsia-600 md:hidden"
          >
            <Search size={20} />
          </button>

          {/* Desktop search */}
          <div
            ref={searchRef}
            className="relative hidden w-[260px] md:block"
          >
            <label className="block">
              <span className="sr-only">
                Search artists
              </span>

              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="search"
                value={query}
                onChange={(event) =>
                  handleSearchChange(
                    event.target
                      .value,
                  )
                }
                onFocus={() =>
                  setDropdownOpen(
                    true,
                  )
                }
                onKeyDown={
                  handleSearchKeyDown
                }
                placeholder="Search artists"
                className="h-10 w-full rounded-full border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm outline-none transition focus:border-fuchsia-300"
              />
            </label>

            {showDropdown &&
              searchDropdown}
          </div>

          {/* Auth */}
          {!authLoading &&
            (userEmail ? (
              <div className="flex items-center gap-3">
                <span className="hidden max-w-[160px] truncate text-sm text-gray-500 lg:block">
                  {userEmail}
                </span>

                <LogoutButton />
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setShowAuthModal(
                    true,
                  )
                }
                className="shrink-0 text-sm font-semibold text-gray-700 transition hover:text-fuchsia-600"
              >
                Log in
              </button>
            ))}
        </div>
      </div>

      {mobileSearchOpen && (
        <div
          ref={mobileSearchRef}
          className="border-t border-gray-100 bg-white md:hidden"
        >
          <div className="relative px-4 py-2.5">
            <label className="block">
              <span className="sr-only">
                Search artists
              </span>

              <Search
                size={16}
                className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                ref={
                  mobileSearchInputRef
                }
                type="search"
                value={query}
                onChange={(event) =>
                  handleSearchChange(
                    event.target
                      .value,
                  )
                }
                onFocus={() =>
                  setDropdownOpen(
                    true,
                  )
                }
                onKeyDown={
                  handleSearchKeyDown
                }
                placeholder="Search artists"
                className="h-11 w-full rounded-full border border-gray-200 bg-gray-50 pl-10 pr-11 text-sm outline-none transition focus:border-fuchsia-300"
              />
            </label>

            <button
              type="button"
              aria-label="Close search"
              onClick={
                requestCloseMobileSearch
              }
              className="absolute right-6 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={16} />
            </button>

            {showDropdown &&
              searchDropdown}
          </div>
        </div>
      )}

      <AuthModal
        open={showAuthModal}
        onClose={() =>
          setShowAuthModal(false)
        }
        onSuccess={() => {
          router.refresh();
        }}
      />
    </header>
  );
}
