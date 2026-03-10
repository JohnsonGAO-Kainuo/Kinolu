import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/landing", "/landing/", "/community", "/share/"],
        disallow: ["/auth/", "/profile", "/feedback", "/editor", "/camera", "/presets"],
      },
    ],
    sitemap: "https://kinolu.cam/sitemap.xml",
  };
}
