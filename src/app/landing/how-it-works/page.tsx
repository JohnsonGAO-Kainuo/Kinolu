"use client";

import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";
import HowItWorksSection from "@/components/landing/HowItWorksSection";

/* /landing/how-it-works — standalone how-it-works page */
export default function HowItWorksPage() {
  return (
    <div
      className="relative w-full bg-black text-white"
      style={{ height: "100dvh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
    >
      <LandingNav activeSection="how-it-works" />
      <HowItWorksSection standalone />
      <LandingFooter />
    </div>
  );
}
