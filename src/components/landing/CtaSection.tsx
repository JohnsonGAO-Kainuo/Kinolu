"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

export default function CtaSection() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <section className="max-w-4xl mx-auto px-5 py-24 text-center">
      <h2 className="text-[28px] sm:text-[36px] md:text-[48px] font-black tracking-[4px] uppercase mb-4">
        {t("landing_finalTitle")}
      </h2>
      <p className="text-[13px] text-white/40 mb-10 max-w-md mx-auto">
        {t("landing_finalDesc")}
      </p>
      <button
        onClick={() => router.push("/editor")}
        className="px-10 py-3.5 bg-white text-black text-[12px] font-bold tracking-[3px] rounded-full uppercase hover:bg-white/90 transition-colors"
      >
        {t("landing_ctaStart")}
      </button>
    </section>
  );
}
