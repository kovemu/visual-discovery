export default function Hero() {
  return (
    <section className="bg-fuchsia-50/60">
      <div className="mx-auto flex max-w-7xl flex-col items-center px-6 py-24 text-center lg:px-10 lg:py-32">
        <p className="mb-5 rounded-full border border-fuchsia-200 bg-white px-4 py-2 text-sm font-semibold text-fuchsia-700">
          Discover creators from South Korea
        </p>

        <h1 className="max-w-4xl text-5xl font-bold leading-tight tracking-tight text-gray-950 md:text-7xl">
          Discover your next
          <span className="block text-fuchsia-600">
            favorite Korean creator
          </span>
        </h1>

        <p className="mt-7 max-w-2xl text-lg leading-8 text-gray-600">
          Explore artists, filmmakers, musicians, streamers and independent
          creators worth knowing.
        </p>

        <div className="mt-10 flex w-full max-w-2xl overflow-hidden rounded-full border border-gray-200 bg-white shadow-sm">
          <input
            type="search"
            aria-label="Search creators"
            placeholder="Search creators, categories or styles"
            className="h-16 min-w-0 flex-1 bg-transparent px-7 text-gray-900 outline-none placeholder:text-gray-400"
          />

          <button className="m-1.5 rounded-full bg-fuchsia-600 px-8 font-semibold text-white transition hover:bg-fuchsia-700">
            Search
          </button>
        </div>

        <a
          href="#featured"
          className="mt-8 text-sm font-semibold text-gray-700 transition hover:text-fuchsia-600"
        >
          Explore today&apos;s featured creator ↓
        </a>
      </div>
    </section>
  );
}