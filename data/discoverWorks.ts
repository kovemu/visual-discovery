export type DemoWork = {
  id: string;
  artistId: string;
  artistName: string;
  category: string;
  type: "image" | "youtube";
  image?: string;
  videoId?: string;
  caption: string | null;

  featured?: boolean;
  publishedAt?: string;
};

export const demoWorks: DemoWork[] = [
  // XLOV Featured Tracks
  {
    id: "xlov-featured-1",
    artistId: "xlov",
    artistName: "XLOV",
    category: "Music",
    type: "youtube",
    videoId: "bgblQb-XFFY",
    caption: "I'mma Be",
    featured: true,
    publishedAt: "2025-01-07",
  },
  {
    id: "xlov-featured-2",
    artistId: "xlov",
    artistName: "XLOV",
    category: "Music",
    type: "youtube",
    videoId: "NBZgirj_C2Y",
    caption: "1&Only",
    featured: true,
    publishedAt: "2025-06-13",
  },
   {
    id: "xlov-featured-3",
    artistId: "xlov",
    artistName: "XLOV",
    category: "Music",
    type: "youtube",
    videoId: "NCuFonpf-qk",
    caption: "Rizz",
    featured: true,
    publishedAt: "2025-11-05",
  },
  {
    id: "xlov-featured-4",
    artistId: "xlov",
    artistName: "XLOV",
    category: "Music",
    type: "youtube",
    videoId: "1IzZezTfwE0",
    caption: "SERVE",
    featured: true,
    publishedAt: "2026-05-27",
  },

  // XLOV Latest Works
  {
    id: "xlov-work-1",
    artistId: "xlov",
    artistName: "XLOV",
    category: "Music",
    type: "youtube",
    videoId: "3-0X8FUgWrw",
    caption: "Performance short from XLOV.",
    featured: false,
    publishedAt: "2026-01-27",
  },
  {
    id: "xlov-work-2",
    artistId: "xlov",
    artistName: "XLOV",
    category: "Music",
    type: "youtube",
    videoId: "XmmZyxOgXAI",
    caption: "Performance short from XLOV.",
    featured: false,
    publishedAt: "2026-06-27",
  },
  {
    id: "xlov-work-3",
    artistId: "xlov",
    artistName: "XLOV",
    category: "Music",
    type: "youtube",
    videoId: "YL7CXZf8-jA",
    caption: "Performance short from XLOV.",
    featured: false,
    publishedAt: "2026-07-27",
  },
  {
    id: "xlov-work-4",
    artistId: "xlov",
    artistName: "XLOV",
    category: "Music",
    type: "youtube",
    videoId: "tFMvkY5JSUo",
    caption: "Performance short from XLOV.",
    featured: false,
    publishedAt: "2026-07-17",
  },
  {
    id: "xlov-work-5",
    artistId: "xlov",
    artistName: "XLOV",
    category: "Music",
    type: "youtube",
    videoId: "C8pM7JvO9Ww",
    caption: "Performance short from XLOV.",
    featured: false,
    publishedAt: "2026-08-07",
  },
  // 앞으로 Discover에 보여줄 실제 작품만 여기에 추가
];