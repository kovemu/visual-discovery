const placeholders = [
  {
    className:
      "rounded-2xl border-2 border-fuchsia-300 bg-fuchsia-50/50",
    style: {
      left: "4%",
      top: "10%",
      width: "14%",
      height: "52%",
    },
  },
  {
    className:
      "rounded-2xl border-2 border-fuchsia-300 bg-white/70",
    style: {
      left: "21%",
      top: "8%",
      width: "28%",
      height: "34%",
    },
  },
  {
    className:
      "rounded-xl border border-fuchsia-200 bg-fuchsia-50",
    style: {
      left: "52%",
      top: "12%",
      width: "12%",
      height: "22%",
    },
  },
  {
    className:
      "rounded-2xl border border-purple-200 bg-purple-50/80",
    style: {
      right: "6%",
      top: "10%",
      width: "18%",
      height: "38%",
    },
  },
  {
    className:
      "rounded-xl border-2 border-fuchsia-300/80 bg-fuchsia-50/40",
    style: {
      left: "20%",
      top: "48%",
      width: "22%",
      height: "36%",
    },
  },
  {
    className:
      "rounded-2xl border border-fuchsia-200 bg-white/80",
    style: {
      left: "45%",
      top: "42%",
      width: "20%",
      height: "28%",
    },
  },
  {
    className:
      "rounded-xl border border-purple-200 bg-purple-50/60",
    style: {
      right: "28%",
      top: "54%",
      width: "14%",
      height: "30%",
    },
  },
  {
    className:
      "rounded-2xl border-2 border-fuchsia-300/70 bg-fuchsia-50/30",
    style: {
      right: "5%",
      top: "54%",
      width: "20%",
      height: "32%",
    },
  },
  {
    className:
      "rounded-lg border border-fuchsia-200 bg-fuchsia-50/70",
    style: {
      left: "8%",
      top: "68%",
      width: "10%",
      height: "18%",
    },
  },
] as const;

export default function MyKovemuPalette() {
  return (
    <div>
      <h2 className="text-xl font-black tracking-tight text-gray-950">
        My Palette
      </h2>

      <p className="mt-3 text-lg font-semibold text-gray-900">
        Create something from what you
        love.
      </p>

      <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
        Arrange your Picks into your own
        visual palette and share your
        taste with others.
      </p>

      <div className="relative mt-10 aspect-[16/9] w-full min-h-[220px] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 sm:min-h-[280px] lg:min-h-[360px]">
        {placeholders.map(
          (placeholder, index) => (
            <div
              key={index}
              className={`absolute ${placeholder.className}`}
              style={placeholder.style}
            />
          ),
        )}

        <div className="absolute inset-x-0 bottom-0 px-6 pb-6 pt-12 text-center">
          <p className="text-sm font-semibold text-fuchsia-500">
            Coming Soon
          </p>
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-gray-400">
        Your Picks. Your taste. Your
        palette.
      </p>
    </div>
  );
}
