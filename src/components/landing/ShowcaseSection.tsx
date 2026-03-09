"use client";

import { useI18n } from "@/lib/i18n";

const SHOWCASE_PAIRS = [
  {
    src: "/heroes/editor.jpg",
    label: "landing_showcase_filmEmulation" as const,
    descKey: "landing_showcase_filmDesc" as const,
  },
  {
    src: "/heroes/camera.jpg",
    label: "landing_showcase_colorMatch" as const,
    descKey: "landing_showcase_colorDesc" as const,
  },
  {
    src: "/heroes/presets.jpg",
    label: "landing_showcase_moodTransfer" as const,
    descKey: "landing_showcase_cameraDesc" as const,
  },
];

interface ShowcaseSectionProps {
  standalone?: boolean;
}

export default function ShowcaseSection({ standalone }: ShowcaseSectionProps) {
  const { t } = useI18n();

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
        {SHOWCASE_PAIRS.map((pair, i) => (
          <div key={i} className="group relative">
            <div className="rounded-2xl overflow-hidden aspect-[4/3] bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all">
              <img
                src={pair.src}
                alt={t(pair.label)}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <span className="text-[11px] font-semibold tracking-[1.5px] text-white/80 uppercase">
                  {t(pair.label)}
                </span>
                <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed">
                  {t(pair.descKey)}
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
