import type { MetadataRoute } from "next";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const BASE_URL = "https://kovemu.com";

function getStaticSitemapEntries(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: BASE_URL,
      lastModified,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified,
    },
  ];
}

function createPublicSupabaseClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createSupabaseClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

async function getCreatorSitemapEntries(): Promise<
  MetadataRoute.Sitemap
> {
  const supabase =
    createPublicSupabaseClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("creators")
    .select("id");

  if (error || !data) {
    console.error("SITEMAP CREATOR QUERY ERROR:", error);
    return [];
  }

  const lastModified = new Date();

  return data
    .filter(
      (creator): creator is { id: string } =>
        typeof creator.id === "string" &&
        creator.id.length > 0,
    )
    .map((creator) => ({
      url: `${BASE_URL}/creator/${creator.id}`,
      lastModified,
    }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries =
    getStaticSitemapEntries();

  try {
    const creatorEntries =
      await getCreatorSitemapEntries();

    return [
      ...staticEntries,
      ...creatorEntries,
    ];
  } catch (error) {
    console.error("SITEMAP GENERATION ERROR:", error);
    return staticEntries;
  }
}
