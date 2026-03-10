import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Photo Color Grading — Film Look, Cinematic Tones | Kinolu",
  description:
    "Transform phone photos into cinematic film with AI color transfer. Match any reference photo's color grade, apply Fuji & Kodak film presets, and edit with professional tools — free in your browser.",
  keywords: [
    "AI color grading app", "photo color transfer", "film look photo editor",
    "cinematic photo filter", "reference photo color match",
    "Fuji film preset", "Kodak film emulation", "analog film look",
    "mobile film photography", "phone cinematic photo",
    "AI调色", "胶片感", "电影感调色", "手机拍出胶片感",
    "一键追色", "仿色", "色彩迁移", "参考图调色",
  ],
  alternates: { canonical: "https://kinolu.cam/landing" },
  openGraph: {
    title: "Kinolu — AI Photo Color Grading & Film Emulation",
    description:
      "Match any color grade from a reference photo. 50+ film presets, professional editing tools — all in your browser. No download needed.",
    url: "https://kinolu.cam/landing",
    images: [{ url: "/heroes/editor.jpg", width: 1200, height: 630, alt: "Kinolu — AI Photo Color Grading" }],
  },
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
