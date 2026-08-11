import Link from "next/link";
import type { Creator } from "@/data/creators";

type CategoryFeaturedCreatorProps = {
  creator: Creator;
  categoryTitle: string;
};

export default function CategoryFeaturedCreator({
  creator,
  categoryTitle,
}: CategoryFeaturedCreatorProps) {
  return (
    <section className="py-12">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-fuchsia-600">
          Featured
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-tight text-gray-950">
          Featured {categoryTitle} Creator
        </h2>
      </div>

      <Link
        href={`/creator/${creator.id}`}
        className="group relative block h-[320px] overflow-hidden rounded-2xl bg-gray-950"
      >
        <img
          src={creator.image}
          alt={`${creator.name} featured work`}
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/10" />

        <div className="relative flex h-full items-end p-8 text-white md:p-10">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-300">
              {creator.category}
            </p>

            <h3 className="mt-2 text-4xl font-black tracking-tight">
              {creator.name}
            </h3>

            <p className="mt-4 max-w-lg text-base leading-7 text-white/75">
              {creator.description}
            </p>

            <div className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold text-gray-950 transition group-hover:bg-fuchsia-100">
              View Profile
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}