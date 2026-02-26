"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/components/AuthProvider";

type Plan = "monthly" | "annual" | "lifetime";

const PAYMENT_LINKS: Record<Plan, string> = {
  monthly: process.env.NEXT_PUBLIC_STRIPE_LINK_MONTHLY || "",
  annual: process.env.NEXT_PUBLIC_STRIPE_LINK_ANNUAL || "",
  lifetime: process.env.NEXT_PUBLIC_STRIPE_LINK_LIFETIME || "",
};

export default function SubscriptionPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, isPro, profile, subscription } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<Plan>("annual");

  return (
    <div className="flex flex-col w-full h-full bg-black">
      {/* ── Header ── */}
      <header className="flex items-center justify-between h-[44px] px-4 safe-top shrink-0">
        <button
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push("/");
          }}
          className="w-8 h-8 flex items-center justify-center text-white/60"
        >
          <IconBack size={20} />
        </button>
        <span className="text-[12px] font-semibold tracking-[2.5px] uppercase text-white/70">
          {t("sub_title")}
        </span>
        <div className="w-8" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="max-w-md mx-auto flex flex-col">
          {/* ── Hero ── */}
          <div className="flex flex-col items-center pt-4 pb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center mb-4">
              <span className="text-[24px]">✦</span>
            </div>
            <h2 className="text-[20px] font-bold text-white tracking-tight mb-1">
              Kinolu Pro
            </h2>
            <p className="text-[12px] text-white/40 text-center max-w-[260px]">
              {t("sub_heroDesc")}
            </p>
          </div>

          {/* ── Feature comparison ── */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden mb-5">
            {/* Header row */}
            <div className="flex items-center h-10 px-4 border-b border-white/8">
              <div className="flex-1 text-[11px] text-white/30 font-medium tracking-wider uppercase">
                {t("sub_feature")}
              </div>
              <div className="w-16 text-center text-[11px] text-white/30 font-medium">
                {t("sub_free")}
              </div>
              <div className="w-16 text-center text-[11px] text-white font-semibold">
                Pro
              </div>
            </div>

            {/* Feature rows */}
            {[
              { key: "sub_feat_transfer", free: t("sub_5day"), pro: "∞" },
              { key: "sub_feat_filters", free: "3", pro: t("sub_all12") },
              { key: "sub_feat_camera", free: "✓", pro: "✓" },
              { key: "sub_feat_editor", free: "✓", pro: "✓" },
              { key: "sub_feat_lutImport", free: "—", pro: "✓" },
              { key: "sub_feat_lutExport", free: "—", pro: "✓" },
              { key: "sub_feat_batch", free: "—", pro: "✓" },
              { key: "sub_feat_cloudSync", free: "—", pro: t("sub_comingSoon") },
            ].map((row, i) => (
              <div
                key={row.key}
                className={`flex items-center h-10 px-4 ${
                  i % 2 === 0 ? "bg-white/[0.01]" : ""
                }`}
              >
                <div className="flex-1 text-[12px] text-white/60">
                  {t(row.key as Parameters<typeof t>[0])}
                </div>
                <div className="w-16 text-center text-[11px] text-white/40">
                  {row.free}
                </div>
                <div className="w-16 text-center text-[11px] text-white/90 font-medium">
                  {row.pro}
                </div>
              </div>
            ))}
          </div>

          {/* ── Plan selection ── */}
          <div className="flex flex-col gap-2.5 mb-5">
            {/* Annual */}
            <button
              onClick={() => setSelectedPlan("annual")}
              className={`relative flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all ${
                selectedPlan === "annual"
                  ? "border-white/40 bg-white/[0.06]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              {/* Best value badge */}
              <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-white text-black text-[9px] font-bold rounded-full tracking-wider uppercase">
                {t("sub_bestValue")}
              </div>
              {/* Radio */}
              <div
                className={`shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedPlan === "annual"
                    ? "border-white bg-white"
                    : "border-white/25"
                }`}
              >
                {selectedPlan === "annual" && (
                  <div className="w-2 h-2 rounded-full bg-black" />
                )}
              </div>
              <div className="flex-1 flex items-center justify-between">
                <div className="flex flex-col items-start">
                  <span className="text-[14px] font-semibold text-white">
                    {t("sub_annual")}
                  </span>
                  <span className="text-[11px] text-white/40">
                    {t("sub_annualSub")}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[18px] font-bold text-white">
                    $29.99
                  </span>
                  <span className="text-[10px] text-white/40">
                    $2.49/{t("sub_mo")}
                  </span>
                </div>
              </div>
            </button>

            {/* Monthly */}
            <button
              onClick={() => setSelectedPlan("monthly")}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all ${
                selectedPlan === "monthly"
                  ? "border-white/40 bg-white/[0.06]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div
                className={`shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedPlan === "monthly"
                    ? "border-white bg-white"
                    : "border-white/25"
                }`}
              >
                {selectedPlan === "monthly" && (
                  <div className="w-2 h-2 rounded-full bg-black" />
                )}
              </div>
              <div className="flex-1 flex items-center justify-between">
                <span className="text-[14px] font-semibold text-white">
                  {t("sub_monthly")}
                </span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-[18px] font-bold text-white">
                    $2.99
                  </span>
                  <span className="text-[10px] text-white/40">
                    /{t("sub_mo")}
                  </span>
                </div>
              </div>
            </button>

            {/* Lifetime */}
            <button
              onClick={() => setSelectedPlan("lifetime" as Plan)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all ${
                selectedPlan === ("lifetime" as Plan)
                  ? "border-white/40 bg-white/[0.06]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div
                className={`shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedPlan === ("lifetime" as Plan)
                    ? "border-white bg-white"
                    : "border-white/25"
                }`}
              >
                {selectedPlan === ("lifetime" as Plan) && (
                  <div className="w-2 h-2 rounded-full bg-black" />
                )}
              </div>
              <div className="flex-1 flex items-center justify-between">
                <div className="flex flex-col items-start">
                  <span className="text-[14px] font-semibold text-white">
                    {t("sub_lifetime")}
                  </span>
                  <span className="text-[11px] text-white/40">
                    {t("sub_lifetimeSub")}
                  </span>
                </div>
                <span className="text-[18px] font-bold text-white">
                  $49.99
                </span>
              </div>
            </button>
          </div>

          {/* ── Subscribe / Status button ── */}
          {isPro ? (
            <div className="w-full py-3 bg-white/[0.06] border border-white/10 text-white/60 rounded-2xl text-[13px] font-bold tracking-wide text-center">
              ✓ {t("sub_active")}
              {subscription?.plan_type && (
                <span className="text-white/30 ml-1.5 font-normal">
                  ({subscription.plan_type})
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                if (!user) {
                  router.push("/auth/login");
                  return;
                }
                const link = PAYMENT_LINKS[selectedPlan];
                if (link) {
                  // Append prefilled email for Stripe
                  const url = new URL(link);
                  if (profile?.email) {
                    url.searchParams.set("prefilled_email", profile.email);
                  }
                  window.location.href = url.toString();
                }
              }}
              className="w-full py-3 bg-white text-black rounded-2xl text-[13px] font-bold tracking-wide active:opacity-80 transition-opacity"
            >
              {user ? t("sub_subscribe") : t("auth_signInToSubscribe")}
            </button>
          )}

          {/* ── Fine print ── */}
          <p className="text-[10px] text-white/25 text-center mt-4 leading-relaxed px-2">
            {t("sub_finePrint")}
          </p>

          {/* ── Links ── */}
          <div className="flex items-center justify-center gap-4 mt-5 pb-4">
            <button
              onClick={() => router.push("/terms")}
              className="text-[10px] text-white/30 underline underline-offset-2"
            >
              {t("sub_terms")}
            </button>
            <span className="text-white/10 text-[10px]">|</span>
            <button
              onClick={() => router.push("/privacy")}
              className="text-[10px] text-white/30 underline underline-offset-2"
            >
              {t("sub_privacy")}
            </button>
            <span className="text-white/10 text-[10px]">|</span>
            <button className="text-[10px] text-white/30 underline underline-offset-2">
              {t("sub_restore")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
