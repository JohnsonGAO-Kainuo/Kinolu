"use client";

import { useRouter, usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { IconBack } from "@/components/icons";

/* ═══════════════════════════════════════════════════════════
   LandingNav — Shared navigation bar for landing & sub-pages
   ─────────────────────────────────────────────────────────
   On /landing:      nav links smooth-scroll to section anchors.
   On /landing/xxx:  nav links navigate to that sub-route.
   Logo click always goes back to /landing.
   ═══════════════════════════════════════════════════════════ */

const NAV_ITEMS = [
  { id: "features", href: "/landing/features" },
  { id: "showcase", href: "/landing/showcase" },
  { id: "how-it-works", href: "/landing/how-it-works" },
  { id: "community", href: "/landing/community" },
] as const;

interface LandingNavProps {
  /** Currently active section (intersection observer or current route) */
  activeSection?: string;
}

export default function LandingNav({ activeSection }: LandingNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const isMainLanding = pathname === "/landing";

  const labelMap: Record<string, string> = {
    features: t("landing_featuresLabel"),
    showcase: t("landing_galleryLabel"),
    "how-it-works": t("landing_howLabel"),
    community: t("community_title"),
  };

  const handleNavClick = (item: (typeof NAV_ITEMS)[number]) => {
    if (isMainLanding) {
      // Smooth-scroll to anchor on main page
      const el = document.getElementById(item.id);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else {
      // Navigate to independent sub-route
      router.push(item.href);
    }
  };

  return (
    <nav className="sticky top-0 z-50 safe-top bg-black/80 backdrop-blur-xl border-b border-white/[0.04]">
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
        {/* Left: Logo / Back */}
        <div className="flex items-center gap-2">
          {!isMainLanding ? (
            <button
              onClick={() => router.push("/landing")}
              className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors"
            >
              <IconBack size={18} />
              <span className="text-[10px] tracking-[2px] uppercase font-bold">KINOLU</span>
            </button>
          ) : (
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2">
              <img src="/logo-icon-sm.png" alt="Kinolu" width={28} height={28} className="w-7 h-7" />
              <span className="text-[13px] font-bold tracking-[4px] text-white/90">KINOLU</span>
            </button>
          )}
        </div>

        {/* Center: Desktop nav links */}
        <div className="hidden sm:flex items-center gap-6">
          {NAV_ITEMS.map((item) => {
            const isActive =
              (!isMainLanding && pathname === item.href) ||
              (isMainLanding && activeSection === item.id);
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={`text-[10px] tracking-[1.5px] uppercase transition-colors ${
                  isActive ? "text-white/80" : "text-white/35 hover:text-white/60"
                }`}
              >
                {labelMap[item.id]}
              </button>
            );
          })}
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/subscription")}
            className="hidden sm:block text-[10px] tracking-[1.5px] text-white/40 uppercase hover:text-white/70 transition-colors"
          >
            {t("landing_nav_pricing")}
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-[10px] tracking-[1.5px] text-white/50 border border-white/15 rounded-full px-3.5 py-1.5 hover:text-white/80 hover:border-white/30 transition-colors uppercase"
          >
            {t("share_openInApp")}
          </button>
        </div>
      </div>

      {/* Mobile nav — horizontal pill tabs */}
      <div className="sm:hidden flex gap-2 px-5 pb-2.5 overflow-x-auto no-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive =
            (!isMainLanding && pathname === item.href) ||
            (isMainLanding && activeSection === item.id);
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={`shrink-0 text-[9px] tracking-[1.5px] uppercase px-3 py-1.5 rounded-full border transition-colors ${
                isActive
                  ? "text-white/80 border-white/20 bg-white/[0.06]"
                  : "text-white/30 border-white/[0.06] hover:text-white/50"
              }`}
            >
              {labelMap[item.id]}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
