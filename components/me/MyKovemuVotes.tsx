"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";
import { getWeekStart } from "@/lib/votes/getWeekStart";

const VOTE_CATEGORIES = [
  "Music",
  "Dance",
  "Art",
  "Cosplay",
] as const;

type VoteCategory =
  (typeof VOTE_CATEGORIES)[number];

type VoteRow = {
  artist_id: string;
  category: string;
  week_start: string;
};

type CreatorRow = {
  id: string;
  name: string;
  profile_image: string | null;
  cover_image: string | null;
};

type VoteArtist = {
  id: string;
  name: string;
  imageUrl: string | null;
};

type UserVote = {
  artistId: string;
  category: string;
  weekStart: string;
  artist: VoteArtist;
};

function normalizeCategory(
  category: string,
) {
  return category.trim().toLowerCase();
}

function toVoteCategory(
  category: string,
): VoteCategory | null {
  const normalized =
    normalizeCategory(category);

  return (
    VOTE_CATEGORIES.find(
      (item) =>
        item.toLowerCase() ===
        normalized,
    ) ?? null
  );
}

function resolveArtistImage(
  artist: CreatorRow,
) {
  if (artist.profile_image) {
    return artist.profile_image;
  }

  if (artist.cover_image) {
    return artist.cover_image;
  }

  return null;
}

function formatWeekRange(
  weekStart: string,
) {
  const monday = new Date(
    `${weekStart}T00:00:00.000Z`,
  );
  const sunday = new Date(monday);

  sunday.setUTCDate(
    sunday.getUTCDate() + 6,
  );

  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      },
    );

  return `${formatter.format(monday)} – ${formatter.format(sunday)}`;
}

function VoteAvatar({
  artist,
}: {
  artist: VoteArtist;
}) {
  if (artist.imageUrl) {
    return (
      <img
        src={artist.imageUrl}
        alt={`${artist.name} profile`}
        draggable={false}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
      <span className="text-sm font-black uppercase text-gray-300">
        {artist.name.charAt(0)}
      </span>
    </div>
  );
}

function ThisWeekVoteItem({
  category,
  vote,
}: {
  category: VoteCategory;
  vote: UserVote | null;
}) {
  return (
    <div className="flex items-start gap-4 border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
      <p className="w-20 shrink-0 pt-0.5 text-sm font-bold text-gray-950">
        {category}
      </p>

      {vote ? (
        <div className="flex min-w-0 items-center gap-3">
          <VoteAvatar
            artist={vote.artist}
          />

          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-950">
              {vote.artist.name}
            </p>

            <Link
              href={`/creator/${vote.artist.id}`}
              className="mt-0.5 inline-block text-sm font-semibold text-fuchsia-600 transition hover:text-fuchsia-700"
            >
              View Artist →
            </Link>
          </div>
        </div>
      ) : (
        <p className="pt-0.5 text-sm text-gray-400">
          No vote yet
        </p>
      )}
    </div>
  );
}

export default function MyKovemuVotes() {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [
    votes,
    setVotes,
  ] = useState<UserVote[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const currentWeekStart =
    getWeekStart();

  const loadVotes =
    useCallback(async () => {
      setLoading(true);
      setErrorMessage(null);

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        setVotes([]);
        setLoading(false);
        return;
      }

      const {
        data: voteRows,
        error: voteError,
      } = await supabase
        .from("artist_votes")
        .select(
          "artist_id, category, week_start",
        )
        .eq("user_id", user.id)
        .order("week_start", {
          ascending: false,
        });

      if (voteError) {
        console.error(
          "LOAD MY KOVEMU VOTES ERROR:",
          voteError,
        );
        setErrorMessage(
          "Couldn't load your votes.",
        );
        setLoading(false);
        return;
      }

      const rows =
        (voteRows ??
          []) as VoteRow[];

      if (rows.length === 0) {
        setVotes([]);
        setLoading(false);
        return;
      }

      const artistIds = Array.from(
        new Set(
          rows.map(
            (row) => row.artist_id,
          ),
        ),
      );

      const {
        data: creatorRows,
        error: creatorError,
      } = await supabase
        .from("creators")
        .select(
          "id, name, profile_image, cover_image",
        )
        .in("id", artistIds);

      if (creatorError) {
        console.error(
          "LOAD MY KOVEMU VOTE ARTISTS ERROR:",
          creatorError,
        );
        setErrorMessage(
          "Couldn't load your votes.",
        );
        setLoading(false);
        return;
      }

      const creatorMap = new Map(
        (
          (creatorRows ??
            []) as CreatorRow[]
        ).map((artist) => [
          artist.id,
          artist,
        ]),
      );

      const mappedVotes = rows
        .map((row) => {
          const creator =
            creatorMap.get(
              row.artist_id,
            );

          if (!creator) {
            return null;
          }

          return {
            artistId: row.artist_id,
            category: row.category,
            weekStart: row.week_start,
            artist: {
              id: creator.id,
              name: creator.name,
              imageUrl:
                resolveArtistImage(
                  creator,
                ),
            },
          } satisfies UserVote;
        })
        .filter(
          (
            vote,
          ): vote is UserVote =>
            vote !== null,
        );

      setVotes(mappedVotes);
      setLoading(false);
    }, [supabase]);

  useEffect(() => {
    void loadVotes();
  }, [loadVotes]);

  const thisWeekVotes = useMemo(() => {
    const weekVotes = votes.filter(
      (vote) =>
        vote.weekStart ===
        currentWeekStart,
    );

    return VOTE_CATEGORIES.map(
      (category) => ({
        category,
        vote:
          weekVotes.find(
            (vote) =>
              toVoteCategory(
                vote.category,
              ) === category,
          ) ?? null,
      }),
    );
  }, [
    votes,
    currentWeekStart,
  ]);

  const pastVoteWeeks = useMemo(() => {
    const pastVotes = votes.filter(
      (vote) =>
        vote.weekStart !==
        currentWeekStart,
    );

    const weekMap = new Map<
      string,
      UserVote[]
    >();

    for (const vote of pastVotes) {
      const existing =
        weekMap.get(
          vote.weekStart,
        ) ?? [];

      existing.push(vote);
      weekMap.set(
        vote.weekStart,
        existing,
      );
    }

    return Array.from(
      weekMap.entries(),
    )
      .sort(([weekA], [weekB]) =>
        weekB.localeCompare(weekA),
      )
      .map(([weekStart, weekVotes]) => ({
        weekStart,
        weekLabel:
          formatWeekRange(weekStart),
        votes: [...weekVotes].sort(
          (a, b) => {
            const categoryA =
              toVoteCategory(
                a.category,
              );
            const categoryB =
              toVoteCategory(
                b.category,
              );

            const indexA =
              categoryA
                ? VOTE_CATEGORIES.indexOf(
                    categoryA,
                  )
                : 99;
            const indexB =
              categoryB
                ? VOTE_CATEGORIES.indexOf(
                    categoryB,
                  )
                : 99;

            return (
              indexA - indexB
            );
          },
        ),
      }));
  }, [
    votes,
    currentWeekStart,
  ]);

  if (loading) {
    return (
      <p className="text-sm text-gray-400">
        Loading...
      </p>
    );
  }

  if (errorMessage) {
    return (
      <p className="text-sm text-red-500">
        {errorMessage}
      </p>
    );
  }

  return (
    <div className="space-y-12">
      <section>
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
          This Week
        </h2>

        <div className="mt-4 space-y-4">
          {thisWeekVotes.map(
            ({ category, vote }) => (
              <ThisWeekVoteItem
                key={category}
                category={category}
                vote={vote}
              />
            ),
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
          Past Votes
        </h2>

        {pastVoteWeeks.length ===
        0 ? (
          <p className="mt-4 text-sm text-gray-400">
            No past votes yet.
          </p>
        ) : (
          <div className="mt-4 space-y-8">
            {pastVoteWeeks.map(
              (week) => (
                <div
                  key={
                    week.weekStart
                  }
                >
                  <h3 className="text-sm font-bold text-gray-950">
                    {
                      week.weekLabel
                    }
                  </h3>

                  <div className="mt-3 space-y-2">
                    {week.votes.map(
                      (vote) => {
                        const categoryLabel =
                          toVoteCategory(
                            vote.category,
                          ) ??
                          vote.category;

                        return (
                          <div
                            key={`${week.weekStart}-${vote.category}-${vote.artistId}`}
                            className="flex flex-wrap items-center gap-x-2 text-sm text-gray-600"
                          >
                            <span className="font-semibold text-gray-500">
                              {
                                categoryLabel
                              }
                            </span>
                            <span className="text-gray-300">
                              ·
                            </span>
                            <Link
                              href={`/creator/${vote.artist.id}`}
                              className="font-semibold text-gray-950 transition hover:text-fuchsia-600"
                            >
                              {
                                vote
                                  .artist
                                  .name
                              }
                            </Link>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
