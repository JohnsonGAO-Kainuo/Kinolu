"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);

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
        <div className="h-[60px] safe-top flex items-center px-6">
          <span className="text-[14px] font-bold tracking-[4px] text-white/90 uppercase">
            Kinolu
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-2 overflow-y-auto">
          <div className="text-[9px] tracking-[2px] text-white/25 uppercase px-3 mb-2">
            Navigate
          </div>

          <SidebarItem label="Editor" desc="Import & grade photos" onClick={() => navigate("/editor")} />
          <SidebarItem label="Camera" desc="Shoot with style" onClick={() => navigate("/camera")} />
          <SidebarItem label="Library" desc="Presets & LUT collection" onClick={() => navigate("/presets")} />

          <div className="my-4 mx-3 h-px bg-white/[0.06]" />

          <div className="text-[9px] tracking-[2px] text-white/25 uppercase px-3 mb-2">
            Account
          </div>

          <SidebarItem label="Profile" desc="Sign in to sync presets" onClick={() => navigate("/profile")} />
          <SidebarItem label="Subscription" desc="Plans & billing" onClick={() => navigate("/subscription")} />

          <div className="my-4 mx-3 h-px bg-white/[0.06]" />

          <div className="text-[9px] tracking-[2px] text-white/25 uppercase px-3 mb-2">
            About
          </div>

          <SidebarItem label="Privacy Policy" onClick={() => navigate("/privacy")} />
          <SidebarItem label="Terms of Service" onClick={() => navigate("/terms")} />
          <SidebarItem label="Feedback" desc="Help us improve" onClick={() => navigate("/feedback")} />
        </nav>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-white/[0.04]">
          <span className="text-[10px] text-white/20 tracking-[1px]">
            v0.1.0 · Made with ♡
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
