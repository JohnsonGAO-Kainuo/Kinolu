"use client";

/* ── WhatsNew ──
 * Shows a subtle bottom-sheet when the user opens the app for the
 * first time after an update. Stores the last-seen version in
 * localStorage and compares against CURRENT_VERSION.
 */

import { useCallback, useEffect, useState } from "react";
import changelog, { CURRENT_VERSION, type ChangelogEntry } from "@/lib/changelog";
import { useI18n } from "@/lib/i18n";

const LS_KEY = "kinolu_last_seen_version";

export default function WhatsNew() {
  const [entry, setEntry] = useState<ChangelogEntry | null>(null);
  const { locale } = useI18n();

  useEffect(() => {
    const lastSeen = localStorage.getItem(LS_KEY);
    if (lastSeen !== CURRENT_VERSION) {
      // Show the latest changelog entry
      setEntry(changelog[0]);
    }
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(LS_KEY, CURRENT_VERSION);
    setEntry(null);
  }, []);

  if (!entry) return null;

  const lang = (locale === "zh-CN" || locale === "zh-TW") ? locale : "en";
  const highlights = entry.highlights[lang];

  const title =
    lang === "zh-CN"
      ? `🎉 新版本 v${entry.version}`
      : lang === "zh-TW"
        ? `🎉 新版本 v${entry.version}`
        : `🎉 What's New in v${entry.version}`;

  const btnLabel = lang === "zh-CN" ? "知道了" : lang === "zh-TW" ? "知道了" : "Got it";

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 pointer-events-auto animate-fade-in"
        onClick={dismiss}
      />
      {/* Sheet */}
      <div className="relative w-full max-w-md mx-4 mb-4 rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 pointer-events-auto animate-slide-up">
        <h3 className="text-[15px] font-bold text-white mb-3">{title}</h3>
        <ul className="space-y-1.5 mb-4 max-h-[40vh] overflow-y-auto">
          {highlights.map((item, i) => (
            <li key={i} className="flex gap-2 text-[12px] text-white/60 leading-relaxed">
              <span className="text-white/30 shrink-0">•</span>
              {item}
            </li>
          ))}
        </ul>
        <button
          onClick={dismiss}
          className="w-full py-2.5 bg-white text-black rounded-xl text-[13px] font-semibold active:opacity-80 transition-opacity"
        >
          {btnLabel}
        </button>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slide-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
        .animate-fade-in { animation: fade-in 0.25s ease-out }
        .animate-slide-up { animation: slide-up 0.3s ease-out }
      `}</style>
    </div>
  );
}
