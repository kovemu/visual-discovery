"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AuthModal from "@/components/AuthModal";
import LogoutButton from "@/components/LogoutButton";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";

function isNavActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/" || pathname === "/discover";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
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

  const navLinkClass = (href: string) => {
    const active = isNavActive(pathname, href);

    return `relative pb-1 text-[13px] font-medium tracking-[0.04em] transition ${
      active
        ? "text-violet-400 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-violet-400"
        : "text-zinc-400 hover:text-zinc-100"
    }`;
  };

  return (
    <header className="border-b border-white/[0.06] bg-[#050505]">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-6 px-4 md:h-14 md:px-6 lg:px-10">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5"
          aria-label="KOVEMU home"
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-violet-500"
          />
          <span className="text-[15px] font-semibold uppercase tracking-[0.34em] text-white md:text-[16px]">
            KOVEMU
          </span>
        </Link>

        <div className="flex items-center gap-5 md:gap-7">
          <nav className="flex items-center gap-5 md:gap-7">
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
              {t("myPicks")}
            </Link>
          </nav>

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
                className="shrink-0 text-[13px] font-medium tracking-[0.04em] text-zinc-400 transition hover:text-zinc-100"
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
