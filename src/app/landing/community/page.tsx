"use client";

import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";
import CommunitySection from "@/components/landing/CommunitySection";

/* /landing/community — standalone community page */
export default function CommunityPage() {
  return (
    <div
      className="relative w-full bg-black text-white"
      style={{ height: "100dvh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
    >
      <LandingNav activeSection="community" />
      <CommunitySection standalone />
      <LandingFooter />
    </div>
  );
}
