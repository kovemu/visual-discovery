import { createClient } from "@/lib/supabase/server";

export type DiscoverWork = {
  id: string;
  artistId: string;
  artistName: string;
  category: string;
  image: string;
  caption: string | null;
};

export async function getRealDiscoverCreators(): Promise<DiscoverWork[]> {
  const supabase = await createClient();

  const { data: creators, error: creatorError } = await supabase
    .from("creators")
    .select(`
      id,
      name,
      category
    `);

  if (creatorError || !creators) {
    return [];
  }

  const { data: posts, error: postError } = await supabase
    .from("posts")
    .select(`
      id,
      creator_id,
      image_url,
      caption,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (postError || !posts) {
    return [];
  }

  const creatorMap = new Map(
    creators.map((creator) => [
      creator.id,
      creator,
    ]),
  );

  const works: DiscoverWork[] = [];

  for (const post of posts) {
    const creator = creatorMap.get(post.creator_id);

    if (!creator) {
      continue;
    }

    works.push({
      id: post.id,
      artistId: creator.id,
      artistName: creator.name,

      category:
        creator.category.charAt(0).toUpperCase() +
        creator.category.slice(1),

      image: post.image_url,
      caption: post.caption,
    });
  }

  return works;
}