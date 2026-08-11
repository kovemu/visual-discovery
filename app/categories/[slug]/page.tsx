import CreatorCard from "@/components/CreatorCard";
import CreatorSection from "@/components/CreatorSection";
import Header from "@/components/Header";
import {
  categories,
  getCategory,
} from "@/data/categories";
import { getCategoryDemoCreators } from "@/data/categoryCreators";
import { notFound } from "next/navigation";

type CategoryPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return categories.map((category) => ({
    slug: category.slug,
  }));
}

export default async function CategoryPage({
  params,
}: CategoryPageProps) {
  const { slug } = await params;

  const category = getCategory(slug);

  if (!category) {
    notFound();
  }

  const creators = getCategoryDemoCreators(slug);

  const trendingCreators = creators.slice(0, 8);
  const newCreators = [...creators].reverse().slice(0, 8);
  const hiddenGems = creators
    .filter((creator) => creator.followers < 10000)
    .slice(0, 8);

  return (
    <main className="min-h-screen bg-white">
      <Header />

     <section className="mx-auto max-w-7xl px-6 pb-4 pt-8 lg:px-10">
  <p className="text-xs font-bold uppercase tracking-[0.28em] text-fuchsia-600">
    Category
  </p>

      <h1 className="mt-1 text-4xl font-black tracking-tight text-gray-950">
        {category.title}
       </h1>
      </section>

      <div className="mx-auto max-w-7xl px-6 pb-20 lg:px-10">
      

        {trendingCreators.length > 0 && (
          <div className="border-t border-gray-100">
            <CreatorSection
              title={`Trending in ${category.title}`}
              subtitle={`Creators gaining attention across ${category.title.toLowerCase()}.`}
              creators={trendingCreators}
            />
          </div>
        )}

        {newCreators.length > 0 && (
          <div className="border-t border-gray-100">
            <CreatorSection
              title={`New in ${category.title}`}
              subtitle="Recently added creators worth discovering."
              creators={newCreators}
            />
          </div>
        )}

        {hiddenGems.length > 0 && (
          <div className="border-t border-gray-100">
            <CreatorSection
              title="Hidden Gems"
              subtitle="Promising talent still waiting to be discovered."
              creators={hiddenGems}
            />
          </div>
        )}

        {creators.length > 0 ? (
          <section className="border-t border-gray-100 py-12">
            <div className="mb-7">
              <h2 className="text-3xl font-black tracking-tight text-gray-950">
                All {category.title} Creators
              </h2>

              <p className="mt-2 text-gray-500">
                Explore every creator currently listed in this category.
              </p>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-10">
              {creators.map((creator) => (
                <CreatorCard
                  key={creator.id}
                  {...creator}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="py-24 text-center">
            <h2 className="text-2xl font-black text-gray-950">
              Creators are coming soon
            </h2>

            <p className="mt-3 text-gray-500">
              We are preparing new talent for this category.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}