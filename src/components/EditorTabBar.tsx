"use client";

import React from "react";
import type { EditorTab } from "@/lib/types";
import {
  IconTransfer,
  IconSliders,
  IconCurves,
  IconHSL,
  IconCrop,
} from "./icons";

interface EditorTabBarProps {
  active: EditorTab;
  onSelect: (tab: EditorTab) => void;
}

const TABS: { key: EditorTab; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { key: "transfer", label: "Transfer", icon: IconTransfer },
  { key: "edit", label: "Edit", icon: IconSliders },
  { key: "curves", label: "Curves", icon: IconCurves },
  { key: "hsl", label: "HSL", icon: IconHSL },
  { key: "crop", label: "Crop", icon: IconCrop },
];

export default function EditorTabBar({ active, onSelect }: EditorTabBarProps) {
  return (
    <div className="flex h-[52px] items-center border-t border-white/[0.06] bg-[#060606] safe-bottom">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
          >
            <Icon
              size={18}
              className={isActive ? "text-white" : "text-white/25"}
            />
            <span
              className={`text-[9px] tracking-[1px] ${
                isActive ? "text-white/80" : "text-white/25"
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
