"use client";

import { useI18n } from "@/lib/i18n";
import { IconPalette, IconFilm, IconEdit } from "@/components/icons";

const MODES = [
  {
    Icon: IconPalette,
    titleKey: "landing_mode1Title" as const,
    descKey: "landing_mode1Desc" as const,
    stepsKey: "landing_mode1Steps" as const,
  },
  {
    Icon: IconFilm,
    titleKey: "landing_mode2Title" as const,
    descKey: "landing_mode2Desc" as const,
    stepsKey: "landing_mode2Steps" as const,
  },
  {
    Icon: IconEdit,
    titleKey: "landing_mode3Title" as const,
    descKey: "landing_mode3Desc" as const,
    stepsKey: "landing_mode3Steps" as const,
  },
] as const;

interface HowItWorksSectionProps {
  standalone?: boolean;
}

export default function HowItWorksSection({ standalone }: HowItWorksSectionProps) {
  const { t } = useI18n();

  return (
    <section id="how-it-works" className={`max-w-7xl mx-auto px-6 scroll-mt-20 ${standalone ? "py-28" : "py-20"}`}>
      <h2 className="text-[10px] tracking-[4px] text-white/30 uppercase text-center mb-2">
        {t("landing_howLabel")}
      </h2>
      <h3 className="text-[24px] md:text-[36px] font-bold tracking-[2px] text-center mb-4">
        {t("landing_howTitle")}
      </h3>
      <p className="text-[13px] text-white/40 text-center mb-14 max-w-lg mx-auto">
        {t("landing_howSubtitle")}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {MODES.map((mode) => {
          const steps = t(mode.stepsKey).split("|");
          return (
            <div
              key={mode.titleKey}
              className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-6 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all group"
            >
              <div className="w-11 h-11 rounded-lg bg-white/[0.06] flex items-center justify-center mb-4 group-hover:bg-white/[0.1] transition-colors">
                <mode.Icon size={22} className="text-white/50 group-hover:text-white/80 transition-colors" />
              </div>
              <h4 className="text-[15px] font-bold tracking-wide mb-1.5">{t(mode.titleKey)}</h4>
              <p className="text-[12px] text-white/40 leading-relaxed mb-4">{t(mode.descKey)}</p>
              <ol className="space-y-2">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center text-[9px] font-bold text-white/30 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-[11px] text-white/50 leading-relaxed">{step.trim()}</span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}
