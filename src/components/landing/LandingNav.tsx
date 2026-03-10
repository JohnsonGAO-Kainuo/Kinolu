"use client";

import { useRouter, usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { IconBack } from "@/components/icons";
import { useAuth } from "@/components/AuthProvider";

/* ═══════════════════════════════════════════════════════════
   LandingNav — Shared navigation bar for landing & sub-pages
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
  const { user, profile } = useAuth();
  const isMainLanding = pathname === "/landing";

  const labelMap: Record<string, string> = {
    features: t("landing_featuresLabel"),
    showcase: t("landing_galleryLabel"),
    "how-it-works": t("landing_howLabel"),
    community: t("community_title"),
  };

  const handleNavClick = (item: (typeof NAV_ITEMS)[number]) => {
    router.push(item.href);
  };

  /* User initial for avatar circle */
  const userInitial = profile?.display_name?.charAt(0)?.toUpperCase()
    || user?.email?.charAt(0)?.toUpperCase()
    || null;

  return (
    <nav className="sticky top-0 z-50 safe-top bg-black/80 backdrop-blur-xl border-b border-white/[0.04]">
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
        {/* Left: Logo / Back */}
        <div className="flex items-center gap-2">
          {!isMainLanding ? (
            <button
              onClick={() => router.push("/landing")}
              className="cursor-pointer flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors"
            >
              <IconBack size={18} />
              <span className="text-[10px] tracking-[2px] uppercase font-bold">KINOLU</span>
            </button>
          ) : (
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="cursor-pointer flex items-center gap-2"
            >
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
                className={`cursor-pointer text-[10px] tracking-[1.5px] uppercase transition-all duration-200 py-1 border-b-2 ${
                  isActive
                    ? "text-white/90 border-white/60"
                    : "text-white/35 border-transparent hover:text-white/70 hover:border-white/20"
                }`}
              >
                {labelMap[item.id]}
              </button>
            );
          })}
        </div>

        {/* Right: Pricing + User avatar or Sign In */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/landing/pricing")}
            className="hidden sm:block cursor-pointer text-[10px] tracking-[1.5px] text-white/40 uppercase hover:text-white/70 transition-colors"
          >
            {t("landing_nav_pricing")}
          </button>

          {user ? (
            /* Logged in: avatar circle → goes to profile */
            <button
              onClick={() => router.push("/profile")}
              className="cursor-pointer w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-[11px] font-bold text-white/70 hover:bg-white/20 hover:border-white/30 transition-all"
              title={profile?.display_name || user.email || ""}
            >
              {userInitial || "U"}
            </button>
          ) : (
            /* Not logged in: Sign In button */
            <button
              onClick={() => router.push("/auth/login")}
              className="cursor-pointer text-[10px] tracking-[1.5px] text-white/50 border border-white/15 rounded-full px-3.5 py-1.5 hover:text-white/80 hover:border-white/30 transition-colors uppercase"
            >
              {t("auth_signIn")}
            </button>
          )}
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
              className={`cursor-pointer shrink-0 text-[9px] tracking-[1.5px] uppercase px-3 py-1.5 rounded-full border transition-all duration-200 ${
                isActive
                  ? "text-white/80 border-white/20 bg-white/[0.06]"
                  : "text-white/30 border-white/[0.06] hover:text-white/50 hover:border-white/15"
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
