import Header from "@/components/Header";
import WeeklyRankings from "@/components/rankings/WeeklyRankings";
import { getWeeklyRankings } from "@/lib/rankings/getWeeklyRankings";
import { normalizeRankingCategory } from "@/lib/rankings/rankingCategories";

export const dynamic = "force-dynamic";

type RankingsPageProps = {
  searchParams: Promise<{
    category?: string;
  }>;
};

export default async function RankingsPage({
  searchParams,
}: RankingsPageProps) {
  const params = await searchParams;
  const activeCategory =
    normalizeRankingCategory(
      params.category ?? "Music",
    );

  const artists =
    await getWeeklyRankings(
      activeCategory,
    );

  return (
    <main className="min-h-screen bg-white">
      <Header />

      <section className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
        <h1 className="text-3xl font-black tracking-tight text-gray-950">
          Weekly Rankings
        </h1>

        <WeeklyRankings
          activeCategory={
            activeCategory
          }
          artists={artists}
        />
      </section>
    </main>
  );
}
