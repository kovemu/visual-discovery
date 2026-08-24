import Header from "@/components/Header";
import FeaturedWorksCarousel from "@/components/artist/FeaturedWorksCarousel";
import LatestWorksCarousel from "@/components/artist/LatestWorksCarousel";
import ArtistVote from "@/components/artist/ArtistVote";
import ProfileMyPicks from "@/components/artist/ProfileMyPicks";

import {
  ExternalLink,
  Camera,
  Play,
} from "lucide-react";

import type { DemoWork } from "@/data/discoverWorks";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/isUuid";

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


export default async function CreatorPage({
  params,
}: CreatorPageProps) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

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
          tagline,
          bio,
          profile_image,
          cover_image,
          cover_position_x,
          cover_position_y,
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

  if (!dbCreator) {
    notFound();
  }

  const artistId = dbCreator.id;

  const artistName = dbCreator.name;

  const rawCategory = dbCreator.category;

  const artistCategory =
    rawCategory.charAt(0).toUpperCase() +
    rawCategory.slice(1);

  const artistTagline =
    dbCreator.tagline ||
    "Discover this artist on Kovemu.";
  
    const artistDescription =
    dbCreator.bio ||
    "On Kovemu.";

 const heroImage =
  dbCreator.cover_image ||
  null;

  const profileImage =
  dbCreator.profile_image || null;
  
  const coverPositionX =
  dbCreator.cover_position_x ?? 50;

  const coverPositionY =
  dbCreator.cover_position_y ?? 50;

  const tags =
    dbCreator.tags?.length
      ? dbCreator.tags
      : [artistCategory];

  /*
    Artist Links

    DB에서 관리자가 저장한 링크를 사용.
  */
  const platforms: PlatformItem[] = [];

  if (dbCreator.youtube_url) {
    platforms.push({
      name: "YouTube",
      url: dbCreator.youtube_url,
    });
  }

  if (dbCreator.instagram_url) {
    platforms.push({
      name: "Instagram",
      url: dbCreator.instagram_url,
    });
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
          : work.source === "tiktok"
            ? "tiktok"
            : "image",

      videoId:
        work.source === "youtube" ||
        work.source === "tiktok"
          ? work.source_id ?? undefined
          : undefined,

      image:
        work.thumbnail_url ??
        (work.source === "youtube" ||
        work.source === "tiktok"
          ? undefined
          : work.source_url),

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



  /*
    Curated 여부는 이제 DB의 is_curated 기준.
  */
  const isCurated =
    dbCreator.is_curated ?? true;

  return (
    <>
    <main className="min-h-screen bg-white">
      <Header />

      {/* Artist Hero */}
      <section className="border-b border-gray-100 bg-gray-950">
        <div className="relative mx-auto h-[430px] max-w-7xl overflow-hidden">
          {heroImage && (
  <img
    src={heroImage}
    alt={`${artistName} cover`}
    className="absolute inset-0 h-full w-full object-cover opacity-65"
    style={{
      objectPosition: `${coverPositionX}% ${coverPositionY}%`,
    }}
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

              <div className="mt-3 flex items-center gap-3">
  {profileImage && (
    <img
      src={profileImage}
      alt={`${artistName} profile`}
      className="h-16 w-16 shrink-0 rounded-full border-2 border-white/25 object-cover"
    />
  )}

  <div>
    <h1 className="text-5xl font-black tracking-tight md:text-6xl">
      {artistName}
    </h1>

                {dbCreator.username && (
      <p className="mt-2 text-sm font-semibold text-white/60">
        @{dbCreator.username}
      </p>
    )}
  </div>
</div>

              <p className="mt-5 max-w-xl text-lg leading-8 text-white/85">
                {artistTagline}
              </p>

              {isCurated && (
  <p className="mt-5 text-xs font-medium text-white/45">
    Curated by Kovemu
  </p>
)}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
           <div className="min-w-0">
            {/* About */}
            <section>
              <h2 className="text-3xl font-black tracking-tight text-gray-950">
                About
              </h2>

              <p className="mt-5 max-w-3xl whitespace-pre-line text-lg leading-8 text-gray-600">
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
          {/* Artist Sidebar */}
<aside className="space-y-5">
  {dbCreator && (
    <ArtistVote
      artistId={artistId}
      artistName={artistName}
      category={artistCategory}
    />
  )}

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
                           <span className="flex items-center gap-3">
  {name.toLowerCase() === "youtube" ? (
    <Play
      size={18}
      strokeWidth={1.8}
    />
  ) : name.toLowerCase() === "instagram" ? (
    <Camera
      size={18}
      strokeWidth={1.8}
    />
  ) : (
    <ExternalLink
      size={18}
      strokeWidth={1.8}
    />
  )}

  {name}
</span>


<ExternalLink
  size={16}
  strokeWidth={1.8}
/>
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

       
      </div>
    </main>
    <ProfileMyPicks />
    </>
  );
}