import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community — Share Your Film & Cinematic Color Grades",
  description:
    "Join the Kinolu community. Share your color-graded photos, discuss film emulation techniques, get inspired by other creators' cinematic edits, and discover new reference photos.",
  keywords: [
    "color grading community", "photo editing community",
    "share color grade", "film photography forum",
    "cinematic photo sharing", "color grading inspiration",
    "调色社区", "胶片摄影交流", "作品分享", "调色灵感",
  ],
  alternates: { canonical: "https://kinolu.cam/landing/community" },
  openGraph: {
    title: "Community — Kinolu",
    description: "Share color-graded photos, discuss techniques, and get inspired by fellow creators.",
    url: "https://kinolu.cam/landing/community",
  },
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
