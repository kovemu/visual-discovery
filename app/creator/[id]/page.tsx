import CreatorCard from "@/components/CreatorCard";
import Header from "@/components/Header";
import FeaturedWorksCarousel from "@/components/artist/FeaturedWorksCarousel";
import LatestWorksCarousel from "@/components/artist/LatestWorksCarousel";

import {
  allCreators,
  getCreatorById,
  type Creator,
} from "@/data/creators";

import { categoryCreators } from "@/data/categoryCreators";
import type { DemoWork } from "@/data/discoverWorks";
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

type DbWork = {
  id: number;
  type: string;
  source: string;
  source_id: string | null;
  source_url: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  featured: boolean;
};

type PlatformItem =
  | string
  | {
      name: string;
      url: string;
    };

function normalizeCategory(category: string) {
  return category.toLowerCase();
}

/*
  기존 Demo Artist 데이터 통합
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

function getPlatformName(platform: PlatformItem) {
  if (typeof platform === "string") {
    return platform;
  }

  return platform.name;
}

function getPlatformUrl(platform: PlatformItem) {
  if (typeof platform === "string") {
    return null;
  }

  if (
    platform.url.startsWith("http://") ||
    platform.url.startsWith("https://")
  ) {
    return platform.url;
  }

  return `https://${platform.url}`;
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
    Supabase Artist 확인
  */
  const { data: dbCreator, error: creatorError } =
    await supabase
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
          tags,
          youtube_url,
          instagram_url,
          is_curated,
          created_at
        `,
      )
      .eq("id", id)
      .maybeSingle();

  if (creatorError) {
    console.error(
      "LOAD ARTIST ERROR:",
      creatorError,
    );
  }

  /*
    기존 Demo Artist 확인
  */
  const demoCreator = getDemoCreatorById(id);

  if (!dbCreator && !demoCreator) {
    notFound();
  }

  /*
    공통 Artist 데이터
  */
  const artistId =
    dbCreator?.id ?? demoCreator!.id;

  const artistName =
    dbCreator?.name ?? demoCreator!.name;

  const rawCategory =
    dbCreator?.category ??
    demoCreator!.category;

  const artistCategory =
    rawCategory.charAt(0).toUpperCase() +
    rawCategory.slice(1);

  const artistDescription =
    dbCreator?.bio ||
    demoCreator?.description ||
    "Artist on Kovemu.";

  const heroImage =
    dbCreator?.cover_image ||
    dbCreator?.profile_image ||
    demoCreator?.image ||
    null;

  /*
    DB tags 우선.
    DB에 없으면 기존 demo tags,
    그것도 없으면 category 하나.
  */
  const tags =
    dbCreator?.tags?.length
      ? dbCreator.tags
      : demoCreator?.tags ?? [artistCategory];

  /*
    Artist Links

    DB에서 관리자가 저장한 링크를 우선 사용.
    DB 링크가 하나도 없으면 기존 demo 링크 fallback.
  */
  const platforms: PlatformItem[] = [];

  if (dbCreator?.youtube_url) {
    platforms.push({
      name: "YouTube",
      url: dbCreator.youtube_url,
    });
  }

  if (dbCreator?.instagram_url) {
    platforms.push({
      name: "Instagram",
      url: dbCreator.instagram_url,
    });
  }

  if (
    platforms.length === 0 &&
    demoCreator?.platformLinks
  ) {
    platforms.push(
      ...demoCreator.platformLinks,
    );
  }

  /*
    Supabase Works

    모든 Artist의 YouTube / Image Work는
    works 테이블 기준.
  */
  const { data: dbWorksData, error: worksError } =
    await supabase
      .from("works")
      .select(
        `
          id,
          type,
          source,
          source_id,
          source_url,
          title,
          description,
          thumbnail_url,
          published_at,
          featured
        `,
      )
      .eq("artist_id", artistId)
      .order("published_at", {
        ascending: false,
      });

  if (worksError) {
    console.error(
      "LOAD ARTIST WORKS ERROR:",
      worksError,
    );
  }

  const dbWorks =
    (dbWorksData ?? []) as DbWork[];

  /*
    기존 Carousel이 사용하는 DemoWork 구조로 변환
  */
  const importedWorks: DemoWork[] =
    dbWorks.map((work) => ({
      id: String(work.id),

      artistId,
      artistName,
      category: artistCategory,

      type:
        work.source === "youtube"
          ? "youtube"
          : "image",

      videoId:
        work.source === "youtube"
          ? work.source_id ?? undefined
          : undefined,

      image:
        work.thumbnail_url ??
        (work.source !== "youtube"
          ? work.source_url
          : undefined),

      caption:
        work.description ??
        work.title ??
        null,

      featured: work.featured,

      publishedAt:
        work.published_at ?? undefined,
    }));

  /*
    기존 가입 Artist가 직접 올린 이미지 posts도
    당장은 유지.

    추후 posts → works 통합 가능.
  */
  let posts: DbPost[] = [];

  if (dbCreator) {
    const { data, error } = await supabase
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

    if (error) {
      console.error(
        "LOAD ARTIST POSTS ERROR:",
        error,
      );
    }

    posts = data ?? [];
  }

  /*
    posts 역시 LatestWorksCarousel에서
    사용할 수 있도록 Work 형태로 변환
  */
  const uploadedWorks: DemoWork[] =
    posts.map((post) => ({
      id: `post-${post.id}`,

      artistId,
      artistName,
      category: artistCategory,

      type: "image",

      image: post.image_url,

      caption: post.caption,

      featured: false,

      publishedAt: post.created_at,
    }));

  /*
    Featured Works

    featured=true Work만 표시.
  */
  const featuredWorks =
    importedWorks
      .filter((work) => work.featured)
      .sort((a, b) => {
        const aTime = a.publishedAt
          ? new Date(a.publishedAt).getTime()
          : 0;

        const bTime = b.publishedAt
          ? new Date(b.publishedAt).getTime()
          : 0;

        return bTime - aTime;
      });

  /*
    Latest Works

    featured=true Work는 자동 제외.
  */
  const latestWorks =
    [
      ...importedWorks.filter(
        (work) => !work.featured,
      ),
      ...uploadedWorks,
    ].sort((a, b) => {
      const aTime = a.publishedAt
        ? new Date(a.publishedAt).getTime()
        : 0;

      const bTime = b.publishedAt
        ? new Date(b.publishedAt).getTime()
        : 0;

      return bTime - aTime;
    });

  const relatedCreators =
    getRelatedCreators(
      artistId,
      artistCategory,
    );

  /*
    Curated 여부는 이제 DB의 is_curated 기준.
  */
  const isCurated =
    dbCreator?.is_curated ?? true;

  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* Artist Hero */}
      <section className="border-b border-gray-100 bg-gray-950">
        <div className="relative mx-auto h-[430px] max-w-7xl overflow-hidden">
          {heroImage && (
            <img
              src={heroImage}
              alt={`${artistName} profile`}
              className="absolute inset-0 h-full w-full object-cover opacity-65"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/20" />

          <div className="relative flex h-full items-end px-6 py-12 text-white lg:px-10 lg:py-14">
            <div className="max-w-2xl">
              <Link
                href="/discover"
                className="cursor-pointer text-sm font-semibold text-white/70 transition hover:text-white"
              >
                ← Back to Discover
              </Link>

              <p className="mt-8 text-sm font-bold uppercase tracking-[0.22em] text-fuchsia-300">
                {artistCategory}
              </p>

              <h1 className="mt-3 text-5xl font-black tracking-tight md:text-6xl">
                {artistName}
              </h1>

              {dbCreator?.username && (
                <p className="mt-2 text-sm font-semibold text-white/60">
                  @{dbCreator.username}
                </p>
              )}

              <p className="mt-5 max-w-xl text-lg leading-8 text-white/85">
                {artistDescription}
              </p>

              {isCurated && (
                <div className="mt-6">
                  <span className="inline-flex rounded-full bg-fuchsia-600 px-4 py-2 text-sm font-bold text-white">
                    Curated by Kovemu
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1fr_300px]">
          <div>
            {/* About */}
            <section>
              <h2 className="text-3xl font-black tracking-tight text-gray-950">
                About
              </h2>

              <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">
                {artistDescription}
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="rounded-full bg-fuchsia-50 px-4 py-2 text-sm font-semibold text-fuchsia-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>

            {/* Featured Works */}
            {featuredWorks.length > 0 && (
              <section className="mt-14">
                <h2 className="text-3xl font-black tracking-tight text-gray-950">
                  Featured Tracks
                </h2>

                <p className="mt-2 text-gray-500">
                  Essential works from{" "}
                  {artistName}.
                </p>

                <FeaturedWorksCarousel
                  works={featuredWorks}
                  artistName={artistName}
                />
              </section>
            )}

            {/* Latest Works */}
            <section className="mt-14">
              <h2 className="text-3xl font-black tracking-tight text-gray-950">
                Latest Works
              </h2>

              <p className="mt-2 text-gray-500">
                Discover more work from{" "}
                {artistName}.
              </p>

              {latestWorks.length > 0 ? (
                <LatestWorksCarousel
                  works={latestWorks}
                  artistName={artistName}
                />
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
                  <p className="text-sm text-gray-500">
                    More works coming soon.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Artist Links */}
          <aside>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-xl font-black text-gray-950">
                Artist Links
              </h2>

              {platforms.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {platforms.map(
                    (platform, index) => {
                      const name =
                        getPlatformName(
                          platform,
                        );

                      const url =
                        getPlatformUrl(
                          platform,
                        );

                      if (url) {
                        return (
                          <a
                            key={`${name}-${index}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700"
                          >
                            <span>
                              {name}
                            </span>

                            <span>↗</span>
                          </a>
                        );
                      }

                      return (
                        <div
                          key={`${name}-${index}`}
                          className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-500"
                        >
                          <span>
                            {name}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
              ) : (
                <p className="mt-5 text-sm leading-6 text-gray-500">
                  No external links
                  available yet.
                </p>
              )}

              {isCurated && (
                <p className="mt-6 border-t border-gray-100 pt-5 text-xs leading-5 text-gray-400">
                  This profile is curated
                  by Kovemu using publicly
                  available information.
                </p>
              )}
            </div>
          </aside>
        </div>

        {/* Related Artists */}
        {relatedCreators.length > 0 && (
          <section className="mt-20 border-t border-gray-100 pt-12">
            <div className="mb-7">
              <h2 className="text-3xl font-black tracking-tight text-gray-950">
                Discover More
              </h2>

              <p className="mt-2 text-gray-500">
                More artists you may want
                to explore.
              </p>
            </div>

            <div className="flex gap-5 overflow-x-auto px-1 pb-6 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {relatedCreators.map(
                (relatedArtist) => (
                  <CreatorCard
                    key={relatedArtist.id}
                    {...relatedArtist}
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