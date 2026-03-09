"use client";

import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";
import ShowcaseSection from "@/components/landing/ShowcaseSection";

/* /landing/showcase — standalone showcase/gallery page */
export default function ShowcasePage() {
  return (
    <div
      className="relative w-full bg-black text-white"
      style={{ height: "100dvh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
    >
      <LandingNav activeSection="showcase" />
      <ShowcaseSection standalone />
      <LandingFooter />
    </div>
  );
}
