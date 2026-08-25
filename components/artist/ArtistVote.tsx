"use client";

import { useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";

type ArtistVoteProps = {
  artistId: string;
  artistName: string;
  category: string;
};

type CurrentVote = {
  id: string;
  artist_id: string;
  category: string;
  week_start: string;
};

type VoteResponse = {
  loggedIn?: boolean;
  vote?: CurrentVote | null;
  success?: boolean;
  error?: string;
};

export default function ArtistVote({
  artistId,
  artistName,
  category,
}: ArtistVoteProps) {
  const normalizedCategory =
    category.trim().toLowerCase();

  const [currentVote, setCurrentVote] =
    useState<CurrentVote | null>(null);

  const [loggedIn, setLoggedIn] =
    useState<boolean | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [showLogin, setShowLogin] =
    useState(false);

  const [pendingVote, setPendingVote] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const isCurrentArtist =
    currentVote?.artist_id === artistId;

  async function loadVote() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/votes?category=${encodeURIComponent(
          normalizedCategory,
        )}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const result =
        (await response.json()) as VoteResponse;

      if (!response.ok) {
        setErrorMessage(
          result.error ??
            "Failed to load vote.",
        );

        return false;
      }

      setLoggedIn(
        result.loggedIn ?? false,
      );

      setCurrentVote(
        result.vote ?? null,
      );

      return result.loggedIn ?? false;
    } catch (error) {
      console.error(
        "LOAD ARTIST VOTE ERROR:",
        error,
      );

      setErrorMessage(
        "Failed to load vote.",
      );

      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVote();
  }, [normalizedCategory]);

  async function saveVote() {
    setSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        "/api/votes",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            artistId,
            category:
              normalizedCategory,
          }),
        },
      );

      const result =
        (await response.json()) as VoteResponse;

      if (response.status === 401) {
        setLoggedIn(false);
        setPendingVote(true);
        setShowLogin(true);

        return;
      }

      if (!response.ok) {
        setErrorMessage(
          result.error ??
            "Failed to save vote.",
        );

        return;
      }

      if (result.vote) {
        setCurrentVote(result.vote);
      }

      setLoggedIn(true);
      setPendingVote(false);
    } catch (error) {
      console.error(
        "SAVE ARTIST VOTE ERROR:",
        error,
      );

      setErrorMessage(
        "Failed to save vote.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleVote() {
    if (saving || isCurrentArtist) {
      return;
    }

    if (loggedIn === false) {
      setPendingVote(true);
      setShowLogin(true);
      return;
    }

    await saveVote();
  }

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-600">
          Weekly Vote
        </p>

        <h2 className="mt-2 text-xl font-black text-gray-950">
          Vote for {artistName}
        </h2>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Support your pick in this
          week&apos;s ranking.
        </p>

        {loading ? (
          <div className="mt-5 flex h-11 items-center justify-center rounded-full border border-gray-200 text-sm font-semibold text-gray-400">
            Checking vote...
          </div>
        ) : isCurrentArtist ? (
          <div className="mt-5 flex h-11 items-center justify-center rounded-full border border-fuchsia-200 bg-fuchsia-50 px-5 text-sm font-bold text-fuchsia-700">
            ✓ Voted for {artistName}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleVote}
            disabled={saving}
            className="mt-5 flex h-11 w-full cursor-pointer items-center justify-center rounded-full bg-fuchsia-600 px-5 text-sm font-bold text-white transition hover:bg-fuchsia-700 disabled:cursor-default disabled:opacity-60"
          >
            {saving
              ? "Saving..."
              : currentVote
                ? `Change Vote to ${artistName}`
                : `Vote for ${artistName}`}
          </button>
        )}

        {!loading &&
          currentVote &&
          !isCurrentArtist && (
            <p className="mt-3 text-xs leading-5 text-gray-400">
              You already voted this week.
              Voting here will change your
              current choice.
            </p>
          )}

        {!loading &&
          !currentVote && (
            <p className="mt-3 text-xs leading-5 text-gray-400">
              You can change your vote
              anytime before this week ends.
            </p>
          )}

        {errorMessage && (
          <p className="mt-3 text-xs font-medium text-red-500">
            {errorMessage}
          </p>
        )}
      </div>

      <AuthModal
        open={showLogin}
        onClose={() => {
          setShowLogin(false);
          setPendingVote(false);
        }}
        onSuccess={async () => {
          const isLoggedIn =
            await loadVote();

          if (
            isLoggedIn &&
            pendingVote
          ) {
            await saveVote();
          }
        }}
      />
    </>
  );
}