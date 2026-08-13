import { createClient } from "@/lib/supabase/server";

type Work = {
  id: number;
  title: string | null;
  thumbnail_url: string | null;
  source_url: string;
  published_at: string | null;
  duration_seconds: number | null;

  artist: {
    id: string;
    name: string;
    username: string | null;
  } | null;
};

export default async function WorksPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("works")
    .select(`
      id,
      title,
      thumbnail_url,
      source_url,
      published_at,
      duration_seconds,
      artist:creators (
        id,
        name,
        username
      )
    `)
    .order("published_at", {
      ascending: false,
    });

  if (error) {
    console.error("LOAD WORKS ERROR:", error);

    return (
      <main className="mx-auto max-w-7xl px-6 py-12">
        <p className="text-red-500">
          Work를 불러오지 못했습니다.
        </p>
      </main>
    );
  }

  const works = (data ?? []) as unknown as Work[];

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <section className="mb-10">
        <p className="mb-2 text-sm font-medium text-zinc-500">
          Kovemu
        </p>

        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          Works
        </h1>

        <p className="mt-3 text-sm text-zinc-500">
          Supabase works 테이블에서 불러온 작품입니다.
        </p>
      </section>

      {works.length > 0 ? (
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {works.map((work) => (
            <a
              key={work.id}
              href={work.source_url}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="aspect-video overflow-hidden bg-zinc-100">
                {work.thumbnail_url ? (
                  <img
                    src={work.thumbnail_url}
                    alt={work.title ?? ""}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                    No thumbnail
                  </div>
                )}
              </div>

              <div className="p-4">
                <h2 className="line-clamp-2 text-sm font-medium leading-6 text-zinc-950">
                  {work.title || "Untitled Work"}
                </h2>

                {work.artist && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-zinc-800">
                      {work.artist.name}
                    </p>

                    {work.artist.username && (
                      <p className="mt-0.5 text-xs text-zinc-400">
                        @{work.artist.username}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
                  <span>
                    {work.published_at
                      ? new Date(
                          work.published_at
                        ).toLocaleDateString("ko-KR")
                      : ""}
                  </span>

                  {work.duration_seconds !== null && (
                    <span>
                      {formatDuration(
                        work.duration_seconds
                      )}
                    </span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-zinc-200 py-24 text-center">
          <p className="text-sm text-zinc-400">
            등록된 Work가 없습니다.
          </p>
        </section>
      )}
    </main>
  );
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}