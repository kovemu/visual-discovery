"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import AuthModal from "@/components/AuthModal";
import Header from "@/components/Header";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";

export default function SubmitPage() {
  const { t } = useTranslation();
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [url, setUrl] = useState("");
  const [confirmed, setConfirmed] =
    useState(false);
  const [notice, setNotice] =
    useState("");
  const [error, setError] =
    useState("");
  const [submitting, setSubmitting] =
    useState(false);
  const [
    currentUserId,
    setCurrentUserId,
  ] = useState<string | null>(null);
  const [
    authChecked,
    setAuthChecked,
  ] = useState(false);
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

      setCurrentUserId(
        user?.id ?? null,
      );
      setAuthChecked(true);
    }

    void loadUser();
  }, [supabase]);

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();

    setNotice("");
    setError("");

    if (!confirmed || !url.trim()) {
      return;
    }

    if (!currentUserId) {
      setShowAuthModal(true);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        "/api/submissions",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            source_url: url.trim(),
            confirmed_18_plus: true,
          }),
        },
      );

      if (response.status === 401) {
        setShowAuthModal(true);
        setError(t("submitLoginRequired"));
        return;
      }

      if (response.status === 400) {
        setError(t("submitInvalidUrl"));
        return;
      }

      if (response.status === 409) {
        setError(t("submitDuplicate"));
        return;
      }

      if (!response.ok) {
        setError(t("submitServerError"));
        return;
      }

      setNotice(t("submitSuccess"));
      setUrl("");
      setConfirmed(false);
    } catch {
      setError(t("submitServerError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Header />

      <section className="mx-auto max-w-lg px-4 py-10 md:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {t("submitClip")}
        </h1>

        <p className="mt-2 text-sm text-zinc-400">
          {t("pasteLink")}
        </p>

        <p className="mt-4 text-xs leading-5 text-zinc-500">
          {t("submitSafety")}
        </p>

        {authChecked &&
          !currentUserId && (
            <p className="mt-4 text-sm text-zinc-300">
              {t("submitLoginRequired")}{" "}
              <button
                type="button"
                onClick={() =>
                  setShowAuthModal(
                    true,
                  )
                }
                className="font-semibold text-white underline"
              >
                {t("login")}
              </button>
            </p>
          )}

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5"
        >
          <label className="block">
            <span className="sr-only">
              {t("pasteLink")}
            </span>
            <input
              type="url"
              value={url}
              onChange={(event) =>
                setUrl(
                  event.target.value,
                )
              }
              placeholder={t(
                "urlPlaceholder",
              )}
              className="h-12 w-full rounded-xl border border-[#262626] bg-[#141414] px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-violet-500"
            />
          </label>

          <label className="flex items-start gap-3 text-sm leading-5 text-zinc-300">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) =>
                setConfirmed(
                  event.target
                    .checked,
                )
              }
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span>{t("confirm18")}</span>
          </label>

          <button
            type="submit"
            disabled={
              submitting ||
              !confirmed ||
              !url.trim()
            }
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting
              ? t("submitting")
              : t("submit")}
          </button>

          {notice && (
            <p className="text-sm text-zinc-300">
              {notice}
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}
        </form>
      </section>

      <AuthModal
        open={showAuthModal}
        onClose={() =>
          setShowAuthModal(false)
        }
        onSuccess={async () => {
          const {
            data: { user },
          } =
            await supabase.auth.getUser();

          setCurrentUserId(
            user?.id ?? null,
          );
          setShowAuthModal(false);
        }}
      />
    </main>
  );
}
