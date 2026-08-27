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

  const navLinkClass = (href: string) =>
    `text-xs font-semibold transition md:text-sm ${
      pathname === href
        ? "text-white"
        : "text-zinc-400 hover:text-white"
    }`;

  return (
    <header className="border-b border-[#262626] bg-[#050505]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:h-16 md:px-6 md:py-0 lg:px-10">
        <Link
          href="/"
          className="shrink-0 text-lg font-black tracking-tight text-white"
        >
          Visual
        </Link>

        <div className="flex items-center gap-3 md:gap-5">
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
