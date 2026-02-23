"use client";

import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";
import { useI18n } from "@/lib/i18n";

export default function SubscriptionPage() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="flex flex-col w-full h-full bg-black">
      <header className="flex items-center justify-between h-[44px] px-4 safe-top">
        <button onClick={() => { if (window.history.length > 1) router.back(); else router.push("/"); }} className="w-8 h-8 flex items-center justify-center text-white/60">
          <IconBack size={20} />
        </button>
        <span className="text-[12px] font-semibold tracking-[2.5px] uppercase text-white/70">{t("sub_title")}</span>
        <div className="w-8" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-md mx-auto flex flex-col gap-4">
          {/* Free tier */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-bold text-white/90">{t("sub_free")}</h3>
              <span className="text-[11px] text-white/40 tracking-[1px]">{t("sub_current")}</span>
            </div>
            <ul className="space-y-2 text-[12px] text-white/60">
              <li>• {t("sub_free1")}</li>
              <li>• {t("sub_free2")}</li>
              <li>• {t("sub_free3")}</li>
              <li>• {t("sub_free4")}</li>
            </ul>
          </div>

          {/* Pro tier */}
          <div className="rounded-2xl border border-white/20 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-bold text-white">{t("sub_pro")}</h3>
              <span className="text-[13px] font-semibold text-white/90">{t("sub_proPrice")}</span>
            </div>
            <ul className="space-y-2 text-[12px] text-white/70 mb-4">
              <li>• {t("sub_pro1")}</li>
              <li>• {t("sub_pro2")}</li>
              <li>• {t("sub_pro3")}</li>
              <li>• {t("sub_pro4")}</li>
            </ul>
            <button className="w-full py-2.5 bg-white text-black rounded-xl text-[12px] font-semibold">
              {t("sub_upgrade")}
            </button>
          </div>

          <p className="text-[10px] text-white/30 text-center mt-4">{t("comingSoon")}</p>
        </div>
      </div>
    </div>
  );
}
