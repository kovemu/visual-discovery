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

    return `relative whitespace-nowrap text-[12px] font-medium tracking-[0.04em] transition ${
      active
        ? "text-[#b56cff] after:absolute after:inset-x-0 after:top-[calc(100%+11px)] after:h-px after:bg-[#b56cff]"
        : "text-white/[0.68] hover:text-white/90"
    }`;
  };

  return (
    <header className="border-b border-white/[0.06] bg-[#050505]">
      <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between gap-3 px-4 md:px-10">
        <div className="flex min-w-0 items-center">
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-3"
            aria-label="KOVEMU home"
          >
            <img
              src="/kovemu-icon.svg"
              alt=""
              aria-hidden="true"
              width={20}
              height={20}
              className="h-5 w-5 shrink-0"
            />

            <span className="text-base font-semibold uppercase leading-none tracking-[0.34em] text-white">
              KOVEMU
            </span>
          </Link>

          <span
            aria-hidden="true"
            className="mx-6 hidden h-7 w-px shrink-0 bg-white/[0.12] lg:block"
          />

          <p className="hidden truncate text-[11px] font-normal tracking-[0.02em] text-white/[0.42] lg:block">
            Discover Korean beauty in motion.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4 md:gap-7">
          <nav className="flex items-center gap-4 md:gap-7">
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
                className="h-8 shrink-0 whitespace-nowrap rounded-[5px] border border-white/[0.18] bg-transparent px-3 text-[12px] font-medium tracking-[0.04em] text-white/[0.68] transition hover:border-white/30 hover:text-white/90"
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
