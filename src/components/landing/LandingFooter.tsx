"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

export default function LandingFooter() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <footer className="border-t border-white/[0.06] py-10 px-5">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img src="/logo-icon-sm.png" alt="" width={20} height={20} />
          <span className="text-[11px] tracking-[3px] text-white/40 font-bold">KINOLU</span>
        </div>
        <div className="flex gap-6 text-[10px] tracking-[1.5px] text-white/30 uppercase">
          <button onClick={() => router.push("/subscription")} className="hover:text-white/60 transition-colors">
            {t("landing_nav_pricing")}
          </button>
          <button onClick={() => router.push("/privacy")} className="hover:text-white/60 transition-colors">
            {t("sidebar_privacy")}
          </button>
          <button onClick={() => router.push("/terms")} className="hover:text-white/60 transition-colors">
            {t("sidebar_terms")}
          </button>
          <button onClick={() => router.push("/feedback")} className="hover:text-white/60 transition-colors">
            {t("sidebar_feedback")}
          </button>
        </div>
        <p className="text-[10px] text-white/20">&copy; 2026 Kainuo Tech</p>
      </div>
    </footer>
  );
}
