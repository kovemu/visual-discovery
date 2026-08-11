export type CategorySlug =
  | "music"
  | "dance"
  | "film"
  | "cosplay"
  | "art";

export type CategoryInfo = {
  slug: CategorySlug;
  title: string;
  description: string;
  image: string;
};

export const categories: CategoryInfo[] = [
  {
    slug: "music",
    title: "Music",
    description:
      "Discover emerging musicians, producers and independent sounds.",
    image:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1800&q=85",
  },
  {
    slug: "dance",
    title: "Dance",
    description:
      "Discover dancers, choreographers and performance creators.",
    image:
      "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1800&q=85",
  },
  {
    slug: "film",
    title: "Film",
    description:
      "Discover independent filmmakers and visual storytellers.",
    image:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1800&q=85",
  },
  {
    slug: "cosplay",
    title: "Cosplay",
    description:
      "Discover creators bringing characters and imaginary worlds to life.",
    image:
      "https://images.unsplash.com/photo-1608889175123-8ee362201f81?auto=format&fit=crop&w=1800&q=85",
  },
  {
    slug: "art",
    title: "Art",
    description:
      "Discover illustration, digital art, design and experimental visuals.",
    image:
      "https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=1800&q=85",
  },
];

export function getCategory(
  slug: string,
): CategoryInfo | undefined {
  return categories.find((category) => category.slug === slug);
}

export function isCategorySlug(
  slug: string,
): slug is CategorySlug {
  return categories.some((category) => category.slug === slug);
}