"use client";

import { useI18n } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════
   ShowcaseSection — Color Transfer demo + Film presets mention
   Three photos: Original → Reference → Result
   ═══════════════════════════════════════════════════════════ */

/* SVG arrow component — right on desktop, down on mobile */
function FlowArrow() {
  return (
    <div className="flex items-center justify-center shrink-0">
      {/* Desktop: horizontal arrow */}
      <svg className="hidden md:block w-10 h-10 text-white/20" viewBox="0 0 40 40" fill="none">
        <path d="M8 20h20M22 14l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* Mobile: vertical arrow */}
      <svg className="md:hidden w-8 h-8 text-white/20" viewBox="0 0 32 32" fill="none">
        <path d="M16 6v16M10 18l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

interface ShowcaseSectionProps {
  standalone?: boolean;
}

export default function ShowcaseSection({ standalone }: ShowcaseSectionProps) {
  const { t } = useI18n();

  return (
    <section id="showcase" className={`max-w-6xl mx-auto px-5 scroll-mt-20 ${standalone ? "py-28" : "py-20"}`}>
      {/* Header */}
      <h2 className="text-[10px] tracking-[4px] text-white/30 uppercase text-center mb-2">
        {t("landing_galleryLabel")}
      </h2>
      <h3 className="text-[24px] md:text-[36px] font-bold tracking-[2px] text-center mb-4">
        {t("landing_galleryTitle")}
      </h3>
      <p className="text-[13px] text-white/40 text-center mb-12 max-w-lg mx-auto">
        {t("landing_showcaseSubtitle")}
      </p>

      {/* ── Color Transfer Flow: Original → Reference → Result ── */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3">
        {/* Original */}
        <div className="flex-1 max-w-sm w-full group">
          <div className="rounded-2xl overflow-hidden aspect-[4/3] bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all relative">
            <img
              src="/showcase/original.jpg"
              alt={t("landing_showcase_original")}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <span className="inline-block px-2.5 py-1 bg-white/10 backdrop-blur-sm rounded-lg text-[10px] font-bold tracking-[2px] text-white/90 uppercase">
                {t("landing_showcase_original")}
              </span>
            </div>
          </div>
        </div>

        <FlowArrow />

        {/* Reference */}
        <div className="flex-1 max-w-sm w-full group">
          <div className="rounded-2xl overflow-hidden aspect-[4/3] bg-white/[0.03] border border-dashed border-white/[0.12] hover:border-white/[0.20] transition-all relative">
            <img
              src="/showcase/reference.jpg"
              alt={t("landing_showcase_reference")}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <span className="inline-block px-2.5 py-1 bg-white/10 backdrop-blur-sm rounded-lg text-[10px] font-bold tracking-[2px] text-white/90 uppercase">
                {t("landing_showcase_reference")}
              </span>
            </div>
          </div>
        </div>

        <FlowArrow />

        {/* Result */}
        <div className="flex-1 max-w-sm w-full group">
          <div className="rounded-2xl overflow-hidden aspect-[4/3] bg-white/[0.03] border-2 border-white/[0.15] hover:border-white/[0.25] transition-all relative ring-1 ring-white/[0.06] ring-offset-2 ring-offset-black">
            <img
              src="/showcase/result.png"
              alt={t("landing_showcase_result")}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <span className="inline-block px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-lg text-[10px] font-bold tracking-[2px] text-white uppercase border border-white/20">
                {t("landing_showcase_result")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Caption */}
      <p className="text-[12px] text-white/30 text-center mt-6 max-w-md mx-auto leading-relaxed">
        {t("landing_showcase_flowDesc")}
      </p>

      {/* ── Film Presets Mention ── */}
      <div className="mt-14 text-center">
        <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-full">
          <svg className="w-4 h-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
            <line x1="7" y1="2" x2="7" y2="22" />
            <line x1="17" y1="2" x2="17" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="2" y1="7" x2="7" y2="7" />
            <line x1="2" y1="17" x2="7" y2="17" />
            <line x1="17" y1="7" x2="22" y2="7" />
            <line x1="17" y1="17" x2="22" y2="17" />
          </svg>
          <span className="text-[11px] tracking-[1px] text-white/50">
            {t("landing_showcase_presetsNote")}
          </span>
        </div>
      </div>
    </section>
  );
}
