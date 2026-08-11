import { categoryCreators } from "@/data/categoryCreators";

export type DemoWork = {
  id: string;
  artistId: string;
  artistName: string;
  category: string;
  image: string;
  caption: string | null;
};

export const demoWorks: DemoWork[] =
  categoryCreators.map((artist) => ({
    id: `demo-work-${artist.id}`,
    artistId: artist.id,
    artistName: artist.name,
    category: artist.category,
    image: artist.image,
    caption: artist.description ?? null,
  }));