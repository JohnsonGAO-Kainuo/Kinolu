"use client";

import { useI18n } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════
   ShowcaseSection — AI Color Transfer demo
   Layout from whiteboard sketch:
     Ref (left) ──→ Original (top-right, "before")
                         ↓
                     Result (bottom-right, "after")
   ═══════════════════════════════════════════════════════════ */

interface ShowcaseSectionProps {
  standalone?: boolean;
}

export default function ShowcaseSection({ standalone }: ShowcaseSectionProps) {
  const { t } = useI18n();

  return (
    <section id="showcase" className={`max-w-7xl mx-auto px-6 scroll-mt-20 ${standalone ? "py-28" : "py-20"}`}>
      {/* Header */}
      <h2 className="text-[10px] tracking-[4px] text-white/30 uppercase text-center mb-2">
        {t("landing_galleryLabel")}
      </h2>
      <h3 className="text-[24px] md:text-[36px] font-bold tracking-[2px] text-center mb-4">
        {t("landing_galleryTitle")}
      </h3>
      <p className="text-[13px] text-white/40 text-center mb-14 max-w-lg mx-auto">
        {t("landing_showcaseSubtitle")}
      </p>

      {/* ── Whiteboard layout ── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-4 items-center max-w-5xl mx-auto">

        {/* Left column: Reference — spans full height on desktop */}
        <div className="md:row-span-2 group">
          <div className="rounded-lg overflow-hidden bg-white/[0.02] border border-dashed border-white/[0.12] hover:border-white/[0.20] transition-all relative">
            <img
              src="/showcase/reference.jpg"
              alt={t("landing_showcase_reference")}
              className="w-full aspect-[4/3] md:aspect-auto md:h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <span className="inline-block px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded text-[10px] font-bold tracking-[2px] text-white/90 uppercase border border-white/10">
                {t("landing_showcase_reference")}
              </span>
            </div>
          </div>
        </div>

        {/* Center column: Arrows — desktop only */}
        {/* Arrow: Ref → Original (diagonal up-right) */}
        <div className="hidden md:flex flex-col items-center justify-between h-full py-8">
          <svg className="w-12 h-12 text-white/20" viewBox="0 0 48 48" fill="none">
            <path d="M12 36L36 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M20 12h16v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="w-px flex-1 bg-gradient-to-b from-white/5 via-white/10 to-white/5 my-2" />
          {/* Arrow: Original → Result (down) */}
          <svg className="w-10 h-10 text-white/20" viewBox="0 0 40 40" fill="none">
            <path d="M20 8v20M14 22l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Mobile: arrow down from Ref to Original */}
        <div className="md:hidden flex justify-center">
          <svg className="w-8 h-8 text-white/20" viewBox="0 0 32 32" fill="none">
            <path d="M16 6v16M10 18l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Right-top: Original (before) */}
        <div className="group">
          <div className="rounded-lg overflow-hidden bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all relative">
            <img
              src="/showcase/original.jpg"
              alt={t("landing_showcase_original")}
              className="w-full aspect-[4/3] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
              <span className="inline-block px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded text-[10px] font-bold tracking-[2px] text-white/90 uppercase border border-white/10">
                {t("landing_showcase_original")}
              </span>
              <span className="text-[10px] tracking-[1.5px] text-white/30 uppercase font-medium">Before</span>
            </div>
          </div>
        </div>

        {/* Mobile: arrow down from Original to Result */}
        <div className="md:hidden flex justify-center">
          <svg className="w-8 h-8 text-white/20" viewBox="0 0 32 32" fill="none">
            <path d="M16 6v16M10 18l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Right-bottom: Result (after) — highlighted */}
        <div className="group">
          <div className="rounded-lg overflow-hidden bg-white/[0.02] border-2 border-white/[0.15] hover:border-white/[0.25] transition-all relative">
            <img
              src="/showcase/result.png"
              alt={t("landing_showcase_result")}
              className="w-full aspect-[4/3] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
              <span className="inline-block px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded text-[10px] font-bold tracking-[2px] text-white uppercase border border-white/20">
                {t("landing_showcase_result")}
              </span>
              <span className="text-[10px] tracking-[1.5px] text-white/50 uppercase font-semibold">After</span>
            </div>
          </div>
        </div>
      </div>

      {/* Caption */}
      <p className="text-[12px] text-white/30 text-center mt-8 max-w-md mx-auto leading-relaxed">
        {t("landing_showcase_flowDesc")}
      </p>

      {/* ── Film Presets Mention ── */}
      <div className="mt-12 text-center">
        <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg">
          <svg className="w-4 h-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
            <line x1="7" y1="2" x2="7" y2="22" />
            <line x1="17" y1="2" x2="17" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="2" y1="7" x2="7" y2="7" />
            <line x1="2" y1="17" x2="7" y2="17" />
            <line x1="17" y1="7" x2="22" y2="7" />
            <line x1="17" y1="17" x2="22" y2="17" />
          </svg>
          <span className="text-[11px] tracking-[0.5px] text-white/50">
            {t("landing_showcase_presetsNote")}
          </span>
        </div>
      </div>
    </section>
  );
}
