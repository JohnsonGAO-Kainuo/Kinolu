import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Free & Pro Plans for AI Color Grading",
  description:
    "Kinolu is free to use with 3 AI color transfers per day. Upgrade to Pro for unlimited transfers, all 50+ film presets, batch processing, and priority support. Plans from $2.99/month.",
  keywords: [
    "photo editor pricing", "color grading app price",
    "free photo editor", "pro photo editing plan",
    "AI color grading subscription", "film preset subscription",
    "调色app价格", "免费调色工具", "Pro订阅", "专业调色方案",
  ],
  alternates: { canonical: "https://kinolu.cam/landing/pricing" },
  openGraph: {
    title: "Pricing — Kinolu Pro",
    description: "Free tier with 3 daily transfers. Pro from $2.99/mo for unlimited AI color grading & 50+ film presets.",
    url: "https://kinolu.cam/landing/pricing",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
