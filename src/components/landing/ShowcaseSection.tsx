"use client";

import Image from "next/image";
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

      {/* ── Desktop: Whiteboard grid with explicit placement ── */}
      <div className="hidden md:grid grid-cols-[1fr_48px_1fr] grid-rows-[1fr_1fr] gap-3 max-w-5xl mx-auto" style={{ height: "620px" }}>

        {/* Col 1, Row 1–2: Reference (tall, spans both rows) */}
        <div className="col-start-1 row-start-1 row-span-2 group relative rounded-lg overflow-hidden bg-white/[0.02] border border-dashed border-white/[0.12] hover:border-white/[0.20] transition-all">
          <Image
            src="/showcase/reference.jpg"
            alt={t("landing_showcase_reference")}
            fill
            sizes="(max-width: 768px) 100vw, 40vw"
            quality={90}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <span className="inline-block px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded text-[10px] font-bold tracking-[2px] text-white/90 uppercase border border-white/10">
              {t("landing_showcase_reference")}
            </span>
          </div>
        </div>

        {/* Col 2, Row 1: Diagonal arrow (Ref → Original) */}
        <div className="col-start-2 row-start-1 flex items-center justify-center">
          <svg className="w-10 h-10 text-white/20" viewBox="0 0 48 48" fill="none">
            <path d="M12 36L36 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M20 12h16v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Col 2, Row 2: Down arrow (Original → Result) */}
        <div className="col-start-2 row-start-2 flex items-center justify-center">
          <svg className="w-9 h-9 text-white/20" viewBox="0 0 40 40" fill="none">
            <path d="M20 8v20M14 22l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Col 3, Row 1: Original (Before) */}
        <div className="col-start-3 row-start-1 group relative rounded-lg overflow-hidden bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all">
          <Image
            src="/showcase/original.jpg"
            alt={t("landing_showcase_original")}
            fill
            sizes="(max-width: 768px) 100vw, 40vw"
            quality={90}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
            <span className="inline-block px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded text-[10px] font-bold tracking-[2px] text-white/90 uppercase border border-white/10">
              {t("landing_showcase_original")}
            </span>
            <span className="text-[10px] tracking-[1.5px] text-white/30 uppercase font-medium">Before</span>
          </div>
        </div>

        {/* Col 3, Row 2: Result (After) — highlighted border */}
        <div className="col-start-3 row-start-2 group relative rounded-lg overflow-hidden bg-white/[0.02] border-2 border-white/[0.15] hover:border-white/[0.25] transition-all">
          <Image
            src="/showcase/result.png"
            alt={t("landing_showcase_result")}
            fill
            sizes="(max-width: 768px) 100vw, 40vw"
            quality={90}
            className="object-cover"
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

      {/* ── Mobile: Vertical flow ── */}
      <div className="md:hidden flex flex-col items-center gap-3 max-w-lg mx-auto">
        {/* Reference */}
        <div className="w-full relative rounded-lg overflow-hidden bg-white/[0.02] border border-dashed border-white/[0.12]">
          <div className="relative w-full aspect-[4/3]">
            <Image src="/showcase/reference.jpg" alt={t("landing_showcase_reference")} fill sizes="100vw" quality={90} className="object-cover" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 p-3">
            <span className="inline-block px-2 py-0.5 bg-black/50 backdrop-blur-sm rounded text-[9px] font-bold tracking-[2px] text-white/90 uppercase border border-white/10">
              {t("landing_showcase_reference")}
            </span>
          </div>
        </div>
        {/* ↓ */}
        <svg className="w-7 h-7 text-white/20" viewBox="0 0 32 32" fill="none">
          <path d="M16 6v16M10 18l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* Original */}
        <div className="w-full relative rounded-lg overflow-hidden bg-white/[0.02] border border-white/[0.06]">
          <div className="relative w-full aspect-[4/3]">
            <Image src="/showcase/original.jpg" alt={t("landing_showcase_original")} fill sizes="100vw" quality={90} className="object-cover" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
            <span className="inline-block px-2 py-0.5 bg-black/50 backdrop-blur-sm rounded text-[9px] font-bold tracking-[2px] text-white/90 uppercase border border-white/10">
              {t("landing_showcase_original")}
            </span>
            <span className="text-[9px] tracking-[1.5px] text-white/30 uppercase">Before</span>
          </div>
        </div>
        {/* ↓ */}
        <svg className="w-7 h-7 text-white/20" viewBox="0 0 32 32" fill="none">
          <path d="M16 6v16M10 18l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* Result */}
        <div className="w-full relative rounded-lg overflow-hidden bg-white/[0.02] border-2 border-white/[0.15]">
          <div className="relative w-full aspect-[4/3]">
            <Image src="/showcase/result.png" alt={t("landing_showcase_result")} fill sizes="100vw" quality={90} className="object-cover" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
            <span className="inline-block px-2 py-0.5 bg-white/15 backdrop-blur-sm rounded text-[9px] font-bold tracking-[2px] text-white uppercase border border-white/20">
              {t("landing_showcase_result")}
            </span>
            <span className="text-[9px] tracking-[1.5px] text-white/50 uppercase font-semibold">After</span>
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
