"use client";

import { useI18n } from "@/lib/i18n";
import {
  IconPalette, IconXYPad, IconFilm, IconCamera, IconEdit, IconPackage,
} from "@/components/icons";

const FEATURES = [
  { Icon: IconPalette, key: "landing_feat1Title" as const, descKey: "landing_feat1Desc" as const },
  { Icon: IconXYPad, key: "landing_feat2Title" as const, descKey: "landing_feat2Desc" as const },
  { Icon: IconFilm, key: "landing_feat3Title" as const, descKey: "landing_feat3Desc" as const },
  { Icon: IconCamera, key: "landing_feat4Title" as const, descKey: "landing_feat4Desc" as const },
  { Icon: IconEdit, key: "landing_feat5Title" as const, descKey: "landing_feat5Desc" as const },
  { Icon: IconPackage, key: "landing_feat6Title" as const, descKey: "landing_feat6Desc" as const },
] as const;

interface FeaturesSectionProps {
  /** When true, uses extra vertical padding for standalone route */
  standalone?: boolean;
}

export default function FeaturesSection({ standalone }: FeaturesSectionProps) {
  const { t } = useI18n();

  return (
    <section id="features" className={`max-w-7xl mx-auto px-6 scroll-mt-20 ${standalone ? "py-28" : "py-24"}`}>
      <h2 className="text-[10px] tracking-[4px] text-white/30 uppercase text-center mb-2">
        {t("landing_featuresLabel")}
      </h2>
      <h3 className="text-[24px] md:text-[36px] font-bold tracking-[2px] text-center mb-4">
        {t("landing_featuresTitle")}
      </h3>
      <p className="text-[13px] text-white/40 text-center mb-14 max-w-lg mx-auto">
        {t("landing_featuresSubtitle")}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
        {FEATURES.map((f) => (
          <div
            key={f.key}
            className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-6 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center mb-4 group-hover:bg-white/[0.1] transition-colors">
              <f.Icon size={20} className="text-white/60 group-hover:text-white/80 transition-colors" />
            </div>
            <h4 className="text-[13px] font-semibold tracking-wide mb-1.5">{t(f.key)}</h4>
            <p className="text-[11px] text-white/35 leading-relaxed">{t(f.descKey)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
