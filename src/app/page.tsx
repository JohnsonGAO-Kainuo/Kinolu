"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCamera, IconEdit, IconLibrary, IconMenu } from "@/components/icons";
import { usePWAInstall } from "@/lib/usePWAInstall";
import Sidebar from "@/components/Sidebar";
import { useI18n } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════
   Kinolu Landing Page — SEO-rich, conversion-focused
   ═══════════════════════════════════════════════════════════ */

const FEATURES = [
  { icon: "🎨", key: "landing_feat1Title" as const, descKey: "landing_feat1Desc" as const },
  { icon: "🎛️", key: "landing_feat2Title" as const, descKey: "landing_feat2Desc" as const },
  { icon: "🎞️", key: "landing_feat3Title" as const, descKey: "landing_feat3Desc" as const },
  { icon: "📷", key: "landing_feat4Title" as const, descKey: "landing_feat4Desc" as const },
  { icon: "✂️", key: "landing_feat5Title" as const, descKey: "landing_feat5Desc" as const },
  { icon: "📦", key: "landing_feat6Title" as const, descKey: "landing_feat6Desc" as const },
] as const;

const STEPS = [
  { num: "01", key: "landing_step1Title" as const, descKey: "landing_step1Desc" as const },
  { num: "02", key: "landing_step2Title" as const, descKey: "landing_step2Desc" as const },
  { num: "03", key: "landing_step3Title" as const, descKey: "landing_step3Desc" as const },
  { num: "04", key: "landing_step4Title" as const, descKey: "landing_step4Desc" as const },
] as const;

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const { canInstall, promptInstall, showIOSGuide, dismissIOSGuide } = usePWAInstall();
  const { t } = useI18n();

  return (
    <div className="relative w-full min-h-screen bg-black text-white overflow-y-auto">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* iOS install guide */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={dismissIOSGuide}>
          <div className="bg-[#1c1c1e] rounded-t-2xl w-full max-w-md p-6 pb-8 safe-bottom animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[14px] font-semibold text-white tracking-wide">{t("pwa_iosTitle")}</h3>
              <button onClick={dismissIOSGuide} className="text-white/40 text-[18px]">✕</button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="text-[12px] text-white/70 leading-relaxed">{t("pwa_iosStep1")}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[16px]">＋</div>
                <p className="text-[12px] text-white/70 leading-relaxed">{t("pwa_iosStep2")}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Nav Bar ─── */}
      <nav className="fixed top-0 left-0 w-full z-50 safe-top">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="w-9 h-9 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white transition-colors">
            <IconMenu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo-icon-sm.png" alt="Kinolu" width={28} height={28} className="w-7 h-7" />
            <span className="text-[13px] font-bold tracking-[4px] text-white/90">KINOLU</span>
          </div>
          {canInstall ? (
            <button onClick={promptInstall} className="text-[9px] tracking-[1.5px] text-white/50 border border-white/15 rounded-full px-2.5 py-1 hover:text-white/80 transition-colors">
              {t("install")}
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="relative w-full h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: "url(/heroes/editor.jpg)" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black" />
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-[42px] md:text-[64px] font-black tracking-[6px] leading-tight uppercase">
            {t("landing_heroTitle")}
          </h1>
          <p className="mt-4 text-[14px] md:text-[16px] text-white/60 tracking-wide leading-relaxed max-w-md mx-auto">
            {t("landing_heroDesc")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center">
            <button
              onClick={() => router.push("/editor")}
              className="px-8 py-3 bg-white text-black text-[12px] font-bold tracking-[3px] rounded-full uppercase hover:bg-white/90 transition-colors"
            >
              {t("landing_ctaEditor")}
            </button>
            <button
              onClick={() => router.push("/camera")}
              className="px-8 py-3 border border-white/25 text-[12px] font-bold tracking-[3px] rounded-full uppercase text-white/80 hover:bg-white/10 transition-colors"
            >
              {t("landing_ctaCamera")}
            </button>
          </div>
        </div>
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30">
            <path d="M7 13l5 5 5-5M7 7l5 5 5-5" />
          </svg>
        </div>
      </section>

      {/* ─── Quick Access Cards ─── */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: IconEdit, label: t("home_editor"), desc: t("home_editorDesc"), href: "/editor", bg: "/heroes/editor.jpg" },
            { icon: IconCamera, label: t("home_camera"), desc: t("home_cameraDesc"), href: "/camera", bg: "/heroes/camera.jpg" },
            { icon: IconLibrary, label: t("home_library"), desc: t("home_libraryDesc"), href: "/presets", bg: "/heroes/presets.jpg" },
          ].map((card) => (
            <button
              key={card.href}
              onClick={() => router.push(card.href)}
              className="relative overflow-hidden rounded-2xl aspect-[4/3] group cursor-pointer"
            >
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" style={{ backgroundImage: `url(${card.bg})` }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="relative z-10 w-full h-full flex flex-col items-center justify-end pb-6">
                <card.icon size={24} className="text-white/80 mb-2" />
                <h3 className="text-[16px] font-bold tracking-[3px] text-white uppercase">{card.label}</h3>
                <p className="text-[10px] text-white/50 tracking-[2px] uppercase mt-0.5">{card.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <h2 className="text-[11px] tracking-[4px] text-white/40 uppercase text-center mb-2">{t("landing_featuresLabel")}</h2>
        <h3 className="text-[24px] md:text-[32px] font-bold tracking-[2px] text-center mb-12">{t("landing_featuresTitle")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.key} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.05] transition-colors">
              <div className="text-[28px] mb-3">{f.icon}</div>
              <h4 className="text-[13px] font-semibold tracking-wide mb-1">{t(f.key)}</h4>
              <p className="text-[11px] text-white/40 leading-relaxed">{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="text-[11px] tracking-[4px] text-white/40 uppercase text-center mb-2">{t("landing_howLabel")}</h2>
        <h3 className="text-[24px] md:text-[32px] font-bold tracking-[2px] text-center mb-12">{t("landing_howTitle")}</h3>
        <div className="space-y-6">
          {STEPS.map((s) => (
            <div key={s.num} className="flex gap-5 items-start">
              <div className="text-[28px] font-black text-white/10 tracking-tight min-w-[48px]">{s.num}</div>
              <div>
                <h4 className="text-[14px] font-semibold tracking-wide mb-1">{t(s.key)}</h4>
                <p className="text-[12px] text-white/40 leading-relaxed">{t(s.descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Example Gallery ─── */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <h2 className="text-[11px] tracking-[4px] text-white/40 uppercase text-center mb-2">{t("landing_galleryLabel")}</h2>
        <h3 className="text-[24px] md:text-[32px] font-bold tracking-[2px] text-center mb-8">{t("landing_galleryTitle")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {["/heroes/camera.jpg", "/heroes/editor.jpg", "/heroes/presets.jpg"].map((src, i) => (
            <div key={i} className="rounded-2xl overflow-hidden aspect-[4/3] bg-white/5">
              <img src={src} alt={`Kinolu example ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </section>

      {/* ─── Community CTA ─── */}
      <section className="max-w-4xl mx-auto px-5 py-16 text-center">
        <h2 className="text-[24px] md:text-[32px] font-bold tracking-[2px] mb-4">{t("landing_communityTitle")}</h2>
        <p className="text-[13px] text-white/40 leading-relaxed max-w-md mx-auto mb-8">{t("landing_communityDesc")}</p>
        <button
          onClick={() => router.push("/community")}
          className="px-8 py-3 border border-white/20 text-[12px] font-bold tracking-[3px] rounded-full uppercase text-white/70 hover:bg-white/10 transition-colors"
        >
          {t("landing_ctaCommunity")}
        </button>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="max-w-4xl mx-auto px-5 py-20 text-center">
        <h2 className="text-[32px] md:text-[48px] font-black tracking-[4px] uppercase mb-4">{t("landing_finalTitle")}</h2>
        <p className="text-[13px] text-white/40 mb-8">{t("landing_finalDesc")}</p>
        <button
          onClick={() => router.push("/editor")}
          className="px-10 py-3.5 bg-white text-black text-[12px] font-bold tracking-[3px] rounded-full uppercase hover:bg-white/90 transition-colors"
        >
          {t("landing_ctaStart")}
        </button>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.06] py-10 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo-icon-sm.png" alt="" width={20} height={20} />
            <span className="text-[11px] tracking-[3px] text-white/40 font-bold">KINOLU</span>
          </div>
          <div className="flex gap-6 text-[10px] tracking-[1.5px] text-white/30 uppercase">
            <button onClick={() => router.push("/privacy")} className="hover:text-white/60 transition-colors">{t("sidebar_privacy")}</button>
            <button onClick={() => router.push("/terms")} className="hover:text-white/60 transition-colors">{t("sidebar_terms")}</button>
            <button onClick={() => router.push("/feedback")} className="hover:text-white/60 transition-colors">{t("sidebar_feedback")}</button>
          </div>
          <p className="text-[10px] text-white/20">© 2026 Kainuo Tech</p>
        </div>
      </footer>
    </div>
  );
}
