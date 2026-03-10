"use client";

import { useI18n } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { parseCubeFile, applyLutToPixels } from "@/lib/lutStore";

/* ── Preset cards: 3 film presets applied to the car sample ── */
const PRESET_CARDS = [
  {
    lutFile: "kodak_portra_400.cube",
    labelKey: "landing_showcase_filmEmulation" as const,
    descKey: "landing_showcase_filmDesc" as const,
  },
  {
    lutFile: "fuji_classic_chrome.cube",
    labelKey: "landing_showcase_moodTransfer" as const,
    descKey: "landing_showcase_colorDesc" as const,
  },
  {
    lutFile: "fuji_velvia.cube",
    labelKey: "landing_showcase_velvia" as const,
    descKey: "landing_showcase_velviaDesc" as const,
  },
];

const PREVIEW_W = 480;
const PREVIEW_H = 360;

/**
 * Load sample.jpg, apply a .cube LUT, and return a data URL.
 */
async function generatePreview(lutFileName: string): Promise<string | null> {
  try {
    const [imgResp, lutResp] = await Promise.all([
      fetch("/luts/sample.jpg"),
      fetch(`/luts/builtin/${lutFileName}`),
    ]);
    if (!imgResp.ok || !lutResp.ok) return null;

    const [imgBlob, lutText] = await Promise.all([imgResp.blob(), lutResp.text()]);
    const { size, data: lutData } = parseCubeFile(lutText);
    const bmp = await createImageBitmap(imgBlob, { resizeWidth: PREVIEW_W, resizeHeight: PREVIEW_H });

    const c = document.createElement("canvas");
    c.width = PREVIEW_W;
    c.height = PREVIEW_H;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0, PREVIEW_W, PREVIEW_H);
    const imgData = ctx.getImageData(0, 0, PREVIEW_W, PREVIEW_H);
    applyLutToPixels(imgData.data, lutData, size);
    ctx.putImageData(imgData, 0, 0);
    return c.toDataURL("image/jpeg", 0.88);
  } catch {
    return null;
  }
}

interface ShowcaseSectionProps {
  standalone?: boolean;
}

export default function ShowcaseSection({ standalone }: ShowcaseSectionProps) {
  const { t } = useI18n();
  const [previews, setPreviews] = useState<(string | null)[]>(PRESET_CARDS.map(() => null));
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    // Generate all previews in parallel
    Promise.all(PRESET_CARDS.map((c) => generatePreview(c.lutFile))).then(setPreviews);
  }, []);

  return (
    <section id="showcase" className={`max-w-6xl mx-auto px-5 scroll-mt-20 ${standalone ? "py-28" : "py-20"}`}>
      <h2 className="text-[10px] tracking-[4px] text-white/30 uppercase text-center mb-2">
        {t("landing_galleryLabel")}
      </h2>
      <h3 className="text-[24px] md:text-[36px] font-bold tracking-[2px] text-center mb-4">
        {t("landing_galleryTitle")}
      </h3>
      <p className="text-[13px] text-white/40 text-center mb-12 max-w-lg mx-auto">
        {t("landing_showcaseSubtitle")}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PRESET_CARDS.map((card, i) => (
          <div key={i} className="group relative">
            <div className="rounded-2xl overflow-hidden aspect-[4/3] bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all">
              {previews[i] ? (
                <img
                  src={previews[i]!}
                  alt={t(card.labelKey)}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                /* Loading skeleton */
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <span className="text-[11px] font-semibold tracking-[1.5px] text-white/80 uppercase">
                  {t(card.labelKey)}
                </span>
                <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed">
                  {t(card.descKey)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-white/20 text-center mt-6 italic">
        {t("landing_showcasePlaceholder")}
      </p>
    </section>
  );
}
