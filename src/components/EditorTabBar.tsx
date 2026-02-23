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
    <div className="flex h-[56px] items-center bg-[#0a0a0a] safe-bottom">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors active:opacity-70"
          >
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${isActive ? "bg-white/[0.08]" : ""}`}>
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
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
