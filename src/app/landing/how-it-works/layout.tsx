import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works — 3 Steps to Cinematic Color Grading",
  description:
    "Three simple steps: pick a reference photo, let Kinolu's AI transfer its color grade to your image, then fine-tune with curves & HSL. Turn any phone photo into a cinematic masterpiece.",
  keywords: [
    "how to color grade photos", "photo color matching tutorial",
    "AI color transfer how it works", "reference photo color grading",
    "3 step photo editing", "easy film look",
    "如何调色", "AI调色教程", "参考图调色步骤", "一键胶片感",
  ],
  alternates: { canonical: "https://kinolu.cam/landing/how-it-works" },
  openGraph: {
    title: "How It Works — Kinolu",
    description: "3 simple steps to match any color grade from a reference photo.",
    url: "https://kinolu.cam/landing/how-it-works",
  },
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
