"use client";

import { useI18n } from "@/lib/i18n";
import { IconEdit, IconPalette, IconFilm, IconXYPad } from "@/components/icons";

const STEPS = [
  { num: "01", key: "landing_step1Title" as const, descKey: "landing_step1Desc" as const, Icon: IconEdit },
  { num: "02", key: "landing_step2Title" as const, descKey: "landing_step2Desc" as const, Icon: IconFilm },
  { num: "03", key: "landing_step3Title" as const, descKey: "landing_step3Desc" as const, Icon: IconPalette },
  { num: "04", key: "landing_step4Title" as const, descKey: "landing_step4Desc" as const, Icon: IconXYPad },
] as const;

interface HowItWorksSectionProps {
  standalone?: boolean;
}

export default function HowItWorksSection({ standalone }: HowItWorksSectionProps) {
  const { t } = useI18n();

  return (
    <section id="how-it-works" className={`max-w-4xl mx-auto px-5 scroll-mt-20 ${standalone ? "py-28" : "py-20"}`}>
      <h2 className="text-[10px] tracking-[4px] text-white/30 uppercase text-center mb-2">
        {t("landing_howLabel")}
      </h2>
      <h3 className="text-[24px] md:text-[36px] font-bold tracking-[2px] text-center mb-14">
        {t("landing_howTitle")}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        {STEPS.map((step) => (
          <div key={step.num} className="flex gap-4 items-start">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
              <step.Icon size={20} className="text-white/30" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-white/15 tracking-tight">{step.num}</span>
                <h4 className="text-[14px] font-semibold tracking-wide">{t(step.key)}</h4>
              </div>
              <p className="text-[12px] text-white/40 leading-relaxed">{t(step.descKey)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
