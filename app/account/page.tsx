import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import ProfileEditor from "@/components/account/ProfileEditor";

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: creator } = await supabase
    .from("creators")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  let posts = [];

  if (creator) {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("creator_id", creator.id)
      .order("created_at", { ascending: false })
      .limit(6);

    posts = data ?? [];
  }

  return (
    <main className="min-h-screen bg-white">
      <Header />

      <div className="mx-auto max-w-4xl px-6 py-16 lg:px-10">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-fuchsia-600">
          Account
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-gray-950">
          My Profile
        </h1>

        <p className="mt-3 text-gray-500">
          {user.email}
        </p>
       

        {creator ? (
          <>
            <ProfileEditor
  creator={creator}
  userId={user.id}
/>

            <section className="mt-14">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-2xl font-black text-gray-950">
                    Recent uploads
                  </h2>

                  <p className="mt-2 text-sm text-gray-500">
                    Your latest work on Kovemu.
                  </p>
                </div>

                <Link
                  href="/account/upload"
                  className="text-sm font-semibold text-fuchsia-600 hover:text-fuchsia-700"
                >
                  Upload new →
                </Link>
              </div>

              {posts.length > 0 ? (
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {posts.map((post) => (
                    <article
                      key={post.id}
                      className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
                    >
                      <div className="aspect-[4/5] overflow-hidden bg-gray-100">
                        <img
                          src={post.image_url}
                          alt={post.caption || "Creator upload"}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      {post.caption && (
                        <p className="p-4 text-sm leading-6 text-gray-600">
                          {post.caption}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
                  <p className="font-semibold text-gray-700">
                    No uploads yet.
                  </p>

                  <p className="mt-2 text-sm text-gray-500">
                    Upload your first work to appear on Kovemu.
                  </p>

                  <Link
                    href="/account/upload"
                    className="mt-5 inline-flex rounded-full bg-fuchsia-600 px-6 py-3 text-sm font-bold text-white"
                  >
                    Upload your first work
                  </Link>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="mt-10 rounded-2xl border border-gray-200 p-8">
            <h2 className="text-2xl font-black text-gray-950">
              Become a Creator
            </h2>

            <p className="mt-3 max-w-xl leading-7 text-gray-500">
              Create your creator profile and start sharing your work on
              Kovemu.
            </p>

            <Link
              href="/account/create-creator"
              className="mt-6 inline-flex rounded-full bg-fuchsia-600 px-6 py-3 font-bold text-white transition hover:bg-fuchsia-700"
            >
              Create Creator Profile
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}