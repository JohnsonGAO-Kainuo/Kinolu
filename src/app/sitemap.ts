import type { MetadataRoute } from "next";

const BASE = "https://kinolu.cam";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    /* ── Main entry ── */
    { url: BASE, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },

    /* ── Landing & sub-pages (highest SEO value) ── */
    { url: `${BASE}/landing`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.95 },
    { url: `${BASE}/landing/features`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/landing/showcase`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/landing/how-it-works`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.80 },
    { url: `${BASE}/landing/community`, lastModified: new Date(), changeFrequency: "daily", priority: 0.80 },
    { url: `${BASE}/landing/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.85 },

    /* ── App pages ── */
    { url: `${BASE}/editor`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/camera`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/presets`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/community`, lastModified: new Date(), changeFrequency: "daily", priority: 0.70 },

    /* ── Subscription ── */
    { url: `${BASE}/subscription`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.65 },

    /* ── Legal ── */
    { url: `${BASE}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
  ];
}
