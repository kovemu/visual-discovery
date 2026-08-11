import Header from "@/components/Header";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewPage() {
  const supabase = await createClient();

  const { data: creators, error } = await supabase
    .from("creators")
    .select(`
      id,
      name,
      username,
      category,
      bio,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
  }

  const newCreators = [];

  for (const creator of creators ?? []) {
    const { data: latestPost } = await supabase
      .from("posts")
      .select(`
        image_url,
        caption,
        created_at
      `)
      .eq("creator_id", creator.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestPost) {
      continue;
    }

    newCreators.push({
      ...creator,
      latestPost,
    });
  }

  return (
    <main className="min-h-screen bg-white">
      <Header />

      <section className="mx-auto max-w-7xl px-6 pb-4 pt-8 lg:px-10">
        <div className="border-b border-gray-100 pb-4">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-fuchsia-600">
            New
          </p>

          <h1 className="mt-1 text-4xl font-black tracking-tight text-gray-950">
            New Creators
          </h1>
 
        </div>

        {newCreators.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {newCreators.map((creator) => (
              <Link
                key={creator.id}
                href={`/creator/${creator.id}`}
                className="group block"
              >
                <article>
                  <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-gray-100">
                    <img
                      src={creator.latestPost.image_url}
                      alt={`${creator.name} latest work`}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />

                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <p className="text-xs font-bold uppercase tracking-wider text-white/70">
                        {creator.category}
                      </p>

                      <h2 className="mt-1 text-xl font-black">
                        {creator.name}
                      </h2>

                      <p className="mt-1 text-sm text-white/70">
                        @{creator.username}
                      </p>
                    </div>
                  </div>

                  {creator.bio && (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-500">
                      {creator.bio}
                    </p>
                  )}
                </article>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center">
            <h2 className="text-2xl font-black text-gray-900">
              No new creators yet.
            </h2>

            <p className="mt-2 text-gray-500">
              New creators will appear here after uploading their first work.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}