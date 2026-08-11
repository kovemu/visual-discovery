import CreatorSection from "@/components/CreatorSection";
import FeaturedCreator from "@/components/FeaturedCreator";
import Header from "@/components/Header";

import { categoryCreators } from "@/data/categoryCreators";
const discoverPicks = categoryCreators.slice(0, 8);

const weeklyRanking = categoryCreators
  .slice(0, 8)
  .map((creator, index) => ({
    ...creator,
    rank: index + 1,
  }));

const hiddenGems = categoryCreators
  .filter((creator) => creator.followers < 10000)
  .slice(0, 8);

const newCreators = [...categoryCreators]
  .reverse()
  .slice(0, 8);

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Header />

      <FeaturedCreator />
      
      
      

      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div id="discover">
         <CreatorSection
           title="Discover Picks"
           subtitle="Handpicked creators worth discovering on Kovemu."
           creators={discoverPicks}
          />
        </div>

        <div id="ranking" className="border-y border-gray-100">
          <CreatorSection
            title="Weekly Ranking"
            subtitle="The most discovered Korean creators this week."
            creators={weeklyRanking}
          />
        </div>

        <div id="categories">
          <CreatorSection
            title="Hidden Gems"
            subtitle="Discover them before everyone else does."
            creators={hiddenGems}
          />
        </div>

        <div id="new" className="border-t border-gray-100">
          <CreatorSection
            title="New on Kovemu"
            subtitle="Recently added creators and independent artists."
            creators={newCreators}
          />
        </div>
      </div>

      <footer className="mt-8 border-t border-gray-200 px-6 py-10 lg:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-sm text-gray-500">
          <p>© 2026 Kovemu</p>
          <p>Discover Korean Creators</p>
        </div>
      </footer>
    </main>
  );
}