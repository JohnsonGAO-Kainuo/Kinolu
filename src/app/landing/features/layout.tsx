import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features — AI Color Transfer, Film Presets, Curves & HSL Editor",
  description:
    "Explore Kinolu's powerful features: AI-powered color transfer from any reference photo, 50+ film emulation presets (Fuji Portra, Kodak Ektar, Classic Chrome), professional curves editor, HSL panel, and batch processing.",
  keywords: [
    "AI color transfer feature", "film preset library", "curves editor",
    "HSL color panel", "batch photo grading", "Fuji Portra preset",
    "Kodak Ektar emulation", "Classic Chrome filter",
    "color matching algorithm", "reference photo color grade",
    "AI仿色功能", "胶片预设", "曲线编辑器", "HSL调色面板",
  ],
  alternates: { canonical: "https://kinolu.cam/landing/features" },
  openGraph: {
    title: "Features — Kinolu AI Color Grading",
    description: "AI color transfer, 50+ film presets, curves & HSL editor — professional tools for mobile photography.",
    url: "https://kinolu.cam/landing/features",
  },
};

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
