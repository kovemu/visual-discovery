import type { MetadataRoute } from "next";

import {
  CHEERLEADER_LANDING_URLS,
} from "@/lib/seo/cheerleaderLanding";

const BASE_URL = "https://kovemu.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: BASE_URL,
      lastModified,
    },
    {
      url: CHEERLEADER_LANDING_URLS.ko,
      lastModified,
    },
    {
      url: CHEERLEADER_LANDING_URLS.zhTw,
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
