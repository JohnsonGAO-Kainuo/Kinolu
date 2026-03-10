"use client";

import { useRouter } from "next/navigation";
import { useI18n, LOCALE_LABELS, type Locale } from "@/lib/i18n";

export default function LandingFooter() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();

  return (
    <footer className="border-t border-white/[0.06] py-10 px-5">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-6">
        {/* Top row: logo + links */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo-icon-sm.png" alt="" width={20} height={20} />
            <span className="text-[11px] tracking-[3px] text-white/40 font-bold">KINOLU</span>
          </div>
          <div className="flex gap-6 text-[10px] tracking-[1.5px] text-white/30 uppercase">
            <button onClick={() => router.push("/landing/pricing")} className="cursor-pointer hover:text-white/60 transition-colors">
              {t("landing_nav_pricing")}
            </button>
            <button onClick={() => router.push("/privacy")} className="cursor-pointer hover:text-white/60 transition-colors">
              {t("sidebar_privacy")}
            </button>
            <button onClick={() => router.push("/terms")} className="cursor-pointer hover:text-white/60 transition-colors">
              {t("sidebar_terms")}
            </button>
            <button onClick={() => router.push("/feedback")} className="cursor-pointer hover:text-white/60 transition-colors">
              {t("sidebar_feedback")}
            </button>
          </div>
        </div>

        {/* Language switcher */}
        <div className="flex items-center gap-1.5">
          {LOCALE_LABELS.map((l) => (
            <button
              key={l.key}
              onClick={() => setLocale(l.key as Locale)}
              className={`cursor-pointer px-3 py-1.5 rounded-lg text-[10px] tracking-[0.5px] font-medium transition-all ${
                locale === l.key
                  ? "bg-white/10 text-white/80"
                  : "text-white/30 hover:text-white/50 hover:bg-white/[0.04]"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <p className="text-[10px] text-white/20">&copy; 2026 Kainuo Tech</p>
      </div>
    </footer>
  );
}
