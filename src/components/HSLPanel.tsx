"use client";

import React, { useState } from "react";
import type { HSL7Data, HSL7Key } from "@/lib/types";
import { HSL_COLORS } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import type { TranslationKeys } from "@/lib/i18n";

const HSL_LABEL_KEYS: Record<HSL7Key, TranslationKeys> = {
  red: "hsl_red", orange: "hsl_orange", yellow: "hsl_yellow",
  green: "hsl_green", aqua: "hsl_aqua", blue: "hsl_blue", purple: "hsl_purple",
};

interface HSLPanelProps {
  hsl7: HSL7Data;
  onChange: (hsl7: HSL7Data) => void;
}

export default function HSLPanel({ hsl7, onChange }: HSLPanelProps) {
  const { t } = useI18n();
  const [activeKey, setActiveKey] = useState<HSL7Key>("red");
  const band = hsl7[activeKey];

  const updateBand = (prop: "hue" | "sat" | "light", value: number) => {
    onChange({
      ...hsl7,
      [activeKey]: { ...band, [prop]: value },
    });
  };

  const sliders: { key: "hue" | "sat" | "light"; labelKey: TranslationKeys; min: number; max: number }[] = [
    { key: "hue", labelKey: "hsl_hue", min: -180, max: 180 },
    { key: "sat", labelKey: "hsl_saturation", min: -100, max: 100 },
    { key: "light", labelKey: "hsl_luminance", min: -100, max: 100 },
  ];

  return (
    <div className="w-full px-5 flex flex-col gap-5">
      {/* Color circles */}
      <div className="flex justify-between px-2">
        {HSL_COLORS.map((color) => (
          <button
            key={color.key}
            onClick={() => setActiveKey(color.key)}
            className="flex flex-col items-center gap-1.5"
          >
            <div
              className="w-7 h-7 rounded-full transition-all"
              style={{
                background: color.hex,
                border:
                  activeKey === color.key
                    ? "2px solid #fff"
                    : "2px solid transparent",
                transform:
                  activeKey === color.key ? "scale(1.2)" : "scale(1)",
                boxShadow:
                  activeKey === color.key
                    ? `0 0 10px ${color.hex}40`
                    : "none",
              }}
            />
            <span
              className={`text-[9px] font-medium tracking-wider uppercase transition-colors ${
                activeKey === color.key
                  ? "text-white"
                  : "text-k-text-secondary"
              }`}
            >
              {t(HSL_LABEL_KEYS[color.key]).slice(0, 3)}
            </span>
          </button>
        ))}
      </div>

      {/* Sliders */}
      <div className="flex flex-col gap-5">
        {sliders.map((s) => (
          <div key={s.key} className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-k-text-secondary font-medium uppercase tracking-wider">
                {t(s.labelKey)}
              </span>
              <span className="text-[11px] text-k-text-secondary font-mono w-10 text-right">
                {band[s.key] > 0 ? "+" : ""}
                {band[s.key]}
              </span>
            </div>
            <input
              type="range"
              className="k-slider-center"
              min={s.min}
              max={s.max}
              value={band[s.key]}
              onChange={(e) => updateBand(s.key, Number(e.target.value))}
            />
          </div>
        ))}
      </div>

      {/* Reset button */}
      <button
        onClick={() =>
          onChange({
            ...hsl7,
            [activeKey]: { hue: 0, sat: 0, light: 0 },
          })
        }
        className="text-[10px] text-k-text-secondary tracking-wider uppercase self-center hover:text-white transition-colors"
      >
        {t("hsl_reset", { color: t(HSL_LABEL_KEYS[activeKey]) })}
      </button>
    </div>
  );
}
