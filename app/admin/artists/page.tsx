import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  CREATOR_CATEGORY_OPTIONS,
  formatCreatorCategoryLabel,
} from "@/lib/creator/creatorCategories";

type ArtistRow = {
  id: string;
  name: string;
  username: string | null;
  category: string;
  bio: string | null;
  profile_image: string | null;
  cover_image: string | null;
  created_at: string;
  works: {
    count: number;
  }[];
};

type AdminArtistsPageProps = {
  searchParams: Promise<{
    category?: string;
  }>;
};

const CATEGORY_OPTIONS = [
  {
    value: "all",
    label: "All",
  },
  ...CREATOR_CATEGORY_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  })),
] as const;

function formatCategory(category: string) {
  return formatCreatorCategoryLabel(category);
}

function getCategoryBadgeStyle(
  category: string,
) {
  switch (category.toLowerCase()) {
    case "kpop":
      return "bg-purple-50 text-purple-700 ring-purple-100";

    case "cheer":
      return "bg-blue-50 text-blue-700 ring-blue-100";

    case "cos":
      return "bg-pink-50 text-pink-700 ring-pink-100";

    case "look":
      return "bg-orange-50 text-orange-700 ring-orange-100";

    default:
      return "bg-zinc-100 text-zinc-600 ring-zinc-200";
  }
}

function formatWorkCountLabel(
  count: number,
) {
  return count === 1
    ? "1 work"
    : `${count} works`;
}

function getCategoryFilterStyle(
  category: string,
  selected: boolean,
) {
  if (!selected) {
    return "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50";
  }

  switch (category) {
    case "kpop":
      return "border-purple-200 bg-purple-50 text-purple-700";

    case "cheer":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "cos":
      return "border-pink-200 bg-pink-50 text-pink-700";

    case "look":
      return "border-orange-200 bg-orange-50 text-orange-700";

    default:
      return "border-zinc-950 bg-zinc-950 text-white";
  }
}

export default async function AdminArtistsPage({
  searchParams,
}: AdminArtistsPageProps) {
  const params = await searchParams;

  const requestedCategory =
    params.category?.toLowerCase() ??
    "all";

  const validCategory =
    CATEGORY_OPTIONS.some(
      (option) =>
        option.value ===
        requestedCategory,
    )
      ? requestedCategory
      : "all";

  const supabase =
    await createClient();

  const { data, error } =
    await supabase
      .from("creators")
      .select(
        `
          id,
          name,
          username,
          category,
          bio,
          profile_image,
          cover_image,
          created_at,
          works(count)
        `,
      )
      .order("name", {
        ascending: true,
      });

  if (error) {
    console.error(
      "LOAD ADMIN ARTISTS ERROR:",
      error,
    );
  }

  const artists =
    (data ?? []) as ArtistRow[];

  /*
    Category별 숫자
  */
  const categoryCounts =
    artists.reduce<
      Record<string, number>
    >((counts, artist) => {
      const category =
        artist.category.toLowerCase();

      counts[category] =
        (counts[category] ?? 0) + 1;

      return counts;
    }, {});

  /*
    선택된 Category만 표시
  */
  const filteredArtists =
    validCategory === "all"
      ? artists
      : artists.filter(
          (artist) =>
            artist.category.toLowerCase() ===
            validCategory,
        );

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Header */}
        <section className="mb-10">
          <p className="text-sm font-medium text-zinc-500">
            Kovemu Admin
          </p>

          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
                Artists
              </h1>

              <p className="mt-3 text-sm text-zinc-500">
                Kovemu Artist 프로필을
                관리합니다.
              </p>
            </div>

            <Link
              href="/admin/import"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              YouTube Importer
            </Link>
          </div>
        </section>

        {/* Category filters */}
        <section className="mb-7">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map(
              (option) => {
                const selected =
                  validCategory ===
                  option.value;

                const count =
                  option.value === "all"
                    ? artists.length
                    : categoryCounts[
                        option.value
                      ] ?? 0;

                const href =
                  option.value === "all"
                    ? "/admin/artists"
                    : `/admin/artists?category=${option.value}`;

                return (
                  <Link
                    key={
                      option.value
                    }
                    href={href}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${getCategoryFilterStyle(
                      option.value,
                      selected,
                    )}`}
                  >
                    <span>
                      {option.label}
                    </span>

                    <span
                      className={`text-xs ${
                        selected
                          ? "opacity-70"
                          : "text-zinc-400"
                      }`}
                    >
                      {count}
                    </span>
                  </Link>
                );
              },
            )}
          </div>
        </section>

        {/* Artist count */}
        <section className="mb-6 flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            {filteredArtists.length}{" "}
            {validCategory === "all"
              ? "Artists"
              : `${formatCategory(
                  validCategory,
                )} Artists`}
          </p>
        </section>

        {/* Artist list */}
        {filteredArtists.length > 0 ? (
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {filteredArtists.map(
              (artist, index) => {
                const hasProfile =
                  Boolean(
                    artist.bio,
                  ) &&
                  Boolean(
                    artist.cover_image ||
                      artist.profile_image,
                  );

                const workCount =
                  artist.works?.[0]
                    ?.count ?? 0;

                return (
                  <div
                    key={artist.id}
                    className={`flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between ${
                      index !==
                      filteredArtists.length -
                        1
                        ? "border-b border-zinc-100"
                        : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      {/* Image */}
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                        {artist.profile_image ||
                        artist.cover_image ? (
                          <img
                            src={
                              artist.profile_image ||
                              artist.cover_image ||
                              ""
                            }
                            alt={
                              artist.name
                            }
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-zinc-400">
                            {artist.name
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Information */}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-base font-semibold text-zinc-950">
                            {
                              artist.name
                            }
                          </h2>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${getCategoryBadgeStyle(
                              artist.category,
                            )}`}
                          >
                            {formatCategory(
                              artist.category,
                            )}
                          </span>

                          <span className="text-base font-semibold text-zinc-800">
                            {formatWorkCountLabel(
                              workCount,
                            )}
                          </span>
                        </div>

                        {artist.username && (
                          <p className="mt-1 truncate text-sm text-zinc-400">
                            @
                            {
                              artist.username
                            }
                          </p>
                        )}

                        <div className="mt-2">
                          {hasProfile ? (
                            <span className="text-xs font-medium text-green-600">
                              Profile ready
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-amber-600">
                              Profile
                              incomplete
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-3">
                      <Link
                        href={`/creator/${artist.id}`}
                        target="_blank"
                        className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950"
                      >
                        View Profile
                      </Link>

                      <Link
                        href={`/admin/artists/${artist.id}`}
                        className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                );
              },
            )}
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-zinc-300 bg-white py-24 text-center">
            <h2 className="text-lg font-semibold text-zinc-900">
              No Artists
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              {validCategory ===
              "all"
                ? "등록된 Artist가 없습니다."
                : `${formatCategory(
                    validCategory,
                  )} Category에 등록된 Artist가 없습니다.`}
            </p>

            <Link
              href="/admin/import"
              className="mt-6 inline-flex rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white"
            >
              Open Importer
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}