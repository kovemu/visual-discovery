import Header from "@/components/Header";
import DiscoverFeed, {
  type FeedItem,
} from "@/components/discover/DiscoverFeed";

import { getDiscoverFeed } from "@/data/discover";
import { getRealDiscoverWorks } from "@/lib/discover/getRealDiscoverWorks";

export const dynamic = "force-dynamic";

function shuffleWorks(works: FeedItem[]): FeedItem[] {
  const pool = [...works];

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(
      Math.random() * (i + 1),
    );

    [pool[i], pool[randomIndex]] = [
      pool[randomIndex],
      pool[i],
    ];
  }

  return pool;
}

export default async function DiscoverPage() {
  const demoWorks = getDiscoverFeed();

  // Supabase works 테이블
  const realWorks = await getRealDiscoverWorks();

  const feedWorks: FeedItem[] = shuffleWorks([
    ...realWorks,
    ...demoWorks,
  ]);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Header />

      <section className="mx-auto max-w-7xl px-6 pb-10 pt-1 lg:px-10 lg:pb-12 xl:pr-[88px]">
        <DiscoverFeed works={feedWorks} />
      </section>
    </main>
  );
}