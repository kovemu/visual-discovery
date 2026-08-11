import type { Creator } from "@/data/creators";
import Link from "next/link";

export default function CreatorCard({
  id,
  name,
  category,
  description,
  image,
  badge,
  rank,
  followers,
}: Creator) {
  const formattedFollowers =
    followers >= 1000000
      ? `${(followers / 1000000).toFixed(1)}M`
      : followers >= 1000
        ? `${(followers / 1000).toFixed(1)}K`
        : followers.toString();

  return (
    <Link
  href={`/creator/${id}`}
  className="group block w-[220px] shrink-0 transition-transform duration-300 hover:-translate-y-4"
>
  <article className="rounded-xl transition-shadow duration-300 group-hover:shadow-xl"></article>
      <article className="rounded-xl transition-shadow duration-300 group-hover:shadow-xl">
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-gray-200">
          <img
            src={image}
            alt={`${name} representative work`}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

          {badge && (
            <span className="absolute left-3 top-3 rounded-full bg-black/80 px-3 py-1 text-xs font-bold text-white">
              {badge}
            </span>
          )}

          {rank && (
            <span className="absolute bottom-2 left-3 text-6xl font-black leading-none text-white drop-shadow-lg">
              {rank}
            </span>
          )}

          <div
            className={`absolute bottom-0 left-0 right-0 p-4 text-white ${
              rank ? "pl-16" : ""
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
              {category}
            </p>

           <h3 className="text-lg font-bold transition-colors duration-300 group-hover:text-fuchsia-300">
               {name}
            </h3>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-xs font-semibold text-fuchsia-600">
              {category}
            </p>

            
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-5 text-gray-600">
            {description}
          </p>

        </div>
      </article>
    </Link>
  );
}