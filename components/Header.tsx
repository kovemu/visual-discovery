"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AuthModal from "@/components/AuthModal";
import LogoutButton from "@/components/LogoutButton";
import { isRealAccountUser } from "@/lib/auth/userKind";
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
    isRealUser,
    setIsRealUser,
  ] = useState(false);

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

      setIsRealUser(
        isRealAccountUser(user),
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
          setIsRealUser(
            isRealAccountUser(
              session?.user,
            ),
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

    return `relative whitespace-nowrap pb-1 text-[13px] font-medium tracking-[0.04em] transition ${      active
        ? "text-violet-400 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-violet-400"
        : "text-zinc-400 hover:text-zinc-100"
    }`;
  };

  return (
    <header className="border-b border-white/[0.06] bg-[#050505]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 md:h-16 md:gap-6 md:px-6 lg:px-10">
        <div className="shrink-0">
          <Link
            href="/"
            className="group flex items-center gap-2.5"
            aria-label="KOVEMU home"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-violet-500"
            />

            <span className="text-[15px] font-semibold uppercase tracking-[0.28em] text-white md:text-[20px] md:tracking-[0.32em]">
              KOVEMU
            </span>
          </Link>

          <p className="mt-0.5 hidden text-[10px] tracking-[0.08em] text-zinc-500 sm:block md:text-[13px]">
            Discover Korean beauty in motion.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-7">
          <nav className="flex items-center gap-2.5 md:gap-7">
            <Link
              href="/"
              className={navLinkClass("/")}
            >
              {t("discover")}
            </Link>
            <Link
              href="/saved"
              className={navLinkClass("/saved")}
            >
              {t("myPicks")}
            </Link>
          </nav>

          {!authLoading &&
            (isRealUser ? (
              <LogoutButton />
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="shrink-0 whitespace-nowrap rounded-md !border !border-zinc-600 px-2.5 py-1.5 text-[12px] font-medium tracking-[0.04em] text-zinc-300 transition hover:!border-zinc-400 hover:text-white md:px-3"
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
