import Link from "next/link";

import RankingArtistCard from "@/components/rankings/RankingArtistCard";
import type { WeeklyRankingArtist } from "@/lib/rankings/getWeeklyRankings";
import {
  RANKING_CATEGORIES,
  type RankingCategory,
} from "@/lib/rankings/rankingCategories";

type WeeklyRankingsProps = {
  activeCategory: RankingCategory;
  artists: WeeklyRankingArtist[];
};

export default function WeeklyRankings({
  activeCategory,
  artists,
}: WeeklyRankingsProps) {
  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-6 border-b border-gray-200">
        {RANKING_CATEGORIES.map(
          (category) => (
            <Link
              key={category}
              href={`/rankings?category=${encodeURIComponent(
                category,
              )}`}
              className={`-mb-px border-b-2 pb-3 text-sm font-bold transition ${
                activeCategory ===
                category
                  ? "border-fuchsia-600 text-fuchsia-600"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              {category}
            </Link>
          ),
        )}
      </div>

      {artists.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-gray-100 px-6 py-16 text-center">
          <p className="font-bold text-gray-900">
            No artists in{" "}
            {activeCategory} yet.
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {artists.map((artist) => (
            <RankingArtistCard
              key={artist.id}
              artist={artist}
            />
          ))}
        </div>
      )}
    </>
  );
}
