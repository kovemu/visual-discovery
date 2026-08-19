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

export const demoWorks: DemoWork[] = [];