import CreatorCard from "@/components/CreatorCard";
import Header from "@/components/Header";

import {
  allCreators,
  getCreatorById,
  type Creator,
} from "@/data/creators";

import { categoryCreators } from "@/data/categoryCreators";
import { createClient } from "@/lib/supabase/server";

import Link from "next/link";
import { notFound } from "next/navigation";

type CreatorPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type DbPost = {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
};

function formatFollowers(followers: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(followers);
}

function normalizeCategory(category: string) {
  return category.toLowerCase();
}

/*
  기존 더미 데이터 + 새 categoryCreators 데이터를 합친다.
  중복 id는 하나만 남긴다.
*/
const demoCreators: Creator[] = Array.from(
  new Map(
    [...categoryCreators, ...allCreators].map((creator) => [
      creator.id,
      creator,
    ]),
  ).values(),
);

function getDemoCreatorById(id: string) {
  return (
    categoryCreators.find((creator) => creator.id === id) ??
    getCreatorById(id)
  );
}

function getRelatedCreators(
  creatorId: string,
  category: string,
) {
  return demoCreators
    .filter(
      (creator) =>
        creator.id !== creatorId &&
        normalizeCategory(creator.category) ===
          normalizeCategory(category),
    )
    .slice(0, 4);
}

export async function generateStaticParams() {
  return demoCreators.map((creator) => ({
    id: creator.id,
  }));
}

export default async function CreatorPage({
  params,
}: CreatorPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  /*
    1. 먼저 Supabase에서 실제 Creator를 찾는다.
  */
  const { data: dbCreator } = await supabase
    .from("creators")
    .select(
      `
        id,
        username,
        name,
        category,
        bio,
        profile_image,
        cover_image,
        created_at
      `,
    )
    .eq("id", id)
    .maybeSingle();

  /*
    2. 실제 DB Creator가 아니라면 기존 더미 데이터에서 찾는다.
  */
  const demoCreator = getDemoCreatorById(id);

  if (!dbCreator && !demoCreator) {
    notFound();
  }

  /*
    3. 실제 Creator라면 업로드 작품들을 가져온다.
  */
  let posts: DbPost[] = [];

  if (dbCreator) {
    const { data } = await supabase
      .from("posts")
      .select(
        `
          id,
          image_url,
          caption,
          created_at
        `,
      )
      .eq("creator_id", dbCreator.id)
      .order("created_at", {
        ascending: false,
      });

    posts = data ?? [];
  }

  /*
    실제 Creator와 더미 Creator를
    아래 UI에서 동일하게 사용할 수 있도록 정리한다.
  */

  const creatorId =
    dbCreator?.id ?? demoCreator!.id;

  const creatorName =
    dbCreator?.name ?? demoCreator!.name;

  const creatorCategory = dbCreator
    ? dbCreator.category.charAt(0).toUpperCase() +
      dbCreator.category.slice(1)
    : demoCreator!.category;

  const creatorDescription =
    dbCreator?.bio ||
    demoCreator?.description ||
    "Creator on Kovemu.";

  /*
    중요:
    최신 Post를 Hero 이미지로 사용하지 않는다.

    Discover만 최신 업로드 이미지를 자동 사용하고,
    Creator Profile은 별도 cover/profile 이미지를 사용한다.
  */
  const heroImage =
    dbCreator?.cover_image ||
    dbCreator?.profile_image ||
    demoCreator?.image ||
    null;

  const followers =
    demoCreator?.followers ?? 0;

  const badge =
    demoCreator?.badge ?? null;

  const tags = demoCreator?.tags ?? [
    creatorCategory,
  ];

  const platforms =
    demoCreator?.platforms ?? [];

  const relatedCreators =
    getRelatedCreators(
      creatorId,
      creatorCategory,
    );

  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* Creator Hero */}
      <section className="border-b border-gray-100 bg-gray-950">
        <div className="relative mx-auto h-[470px] max-w-7xl overflow-hidden">
          {heroImage && (
            <img
              src={heroImage}
              alt={`${creatorName} featured work`}
              className="absolute inset-0 h-full w-full object-cover opacity-70"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/15" />

          <div className="relative flex h-full items-end px-6 py-12 text-white lg:px-10 lg:py-16">
            <div className="max-w-2xl">
              <Link
                href="/discover"
                className="text-sm font-semibold text-white/70 transition hover:text-white"
              >
                ← Back to Discover
              </Link>

              <p className="mt-8 text-sm font-bold uppercase tracking-[0.22em] text-fuchsia-300">
                {creatorCategory}
              </p>

              <h1 className="mt-3 text-5xl font-black tracking-tight md:text-7xl">
                {creatorName}
              </h1>

              {dbCreator?.username && (
                <p className="mt-2 text-sm font-semibold text-white/60">
                  @{dbCreator.username}
                </p>
              )}

              <p className="mt-5 max-w-xl text-lg leading-8 text-white/85">
                {creatorDescription}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                {!dbCreator && (
                  <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur">
                    {formatFollowers(
                      followers,
                    )}{" "}
                    followers
                  </span>
                )}

                {badge && (
                  <span className="rounded-full bg-fuchsia-600 px-4 py-2 text-sm font-bold">
                    {badge}
                  </span>
                )}
              </div>

              <button
                type="button"
                className="mt-8 rounded-full bg-fuchsia-600 px-8 py-3.5 font-bold text-white transition hover:bg-fuchsia-700"
              >
                Support Creator
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
          <div>
            {/* About */}
            <section>
              <h2 className="text-3xl font-black tracking-tight text-gray-950">
                About
              </h2>

              <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">
                {creatorDescription}
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-fuchsia-50 px-4 py-2 text-sm font-semibold text-fuchsia-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>

            {/* Latest Works */}
            <section className="mt-14">
              <div className="flex items-end justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-gray-950">
                    Latest Works
                  </h2>

                  <p className="mt-2 text-gray-500">
                    Recent projects and representative
                    work.
                  </p>
                </div>
              </div>

              {dbCreator ? (
                posts.length > 0 ? (
                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    {posts.map(
                      (post, index) => (
                        <article
                          key={post.id}
                          className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-xl"
                        >
                          <div className="aspect-video overflow-hidden bg-gray-100">
                            <img
                              src={
                                post.image_url
                              }
                              alt={
                                post.caption ||
                                `${creatorName} work`
                              }
                              draggable={false}
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            />
                          </div>

                          <div className="p-5">
                            <p className="text-xs font-bold uppercase tracking-wider text-fuchsia-600">
                              Work{" "}
                              {index + 1}
                            </p>

                            <h3 className="mt-2 text-lg font-bold text-gray-950">
                              {post.caption ||
                                creatorName}
                            </h3>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
                    <p className="font-semibold text-gray-700">
                      No works uploaded yet.
                    </p>
                  </div>
                )
              ) : (
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  {[1, 2, 3, 4].map(
                    (work) => (
                      <article
                        key={work}
                        className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-xl"
                      >
                        <div className="aspect-video overflow-hidden bg-gray-100">
                          <img
                            src={
                              demoCreator!.image
                            }
                            alt={`${creatorName} work ${work}`}
                            draggable={false}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        </div>

                        <div className="p-5">
                          <p className="text-xs font-bold uppercase tracking-wider text-fuchsia-600">
                            Project {work}
                          </p>

                          <h3 className="mt-2 text-lg font-bold text-gray-950">
                            {creatorName}
                          </h3>
                        </div>
                      </article>
                    ),
                  )}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <aside>
            <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-xl font-black text-gray-950">
                Creator Links
              </h2>

              {platforms.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {platforms.map(
                    (platform) => (
                      <button
                        key={platform}
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700"
                      >
                        <span>
                          {platform}
                        </span>

                        <span>↗</span>
                      </button>
                    ),
                  )}
                </div>
              ) : (
                <p className="mt-5 text-sm leading-6 text-gray-500">
                  No external links added
                  yet.
                </p>
              )}

              <div className="mt-7 rounded-2xl bg-fuchsia-50 p-5">
                <p className="text-sm font-bold text-fuchsia-700">
                  Support this creator
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Continue to the creator&apos;s
                  official support page.
                </p>

                <button
                  type="button"
                  className="mt-5 w-full rounded-full bg-fuchsia-600 px-5 py-3 font-bold text-white transition hover:bg-fuchsia-700"
                >
                  Support
                </button>
              </div>
            </div>
          </aside>
        </div>

        {/* Related Creators */}
        {relatedCreators.length > 0 && (
          <section className="mt-20 border-t border-gray-100 pt-12">
            <div className="mb-7">
              <h2 className="text-3xl font-black tracking-tight text-gray-950">
                You May Also Like
              </h2>

              <p className="mt-2 text-gray-500">
                More creators worth
                discovering.
              </p>
            </div>

            <div className="flex gap-5 overflow-x-auto px-1 pb-6 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {relatedCreators.map(
                (relatedCreator) => (
                  <CreatorCard
                    key={
                      relatedCreator.id
                    }
                    {...relatedCreator}
                  />
                ),
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}