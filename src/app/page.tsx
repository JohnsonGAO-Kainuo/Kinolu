"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCamera, IconEdit, IconLibrary, IconMenu } from "@/components/icons";
import { usePWAInstall } from "@/lib/usePWAInstall";
import Sidebar from "@/components/Sidebar";
import { useI18n } from "@/lib/i18n";

const CARD_DEFS = [
  {
    id: "camera",
    labelKey: "home_camera" as const,
    descKey: "home_cameraDesc" as const,
    href: "/camera",
    icon: IconCamera,
    bg: "/heroes/camera.jpg",
  },
  {
    id: "editor",
    labelKey: "home_editor" as const,
    descKey: "home_editorDesc" as const,
    href: "/editor",
    icon: IconEdit,
    bg: "/heroes/editor.jpg",
  },
  {
    id: "library",
    labelKey: "home_library" as const,
    descKey: "home_libraryDesc" as const,
    href: "/presets",
    icon: IconLibrary,
    bg: "/heroes/presets.jpg",
  },
] as const;

export default function HomePage() {
  const [active, setActive] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const { canInstall, promptInstall, showIOSGuide, dismissIOSGuide } = usePWAInstall();
  const { t } = useI18n();

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* iOS "Add to Home Screen" guide modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={dismissIOSGuide}>
          <div className="bg-[#1c1c1e] rounded-t-2xl w-full max-w-md p-6 pb-8 safe-bottom animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[14px] font-semibold text-white tracking-wide">{t("pwa_iosTitle")}</h3>
              <button onClick={dismissIOSGuide} className="text-white/40 text-[18px]">✕</button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[16px]">
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

      {/* Top bar */}
      <div className="absolute top-0 left-0 w-full safe-top px-5 flex justify-between items-center z-50 pointer-events-none">
        <button
          onClick={() => setSidebarOpen(true)}
          className="pointer-events-auto w-9 h-9 rounded-full bg-black/25 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white transition-colors"
        >
          <IconMenu size={18} />
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo-icon-sm.png" alt="" width={28} height={28} className="w-7 h-7 drop-shadow-lg" />
          <span className="text-[13px] font-bold tracking-[4px] text-white/90 drop-shadow-lg">
            KINOLU
          </span>
        </div>
        {canInstall ? (
          <button onClick={promptInstall} className="pointer-events-auto text-[9px] tracking-[1.5px] text-white/50 border border-white/15 rounded-full px-2.5 py-1 hover:text-white/80 transition-colors">
            {t("install")}
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* Accordion cards */}
      <div className="flex flex-col w-full h-full">
        {CARD_DEFS.map((card, i) => {
          const isActive = i === active;
          const Icon = card.icon;
          const label = t(card.labelKey);
          const desc = t(card.descKey);

          return (
            <div
              key={card.id}
              onClick={() => setActive(i)}
              className="relative overflow-hidden cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
              style={{
                flex: isActive ? 3 : 1,
                filter: isActive ? "brightness(1.05)" : "brightness(0.6)",
              }}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700"
                style={{
                  backgroundImage: `url(${card.bg})`,
                  transform: isActive ? "scale(1.02)" : "scale(1)",
                }}
              />
              <div
                className="absolute inset-0 transition-opacity duration-300"
                style={{
                  background: isActive
                    ? "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.5) 100%)"
                    : "rgba(0,0,0,0.5)",
                }}
              />
              <div
                className="relative z-10 w-full h-full flex flex-col items-center justify-center"
                onClick={(e) => { if (isActive) { e.stopPropagation(); router.push(card.href); } }}
              >
                {/* Icon — collapsed */}
                <div
                  className="transition-all duration-500 absolute"
                  style={{ opacity: isActive ? 0 : 0.5, transform: isActive ? "scale(0.5)" : "scale(1)" }}
                >
                  <Icon size={26} className="text-white" />
                </div>

                {/* Content — expanded */}
                <div
                  className="flex flex-col items-center transition-all duration-500"
                  style={{ opacity: isActive ? 1 : 0, transform: isActive ? "translateY(0)" : "translateY(10px)" }}
                >
                  <h2 className="text-[28px] font-extrabold tracking-[2px] text-white drop-shadow-lg uppercase">{label}</h2>
                  <p className="text-[11px] text-white/60 mt-0.5 tracking-[2px] uppercase">{desc}</p>
                  <div className="mt-4 px-5 py-1.5 border border-white/25 rounded-full text-[10px] tracking-[2px] text-white/70 hover:bg-white/10 transition-colors uppercase">
                    {t("open")}
                  </div>
                </div>

                {/* Label — collapsed */}
                <span
                  className="absolute text-[11px] font-bold tracking-[3px] text-white/50 uppercase transition-all duration-500"
                  style={{ opacity: isActive ? 0 : 1, bottom: isActive ? "50%" : "14px" }}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
