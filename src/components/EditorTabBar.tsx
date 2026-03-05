"use client";

import React from "react";
import type { EditorTab } from "@/lib/types";
import type { TranslationKeys } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import {
  IconTransfer,
  IconSliders,
} from "./icons";

interface EditorTabBarProps {
  active: EditorTab;
  onSelect: (tab: EditorTab) => void;
}

const TABS: { key: EditorTab; labelKey: TranslationKeys; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { key: "transfer", labelKey: "tab_transfer", icon: IconTransfer },
  { key: "edit", labelKey: "tab_edit", icon: IconSliders },
];

export default function EditorTabBar({ active, onSelect }: EditorTabBarProps) {
  const { t } = useI18n();
  return (
    <div className="bg-[#0a0a0a] border-t border-white/5">
      {/* Tab content — py-3 gives equal spacing above (from divider) and below (before safe area) */}
      <div className="flex items-center py-3">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => onSelect(tab.key)}
              className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors active:opacity-70"
            >
              <div className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${isActive ? "bg-white/[0.08]" : ""}`}>
                <Icon
                  size={20}
                  className={isActive ? "text-white" : "text-white/30"}
                />
              </div>
              <span
                className={`text-[10px] tracking-[0.5px] font-medium ${
                  isActive ? "text-white" : "text-white/30"
                }`}
              >
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
      {/* Safe area spacer for home indicator — separate from tab content */}
      <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
    </div>
  );
}
