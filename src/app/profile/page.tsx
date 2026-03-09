"use client";

import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase";
import { useState } from "react";

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, profile, isPro, subscription, signOut, loading } = useAuth();
  const [portalLoading, setPortalLoading] = useState(false);

  const openCustomerPortal = async () => {
    setPortalLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-portal-session`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ return_url: window.location.href }),
        },
      );

      if (!res.ok) throw new Error("Portal session failed");
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error("Portal error:", err);
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-black">
      <header className="flex items-center justify-between h-[44px] px-4 safe-top">
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
          {t("profile_title")}
        </span>
        <div className="w-8" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
        {loading ? (
          <span className="text-[12px] text-white/40">{t("loading")}</span>
        ) : user && profile ? (
          /* ── Logged in ── */
          <>
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-[28px] font-bold text-white/60">
                {(profile.display_name || profile.email || "U")
                  .charAt(0)
                  .toUpperCase()}
              </span>
            </div>

            {/* Name + email */}
            <div className="flex flex-col items-center gap-1">
              <h2 className="text-[16px] font-semibold text-white/90">
                {profile.display_name || profile.email?.split("@")[0]}
              </h2>
              <p className="text-[11px] text-white/40">{profile.email}</p>
            </div>

            {/* Subscription info */}
            {isPro ? (
              <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3">
                {/* Plan badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-bold tracking-wider uppercase text-white">
                      PRO
                    </div>
                    <span className="text-[13px] font-semibold text-white/90">
                      {subscription?.plan_type === "lifetime"
                        ? t("profile_planLifetime" as Parameters<typeof t>[0])
                        : subscription?.plan_type === "annual"
                          ? t("profile_planAnnual" as Parameters<typeof t>[0])
                          : t("profile_planMonthly" as Parameters<typeof t>[0])}
                    </span>
                  </div>
                  <span className={`text-[10px] font-semibold tracking-wider uppercase ${
                    subscription?.status === "active" ? "text-emerald-400" :
                    subscription?.status === "past_due" ? "text-amber-400" : "text-white/40"
                  }`}>
                    {subscription?.status === "active"
                      ? t("profile_status_active" as Parameters<typeof t>[0])
                      : subscription?.status === "past_due"
                        ? t("profile_status_past_due" as Parameters<typeof t>[0])
                        : t("profile_status_canceled" as Parameters<typeof t>[0])}
                  </span>
                </div>

                {/* Expiry info */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/40">
                    {t("profile_expires" as Parameters<typeof t>[0])}
                  </span>
                  <span className="text-white/70 font-medium">
                    {subscription?.plan_type === "lifetime"
                      ? t("profile_lifetime_forever" as Parameters<typeof t>[0])
                      : subscription?.current_period_end
                        ? new Date(subscription.current_period_end).toLocaleDateString()
                        : "—"}
                  </span>
                </div>

                {/* Manage button — only show for recurring plans */}
                {subscription?.plan_type !== "lifetime" && (
                  <button
                    onClick={openCustomerPortal}
                    disabled={portalLoading}
                    className="w-full py-2.5 mt-1 bg-white/[0.06] text-white/80 rounded-xl text-[12px] font-medium tracking-[0.5px] border border-white/10 disabled:opacity-40 transition-all active:scale-[0.98]"
                  >
                    {portalLoading ? t("loading") : t("profile_manageSubscription")}
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="px-4 py-1.5 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-white/[0.04] text-white/40 border border-white/8">
                  {t("sub_free")}
                </div>
                <button
                  onClick={() => router.push("/subscription")}
                  className="px-6 py-2.5 bg-white text-black rounded-xl text-[12px] font-semibold tracking-[1px]"
                >
                  {t("profile_upgradePro")}
                </button>
              </>
            )}

            <button
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
              className="mt-2 px-6 py-2.5 bg-white/[0.06] text-white/60 rounded-xl text-[12px] font-medium tracking-[1px] border border-white/10"
            >
              {t("profile_signOut")}
            </button>
          </>
        ) : (
          /* ── Not logged in ── */
          <>
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-white/30"
              >
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-[16px] font-semibold text-white/80">
                {t("profile_signInToSync")}
              </h2>
              <p className="text-[11px] text-white/40 text-center max-w-[260px]">
                {t("profile_signInDesc")}
              </p>
            </div>
            <button
              onClick={() => router.push("/auth/login")}
              className="mt-4 px-6 py-2.5 bg-white text-black rounded-xl text-[12px] font-semibold tracking-[1px]"
            >
              {t("profile_signIn")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
