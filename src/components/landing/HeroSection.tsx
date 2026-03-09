"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

export default function HeroSection() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <section className="relative w-full flex flex-col items-center justify-center px-6 text-center" style={{ minHeight: "calc(100dvh - 56px)" }}>
      <div
        className="absolute inset-0 bg-cover bg-center opacity-35"
        style={{ backgroundImage: "url(/heroes/editor.jpg)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black" />
      <div className="relative z-10 max-w-2xl">
        <h1 className="text-[32px] sm:text-[48px] md:text-[64px] font-black tracking-[4px] sm:tracking-[6px] leading-[1.1] uppercase">
          {t("landing_heroTitle")}
        </h1>
        <p className="mt-5 text-[14px] md:text-[16px] text-white/55 tracking-wide leading-relaxed max-w-md mx-auto">
          {t("landing_heroDesc")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-10 justify-center">
          <button
            onClick={() => router.push("/")}
            className="px-10 py-3.5 bg-white text-black text-[12px] font-bold tracking-[3px] rounded-full uppercase hover:bg-white/90 transition-colors"
          >
            {t("landing_ctaTry")}
          </button>
          <button
            onClick={() => {
              const el = document.getElementById("features");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="px-8 py-3.5 border border-white/20 text-[12px] font-bold tracking-[3px] rounded-full uppercase text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
          >
            {t("landing_ctaLearnMore")}
          </button>
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/25">
          <path d="M7 13l5 5 5-5M7 7l5 5 5-5" />
        </svg>
      </div>
    </section>
  );
}
