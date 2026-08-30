import type { MetadataRoute } from "next";

const BASE_URL = "https://kovemu.com";

export default function sitemap(): MetadataRoute.Sitemap {
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
