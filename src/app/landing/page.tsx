"use client";

import { useEffect, useRef, useState } from "react";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import ShowcaseSection from "@/components/landing/ShowcaseSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import CommunitySection from "@/components/landing/CommunitySection";
import CtaSection from "@/components/landing/CtaSection";

/* ═══════════════════════════════════════════════════════════
   /landing — Main landing page
   ─────────────────────────────────────────────────────────
   Composes ALL sections into a single scrollable page.
   Nav items smooth-scroll to corresponding sections.
   Each section also exists as a standalone route:
     /landing/features, /landing/showcase, etc.
   ═══════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const [activeSection, setActiveSection] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── IntersectionObserver for active nav highlighting ── */
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const sections = root.querySelectorAll("section[id]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { root, rootMargin: "-30% 0px -70% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  /* ── Handle hash on mount (e.g. /landing#community) ── */
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      requestAnimationFrame(() => {
        const el = document.getElementById(hash);
        el?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, []);

  return (
    <div
      ref={scrollRef}
      className="relative w-full bg-black text-white"
      style={{ height: "100dvh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
    >
      <LandingNav activeSection={activeSection} />
      <HeroSection />

      {/* ── Divider: thin line between hero and content ── */}
      <div className="w-full border-t border-white/[0.04]" />

      <FeaturesSection />
      <ShowcaseSection />
      <HowItWorksSection />
      <CommunitySection />
      <CtaSection />
      <LandingFooter />
    </div>
  );
}
