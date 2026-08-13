import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type ArtistRow = {
  id: string;
  name: string;
  username: string | null;
  category: string;
  bio: string | null;
  profile_image: string | null;
  cover_image: string | null;
  created_at: string;
};

function formatCategory(category: string) {
  if (!category) {
    return "Unknown";
  }

  return (
    category.charAt(0).toUpperCase() +
    category.slice(1)
  );
}

export default async function AdminArtistsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
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
        created_at
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
                Kovemu Artist 프로필을 관리합니다.
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

        {/* Artist count */}
        <section className="mb-6">
          <p className="text-sm text-zinc-500">
            {artists.length} Artists
          </p>
        </section>

        {/* Artist list */}
        {artists.length > 0 ? (
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {artists.map((artist, index) => {
              const hasProfile =
                Boolean(artist.bio) &&
                Boolean(
                  artist.cover_image ||
                    artist.profile_image,
                );

              return (
                <div
                  key={artist.id}
                  className={`flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between ${
                    index !== artists.length - 1
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
                          alt={artist.name}
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
                          {artist.name}
                        </h2>

                        <span className="rounded-full bg-fuchsia-50 px-2.5 py-1 text-xs font-medium text-fuchsia-700">
                          {formatCategory(
                            artist.category,
                          )}
                        </span>
                      </div>

                      {artist.username && (
                        <p className="mt-1 truncate text-sm text-zinc-400">
                          @{artist.username}
                        </p>
                      )}

                      <div className="mt-2">
                        {hasProfile ? (
                          <span className="text-xs font-medium text-green-600">
                            Profile ready
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-amber-600">
                            Profile incomplete
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
            })}
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-zinc-300 bg-white py-24 text-center">
            <h2 className="text-lg font-semibold text-zinc-900">
              No Artists
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              YouTube Importer에서 Artist를
              생성해주세요.
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