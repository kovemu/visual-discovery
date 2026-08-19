"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";
import LogoutButton from "@/components/LogoutButton";

export default function Header() {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

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

        {/* Right */}
        <div className="flex items-center gap-4">
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
              <Link
                href="/login"
                className="shrink-0 text-sm font-semibold text-gray-700 transition hover:text-fuchsia-600"
              >
                Log in
              </Link>
            ))}
        </div>
      </div>
    </header>
  );
}