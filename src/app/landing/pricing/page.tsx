"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/components/AuthProvider";
import { IconCheck, IconCheckCircle, IconInfinity, IconMinus } from "@/components/icons";

type Plan = "monthly" | "annual" | "lifetime";

const PAYMENT_LINKS: Record<Plan, string> = {
  monthly: process.env.NEXT_PUBLIC_STRIPE_LINK_MONTHLY || "",
  annual: process.env.NEXT_PUBLIC_STRIPE_LINK_ANNUAL || "",
  lifetime: process.env.NEXT_PUBLIC_STRIPE_LINK_LIFETIME || "",
};

/* /landing/pricing — pricing page matching the landing visual style */
export default function LandingPricingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, isPro, profile, subscription, refreshProfile } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<Plan>("annual");
  const [paymentPending, setPaymentPending] = useState(false);

  const handleSubscribe = () => {
    if (!user) {
      router.push("/auth/login");
      return;
    }
    const link = PAYMENT_LINKS[selectedPlan];
    if (link) {
      const url = new URL(link);
      if (profile?.email) url.searchParams.set("prefilled_email", profile.email);
      url.searchParams.set("client_reference_id", user.id);
      window.location.href = url.toString();
    }
  };

  return (
    <div
      className="relative w-full bg-black text-white"
      style={{ height: "100dvh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
    >
      <LandingNav activeSection="" />

      <section className="max-w-4xl mx-auto px-5 py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-[10px] tracking-[4px] text-white/30 uppercase mb-2">
            {t("landing_nav_pricing")}
          </h2>
          <h3 className="text-[28px] md:text-[40px] font-bold tracking-[2px] mb-4">
            Kinolu Pro
          </h3>
          <p className="text-[13px] text-white/40 max-w-md mx-auto">
            {t("sub_heroDesc")}
          </p>
        </div>

        {/* Feature comparison */}
        <div className="max-w-lg mx-auto rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden mb-10">
          <div className="flex items-center h-10 px-5 border-b border-white/[0.06]">
            <div className="flex-1 text-[11px] text-white/30 font-medium tracking-wider uppercase">
              {t("sub_feature")}
            </div>
            <div className="w-16 text-center text-[11px] text-white/30 font-medium">{t("sub_free")}</div>
            <div className="w-16 text-center text-[11px] text-white font-semibold">Pro</div>
          </div>
          {[
            { key: "sub_feat_transfer", free: t("sub_5day"), pro: <IconInfinity size={14} /> },
            { key: "sub_feat_filters", free: "5", pro: t("sub_all12") },
            { key: "sub_feat_presets", free: t("sub_5max"), pro: <IconInfinity size={14} /> },
            { key: "sub_feat_camera", free: <IconCheck size={14} />, pro: <IconCheck size={14} /> },
            { key: "sub_feat_editor", free: <IconCheck size={14} />, pro: <IconCheck size={14} /> },
            { key: "sub_feat_lutImport", free: <IconCheck size={14} />, pro: <IconCheck size={14} /> },
            { key: "sub_feat_batch", free: <IconMinus size={14} />, pro: <IconCheck size={14} /> },
          ].map((row, i) => (
            <div
              key={row.key}
              className={`flex items-center h-10 px-5 ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}
            >
              <div className="flex-1 text-[12px] text-white/60">
                {t(row.key as Parameters<typeof t>[0])}
              </div>
              <div className="w-16 text-center text-[11px] text-white/40">{row.free}</div>
              <div className="w-16 text-center text-[11px] text-white/90 font-medium">{row.pro}</div>
            </div>
          ))}
        </div>

        {/* Plan cards */}
        <div className="max-w-lg mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Annual */}
          <button
            onClick={() => setSelectedPlan("annual")}
            className={`cursor-pointer relative flex flex-col items-center px-5 py-6 rounded-2xl border transition-all ${
              selectedPlan === "annual"
                ? "border-white/40 bg-white/[0.06]"
                : "border-white/[0.06] bg-white/[0.02] hover:border-white/15"
            }`}
          >
            <div className="absolute -top-2.5 px-2 py-0.5 bg-white text-black text-[8px] font-bold rounded-full tracking-wider uppercase">
              {t("sub_bestValue")}
            </div>
            <span className="text-[13px] font-semibold text-white mb-1">{t("sub_annual")}</span>
            <span className="text-[24px] font-black text-white">$29.99</span>
            <span className="text-[10px] text-white/40 mt-0.5">$2.49/{t("sub_mo")}</span>
            <span className="text-[10px] text-white/30 mt-1">{t("sub_annualSub")}</span>
          </button>

          {/* Monthly */}
          <button
            onClick={() => setSelectedPlan("monthly")}
            className={`cursor-pointer flex flex-col items-center px-5 py-6 rounded-2xl border transition-all ${
              selectedPlan === "monthly"
                ? "border-white/40 bg-white/[0.06]"
                : "border-white/[0.06] bg-white/[0.02] hover:border-white/15"
            }`}
          >
            <span className="text-[13px] font-semibold text-white mb-1">{t("sub_monthly")}</span>
            <span className="text-[24px] font-black text-white">$2.99</span>
            <span className="text-[10px] text-white/40 mt-0.5">/{t("sub_mo")}</span>
          </button>

          {/* Lifetime */}
          <button
            onClick={() => setSelectedPlan("lifetime")}
            className={`cursor-pointer relative flex flex-col items-center px-5 py-6 rounded-2xl border transition-all ${
              selectedPlan === "lifetime"
                ? "border-white/40 bg-white/[0.06]"
                : "border-white/[0.06] bg-white/[0.02] hover:border-white/15"
            }`}
          >
            <div className="absolute -top-2.5 px-2 py-0.5 bg-amber-500 text-black text-[8px] font-bold rounded-full tracking-wider uppercase">
              {t("sub_lifetimeLimited")}
            </div>
            <span className="text-[13px] font-semibold text-white mb-1">{t("sub_lifetime")}</span>
            <span className="text-[24px] font-black text-white">$49.99</span>
            <span className="text-[10px] text-white/30 mt-1">{t("sub_lifetimeSub")}</span>
          </button>
        </div>

        {/* CTA */}
        <div className="max-w-sm mx-auto">
          {isPro ? (
            <div className="w-full py-3.5 bg-white/[0.06] border border-white/10 text-white/60 rounded-full text-[13px] font-bold tracking-wide text-center">
              <IconCheckCircle size={16} className="inline-block mr-1" /> {t("sub_active")}
              {subscription?.plan_type && (
                <span className="text-white/30 ml-1.5 font-normal">({subscription.plan_type})</span>
              )}
            </div>
          ) : paymentPending ? (
            <div className="w-full py-3.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-[13px] font-medium text-center animate-pulse">
              {t("sub_verifyingPayment")}
            </div>
          ) : (
            <button
              onClick={handleSubscribe}
              className="cursor-pointer w-full py-3.5 bg-white text-black rounded-full text-[13px] font-bold tracking-wide hover:bg-white/90 transition-colors"
            >
              {user ? t("sub_subscribe") : t("auth_signInToSubscribe")}
            </button>
          )}

          <p className="text-[10px] text-white/25 text-center mt-4 leading-relaxed">
            {t("sub_finePrint")}
          </p>

          <div className="flex items-center justify-center gap-4 mt-5">
            <button onClick={() => router.push("/terms")} className="cursor-pointer text-[10px] text-white/30 underline underline-offset-2 hover:text-white/50 transition-colors">
              {t("sub_terms")}
            </button>
            <span className="text-white/10 text-[10px]">|</span>
            <button onClick={() => router.push("/privacy")} className="cursor-pointer text-[10px] text-white/30 underline underline-offset-2 hover:text-white/50 transition-colors">
              {t("sub_privacy")}
            </button>
            <span className="text-white/10 text-[10px]">|</span>
            <button
              onClick={async () => {
                if (!user) { router.push("/auth/login"); return; }
                const freshProfile = await refreshProfile();
                const nowPro = freshProfile?.subscription_tier === "pro";
                if (nowPro) alert(t("sub_active"));
                else alert(t("sub_restoreNotFound"));
              }}
              className="cursor-pointer text-[10px] text-white/30 underline underline-offset-2 hover:text-white/50 transition-colors"
            >
              {t("sub_restore")}
            </button>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
