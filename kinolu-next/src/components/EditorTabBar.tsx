"use client";

import React from "react";
import type { EditorTab } from "@/lib/types";
import {
  IconTransfer,
  IconSliders,
  IconCurves,
  IconHSL,
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
];

export default function EditorTabBar({ active, onSelect }: EditorTabBarProps) {
  return (
    <div className="flex h-[56px] items-center border-t border-k-border bg-black safe-bottom">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
          >
            <Icon
              size={20}
              className={isActive ? "text-white" : "text-k-muted"}
            />
            <span
              className={`text-[10px] font-medium tracking-wider ${
                isActive ? "text-white" : "text-k-muted"
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
