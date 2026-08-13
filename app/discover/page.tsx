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

  // 같은 Artist의 Work가 연속되는 것을 가능한 한 방지
  for (let i = 1; i < pool.length; i += 1) {
    if (pool[i].artistId === pool[i - 1].artistId) {
      const swapIndex = pool.findIndex(
        (work, index) =>
          index > i &&
          work.artistId !== pool[i - 1].artistId,
      );

      if (swapIndex !== -1) {
        [pool[i], pool[swapIndex]] = [
          pool[swapIndex],
          pool[i],
        ];
      }
    }
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
    <main className="min-h-screen bg-white">
      <Header />

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-2 lg:px-10">
        <DiscoverFeed works={feedWorks} />
      </section>
    </main>
  );
}