"use client";

import { useState, type FormEvent } from "react";

import AuthModal from "@/components/AuthModal";
import { isRealAccountUser } from "@/lib/auth/userKind";
import { createClient } from "@/lib/supabase/client";

type ImportClipFormProps = {
  onImported: () => void;
};

export default function ImportClipForm({
  onImported,
}: ImportClipFormProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [showAuthModal, setShowAuthModal] =
    useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const trimmed = url.trim();

    if (!trimmed) {
      setError("Enter a valid YouTube URL.");
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!isRealAccountUser(user)) {
      setShowAuthModal(true);
      return;
    }

    setImporting(true);

    try {
      const response = await fetch("/api/picks/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_url: trimmed,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
      };

      if (response.status === 401 || response.status === 403) {
        setShowAuthModal(true);
        return;
      }

      if (!response.ok) {
        setError(
          data.error || "Could not import this clip.",
        );
        return;
      }

      setUrl("");
      onImported();
    } catch {
      setError("Could not import this clip.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="mb-6 flex flex-col gap-2 sm:mb-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Import a clip
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              if (error) {
                setError("");
              }
            }}
            placeholder="YouTube URL"
            aria-label="YouTube URL"
            className="h-10 min-w-0 flex-1 rounded-lg border border-[#262626] bg-[#141414] px-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/30"
          />
          <button
            type="submit"
            disabled={importing || !url.trim()}
            className="h-10 shrink-0 rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : null}
      </form>

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
        }}
      />
    </>
  );
}
