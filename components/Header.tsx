"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AuthModal from "@/components/AuthModal";
import LogoutButton from "@/components/LogoutButton";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, setLocale, t } =
    useTranslation();
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

  const [
    showAuthModal,
    setShowAuthModal,
  ] = useState(false);

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

  const navLinkClass = (href: string) =>
    `text-xs font-semibold transition md:text-sm ${
      pathname === href
        ? "text-white"
        : "text-zinc-400 hover:text-white"
    }`;

  return (
    <header className="border-b border-[#262626] bg-[#050505]">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 md:h-16 md:flex-row md:items-center md:justify-between md:gap-4 md:px-6 md:py-0 lg:px-10">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="shrink-0 text-lg font-black tracking-tight text-white"
          >
            Visual
          </Link>

          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() =>
                setLocale("ko")
              }
              className={`text-xs font-semibold ${
                locale === "ko"
                  ? "text-white"
                  : "text-zinc-500"
              }`}
            >
              한국어
            </button>
            <span className="text-zinc-700">
              |
            </span>
            <button
              type="button"
              onClick={() =>
                setLocale("en")
              }
              className={`text-xs font-semibold ${
                locale === "en"
                  ? "text-white"
                  : "text-zinc-500"
              }`}
            >
              EN
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 md:justify-end md:gap-5">
          <nav className="flex items-center gap-3 md:gap-5">
            <Link
              href="/"
              className={navLinkClass("/")}
            >
              {t("discover")}
            </Link>
            <Link
              href="/saved"
              className={navLinkClass(
                "/saved",
              )}
            >
              {t("saved")}
            </Link>
            <Link
              href="/submit"
              className={navLinkClass(
                "/submit",
              )}
            >
              {t("submit")}
            </Link>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={() =>
                setLocale("ko")
              }
              className={`text-xs font-semibold ${
                locale === "ko"
                  ? "text-white"
                  : "text-zinc-500"
              }`}
            >
              한국어
            </button>
            <span className="text-zinc-700">
              |
            </span>
            <button
              type="button"
              onClick={() =>
                setLocale("en")
              }
              className={`text-xs font-semibold ${
                locale === "en"
                  ? "text-white"
                  : "text-zinc-500"
              }`}
            >
              EN
            </button>
          </div>

          {!authLoading &&
            (userEmail ? (
              <LogoutButton />
            ) : (
              <button
                type="button"
                onClick={() =>
                  setShowAuthModal(
                    true,
                  )
                }
                className="shrink-0 text-xs font-semibold text-zinc-300 transition hover:text-white md:text-sm"
              >
                {t("login")}
              </button>
            ))}
        </div>
      </div>

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
