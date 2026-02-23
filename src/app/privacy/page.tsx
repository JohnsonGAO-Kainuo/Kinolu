"use client";

import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";
import { useI18n } from "@/lib/i18n";

export default function PrivacyPage() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="flex flex-col w-full h-full bg-black">
      <header className="flex items-center justify-between h-[44px] px-4 safe-top">
        <button onClick={() => { if (window.history.length > 1) router.back(); else router.push("/"); }} className="w-8 h-8 flex items-center justify-center text-white/60">
          <IconBack size={20} />
        </button>
        <span className="text-[12px] font-semibold tracking-[2.5px] uppercase text-white/70">{t("privacy_title")}</span>
        <div className="w-8" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="max-w-2xl mx-auto prose prose-invert prose-sm">
          <p className="text-[11px] text-white/40 mb-4">{t("privacy_updated")}</p>
          
          <h2 className="text-[14px] font-bold text-white/90 mt-6 mb-3">{t("privacy_dataCollection")}</h2>
          <p className="text-[12px] text-white/60 leading-relaxed mb-4">{t("privacy_dataCollectionDesc")}</p>

          <h2 className="text-[14px] font-bold text-white/90 mt-6 mb-3">{t("privacy_localStorage")}</h2>
          <p className="text-[12px] text-white/60 leading-relaxed mb-4">{t("privacy_localStorageDesc")}</p>

          <h2 className="text-[14px] font-bold text-white/90 mt-6 mb-3">{t("privacy_analytics")}</h2>
          <p className="text-[12px] text-white/60 leading-relaxed mb-4">{t("privacy_analyticsDesc")}</p>

          <h2 className="text-[14px] font-bold text-white/90 mt-6 mb-3">{t("privacy_contact")}</h2>
          <p className="text-[12px] text-white/60 leading-relaxed">{t("privacy_contactDesc")}</p>
        </div>
      </div>
    </div>
  );
}
