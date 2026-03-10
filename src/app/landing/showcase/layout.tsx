import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Showcase — Before & After Color Grading Examples",
  description:
    "See stunning before & after examples of AI color transfer. Watch how Kinolu transforms ordinary phone photos into cinematic film looks with one reference photo.",
  keywords: [
    "color grading before after", "photo color transfer example",
    "film look transformation", "cinematic photo example",
    "AI color grading result", "phone photo to film look",
    "调色前后对比", "AI调色效果", "胶片感照片示例", "手机电影感效果",
  ],
  alternates: { canonical: "https://kinolu.cam/landing/showcase" },
  openGraph: {
    title: "Showcase — Kinolu Color Grading Examples",
    description: "Before & after examples of AI color transfer — transform phone photos into cinematic film.",
    url: "https://kinolu.cam/landing/showcase",
    images: [{ url: "/showcase/result.png", width: 1200, height: 630, alt: "Kinolu Color Grading Before & After" }],
  },
};

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
