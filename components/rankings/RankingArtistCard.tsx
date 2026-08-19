import Link from "next/link";

type RankingArtistCardProps = {
  artist: {
    rank: number;
    id: string;
    name: string;
    imageUrl: string | null;
  };
};

function getRankCardClassName(rank: number) {
  if (rank === 1) {
    return "border-2 border-fuchsia-400/80 bg-gradient-to-b from-fuchsia-50/50 to-white shadow-[0_0_20px_rgba(217,70,239,0.1)]";
  }

  if (rank === 2) {
    return "border border-gray-200 bg-white shadow-[0_6px_18px_rgba(148,163,184,0.08)]";
  }

  if (rank === 3) {
    return "border border-gray-200 bg-white shadow-[0_6px_18px_rgba(244,114,182,0.07)]";
  }

  return "border border-gray-200 bg-white";
}

function getRankLabelClassName(rank: number) {
  if (rank === 1) {
    return "text-fuchsia-600";
  }

  if (rank === 2) {
    return "text-slate-500";
  }

  if (rank === 3) {
    return "text-rose-400/90";
  }

  return "text-gray-400";
}

export default function RankingArtistCard({
  artist,
}: RankingArtistCardProps) {
  return (
    <Link
      href={`/creator/${artist.id}`}
      className={`group block rounded-2xl p-3 transition hover:-translate-y-1 ${getRankCardClassName(
        artist.rank,
      )}`}
    >
      <span
        className={`block text-2xl font-black tracking-tight ${getRankLabelClassName(
          artist.rank,
        )}`}
      >
        #{artist.rank}
      </span>

      <div className="relative mt-2 aspect-[4/5] overflow-hidden rounded-xl bg-gray-100">
        {artist.imageUrl ? (
          <img
            src={artist.imageUrl}
            alt={`${artist.name} profile`}
            draggable={false}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100">
            <span className="text-3xl font-black uppercase text-gray-300">
              {artist.name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      <h3 className="mt-2.5 line-clamp-2 text-base font-black tracking-tight text-gray-950 transition group-hover:text-fuchsia-600">
        {artist.name}
      </h3>
    </Link>
  );
}
