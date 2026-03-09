"use client";

import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";
import FeaturesSection from "@/components/landing/FeaturesSection";

/* /landing/features — standalone features page */
export default function FeaturesPage() {
  return (
    <div
      className="relative w-full bg-black text-white"
      style={{ height: "100dvh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
    >
      <LandingNav activeSection="features" />
      <FeaturesSection standalone />
      <LandingFooter />
    </div>
  );
}
