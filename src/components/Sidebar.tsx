"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { useAuth } from "@/components/AuthProvider";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);
  const { t, locale, setLocale } = useI18n();
  const { user, profile, isPro } = useAuth();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const navigate = useCallback(
    (href: string) => {
      onClose();
      setTimeout(() => router.push(href), 200);
    },
    [router, onClose]
  );

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={onClose}
        className="fixed inset-0 z-[100] transition-all duration-300"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          background: "rgba(0,0,0,0.6)",
          backdropFilter: open ? "blur(4px)" : "none",
        }}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 left-0 bottom-0 z-[101] w-[280px] bg-[#0a0a0a] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
        style={{
          transform: open ? "translateX(0)" : "translateX(-100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Header */}
        <div className="h-[60px] safe-top flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <img src="/logo-icon-sm.png" alt="" width={28} height={28} className="w-7 h-7" />
            <span className="text-[14px] font-bold tracking-[4px] text-white/90 uppercase">
              {t("appName")}
            </span>
          </div>
          {user && profile && (
            <div className="flex items-center gap-2">
              {isPro && (
                <span className="text-[8px] tracking-[1px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-white/10 text-white/70">
                  Pro
                </span>
              )}
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white/60">
                  {(profile.display_name || profile.email || "U").charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-2 overflow-y-auto">
          <div className="text-[9px] tracking-[2px] text-white/25 uppercase px-3 mb-2">
            {t("sidebar_navigate")}
          </div>

          <SidebarItem label={t("sidebar_editor")} desc={t("sidebar_editorDesc")} onClick={() => navigate("/editor")} />
          <SidebarItem label={t("sidebar_camera")} desc={t("sidebar_cameraDesc")} onClick={() => navigate("/camera")} />
          <SidebarItem label={t("sidebar_library")} desc={t("sidebar_libraryDesc")} onClick={() => navigate("/presets")} />
          <SidebarItem label={t("sidebar_community")} desc={t("sidebar_communityDesc")} onClick={() => navigate("/landing/community")} />

          <div className="my-4 mx-3 h-px bg-white/[0.06]" />

          <div className="text-[9px] tracking-[2px] text-white/25 uppercase px-3 mb-2">
            {t("sidebar_account")}
          </div>

          <SidebarItem label={t("sidebar_profile")} desc={t("sidebar_profileDesc")} onClick={() => navigate("/profile")} />
          <SidebarItem label={t("sidebar_subscription")} desc={t("sidebar_subscriptionDesc")} onClick={() => navigate("/subscription")} />

          <div className="my-4 mx-3 h-px bg-white/[0.06]" />

          <div className="text-[9px] tracking-[2px] text-white/25 uppercase px-3 mb-2">
            {t("sidebar_about")}
          </div>

          <SidebarItem label={t("sidebar_privacy")} onClick={() => navigate("/privacy")} />
          <SidebarItem label={t("sidebar_terms")} onClick={() => navigate("/terms")} />
          <SidebarItem label={t("sidebar_feedback")} desc={t("sidebar_feedbackDesc")} onClick={() => navigate("/feedback")} />

          {/* Language Switcher */}
          <div className="my-4 mx-3 h-px bg-white/[0.06]" />
          <div className="text-[9px] tracking-[2px] text-white/25 uppercase px-3 mb-2">
            {t("sidebar_language")}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1">
            {LOCALE_LABELS.map((l) => (
              <button
                key={l.key}
                onClick={() => setLocale(l.key as Locale)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  locale === l.key
                    ? "bg-white/10 text-white"
                    : "text-white/35 hover:text-white/60 hover:bg-white/[0.04]"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-white/[0.04]">
          <span className="text-[10px] text-white/20 tracking-[1px]">
            {t("sidebar_version")}
          </span>
        </div>
      </div>
    </>
  );
}

function SidebarItem({
  label,
  desc,
  onClick,
}: {
  label: string;
  desc?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex flex-col items-start px-3 py-2.5 rounded-lg hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors"
    >
      <span className="text-[13px] text-white/80 font-medium">{label}</span>
      {desc && (
        <span className="text-[10px] text-white/30 mt-0.5">{desc}</span>
      )}
    </button>
  );
}
