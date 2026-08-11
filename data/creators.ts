export type CreatorPlatform = {
  name: string;
  url: string;
};

export type CreatorSupport = {
  name: string;
  url: string;
};

export type CreatorWork = {
  id: string;
  title: string;
  image: string;
  type: "image" | "video";
  url?: string;
};

export type Creator = {
  // 기존 화면에서 사용 중인 필수 필드
  id: string;
  name: string;
  category: string;
  description: string;
  image: string;
  platforms: string[];
  tags: string[];
  followers: number;

  badge?: string;
  rank?: number;

  // 실제 서비스 확장을 위한 필드
  username?: string;

  avatar?: string;
  banner?: string;
  thumbnail?: string;

  country?: string;
  city?: string;
  languages?: string[];

  joinedAt?: string;

  verified?: boolean;
  featured?: boolean;

  likes?: number;
  views?: number;

  platformLinks?: CreatorPlatform[];
  supportLinks?: CreatorSupport[];
  works?: CreatorWork[];

  discoveryScore?: number;
};

export const featuredCreator: Creator = {
  id: "mina-studio",
  name: "Mina Studio",
  category: "Digital Art",
  description:
    "Korean folklore reimagined through futuristic digital art and vivid contemporary worlds.",
  image:
    "https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=1800&q=85",
  platforms: ["Instagram", "YouTube"],
  tags: ["Korean Folklore", "Cyberpunk", "Illustration"],
  followers: 128000,
  badge: "Weekly Spotlight",
};

export const trendingCreators: Creator[] = [
  {
    id: "mina-studio",
    name: "Mina Studio",
    category: "Digital Art",
    description:
      "Korean mythology transformed into futuristic visual worlds.",
    image:
      "https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=700&q=80",
    platforms: ["Instagram", "YouTube"],
    tags: ["Digital Art", "Korean Folklore", "Cyberpunk"],
    followers: 128000,
    badge: "Rising",
  },
  {
    id: "joon-films",
    name: "Joon Films",
    category: "Filmmaking",
    description:
      "Cinematic short stories capturing Seoul after midnight.",
    image:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=700&q=80",
    platforms: ["YouTube", "Vimeo"],
    tags: ["Short Film", "Seoul", "Cinema"],
    followers: 89000,
    badge: "Trending",
  },
  {
    id: "haru-sound",
    name: "Haru Sound",
    category: "Music",
    description:
      "Dreamy electronic sounds inspired by modern Korean city life.",
    image:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=700&q=80",
    platforms: ["YouTube", "Spotify"],
    tags: ["Electronic", "Producer", "Seoul"],
    followers: 76000,
  },
  {
    id: "dami-draws",
    name: "Dami Draws",
    category: "Illustration",
    description:
      "Colorful characters and small moments from everyday life.",
    image:
      "https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=700&q=80",
    platforms: ["Instagram", "X"],
    tags: ["Illustration", "Characters", "Lifestyle"],
    followers: 64000,
  },
  {
    id: "dami-draw5s",
    name: "Dami Draw5s",
    category: "Illustration",
    description:
      "Colorful characters and small moments from everyday life.",
    image:
      "https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=700&q=80",
    platforms: ["Instagram", "X"],
    tags: ["Illustration", "Characters", "Lifestyle"],
    followers: 64000,
  },
  {
    id: "dami-draw2s",
    name: "Dami Draw2s",
    category: "Illustration",
    description:
      "Colorful characters and small moments from everyday life.",
    image:
      "https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=700&q=80",
    platforms: ["Instagram", "X"],
    tags: ["Illustration", "Characters", "Lifestyle"],
    followers: 64000,
  },
  {
    id: "seoul-frame",
    name: "Seoul Frame",
    category: "Photography",
    description:
      "Street photography exploring light, people and architecture.",
    image:
      "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=700&q=80",
    platforms: ["Instagram", "YouTube"],
    tags: ["Photography", "Street", "Architecture"],
    followers: 52000,
  },
  {
    id: "sed-frame",
    name: "luna Frame",
    category: "Photography",
    description:
      "Street photography exploring light, people and architecture.",
    image:
      "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=700&q=80",
    platforms: ["Instagram", "YouTube"],
    tags: ["Photography", "Street", "Architecture"],
    followers: 52000,
  },  
];

export const weeklyRanking: Creator[] = trendingCreators.map(
  (creator, index) => ({
    ...creator,
    rank: index + 1,
    badge: index === 0 ? "No. 1" : undefined,
  }),
);

export const hiddenGems: Creator[] = [
  {
    id: "nabi-works",
    name: "Nabi Works",
    category: "Animation",
    description:
      "Independent animated stories inspired by Korean folklore.",
    image:
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=700&q=80",
    platforms: ["YouTube", "Instagram"],
    tags: ["Animation", "Folklore", "Indie"],
    followers: 9200,
    badge: "Hidden Gem",
  },
  {
    id: "mori-craft",
    name: "Mori Craft",
    category: "Craft",
    description:
      "Traditional materials reshaped through contemporary design.",
    image:
      "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=700&q=80",
    platforms: ["Instagram", "YouTube"],
    tags: ["Craft", "Traditional", "Design"],
    followers: 7800,
  },
  {
    id: "blue-han",
    name: "Blue Han",
    category: "Music",
    description:
      "An emerging songwriter creating intimate acoustic sessions.",
    image:
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=700&q=80",
    platforms: ["YouTube", "Spotify"],
    tags: ["Acoustic", "Singer-songwriter", "Indie"],
    followers: 6400,
  },
  {
    id: "studio-dal",
    name: "Studio Dal",
    category: "Webcomic",
    description:
      "Quiet stories about relationships, cities and ordinary life.",
    image:
      "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?auto=format&fit=crop&w=700&q=80",
    platforms: ["Instagram", "X"],
    tags: ["Webcomic", "Drama", "Slice of Life"],
    followers: 5100,
  },
  {
    id: "kite-lab",
    name: "Kite Lab",
    category: "Design",
    description:
      "Experimental graphics inspired by Korean typography.",
    image:
      "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=700&q=80",
    platforms: ["Instagram", "Behance"],
    tags: ["Graphic Design", "Typography", "Experimental"],
    followers: 4800,
  },
  {
    id: "kitdce-lab2",
    name: "Kite Lab2",
    category: "Design",
    description:
      "Experimental graphics inspired by Korean typography.",
    image:
      "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=700&q=80",
    platforms: ["Instagram", "Behance"],
    tags: ["Graphic Design", "Typography", "Experimental"],
    followers: 4800,
  },  
   {
    id: "kitdce-lab3",
    name: "Kite Lab3",
    category: "Design",
    description:
      "Experimental graphics inspired by Korean typography.",
    image:
      "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=700&q=80",
    platforms: ["Instagram", "Behance"],
    tags: ["Graphic Design", "Typography", "Experimental"],
    followers: 4800,
  },  
   {
    id: "kitdce-lab4",
    name: "Kite Lab4",
    category: "Design",
    description:
      "Experimental graphics inspired by Korean typography.",
    image:
      "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=700&q=80",
    platforms: ["Instagram", "Behance"],
    tags: ["Graphic Design", "Typography", "Experimental"],
    followers: 4800,
  },  
];

export const newCreators: Creator[] = [
  {
    id: "sora-archive",
    name: "Sora Archive",
    category: "Fashion",
    description:
      "Contemporary styling influenced by Seoul street culture.",
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=700&q=80",
    platforms: ["Instagram", "TikTok"],
    tags: ["Fashion", "Seoul", "Streetwear"],
    followers: 3400,
    badge: "New",
  },
  {
    id: "room-27",
    name: "Room 27",
    category: "Interior",
    description:
      "Small Korean spaces redesigned with warmth and personality.",
    image:
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=700&q=80",
    platforms: ["Instagram", "YouTube"],
    tags: ["Interior", "Lifestyle", "Home"],
    followers: 2800,
    badge: "New",
  },
  {
    id: "nomad-table",
    name: "Nomad Table",
    category: "Food",
    description:
      "Local recipes and overlooked food stories from across Korea.",
    image:
      "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=700&q=80",
    platforms: ["YouTube", "Instagram"],
    tags: ["Food", "Recipe", "Travel"],
    followers: 2100,
    badge: "New",
  },
  {
    id: "mono-seoul",
    name: "Mono Seoul",
    category: "Photography",
    description:
      "Minimal city photography shaped by silence and geometry.",
    image:
      "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=700&q=80",
    platforms: ["Instagram"],
    tags: ["Photography", "Minimal", "City"],
    followers: 1700,
    badge: "New",
  },
  {
    id: "goblin-lab",
    name: "Goblin Lab",
    category: "Game Art",
    description:
      "Korean monsters and legends redesigned for modern games.",
    image:
      "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=700&q=80",
    platforms: ["ArtStation", "X"],
    tags: ["Game Art", "Monster", "Folklore"],
    followers: 1300,
    badge: "New",
  },
];
export const allCreators: Creator[] = [
  ...trendingCreators,
  ...hiddenGems,
  ...newCreators,
];

export function getCreatorById(id: string) {
  return allCreators.find((creator) => creator.id === id);
}
export function getCreatorsByCategory(slug: string): Creator[] {
  const categoryGroups: Record<string, string[]> = {
    music: [
      "music",
    ],

    dance: [
      "dance",
      "choreography",
      "performance",
    ],

    film: [
      "film",
      "filmmaking",
      "animation",
      "photography",
    ],

    cosplay: [
      "cosplay",
      "costume",
    ],

    art: [
      "art",
      "digital art",
      "illustration",
      "design",
      "craft",
      "webcomic",
      "game art",
    ],
  };

  const acceptedTerms = categoryGroups[slug];

  if (!acceptedTerms) {
    return [];
  }

  return allCreators.filter((creator) => {
    const searchableValues = [
      creator.category,
      ...creator.tags,
    ].map((value) => value.toLowerCase());

    return acceptedTerms.some((term) =>
      searchableValues.some(
        (value) =>
          value === term ||
          value.includes(term),
      ),
    );
  });
}