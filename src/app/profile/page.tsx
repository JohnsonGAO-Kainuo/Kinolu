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

            {/* Subscription badge */}
            <div
              className={`px-4 py-1.5 rounded-full text-[11px] font-semibold tracking-wider uppercase ${
                isPro
                  ? "bg-white/10 text-white border border-white/20"
                  : "bg-white/[0.04] text-white/40 border border-white/8"
              }`}
            >
              {isPro ? `PRO · ${subscription?.plan_type || ""}` : t("sub_free")}
            </div>

            {/* Actions */}
            {!isPro && (
              <button
                onClick={() => router.push("/subscription")}
                className="px-6 py-2.5 bg-white text-black rounded-xl text-[12px] font-semibold tracking-[1px]"
              >
                {t("profile_upgradePro")}
              </button>
            )}

            {isPro && (
              <button
                onClick={openCustomerPortal}
                disabled={portalLoading}
                className="px-6 py-2.5 bg-white/[0.06] text-white/80 rounded-xl text-[12px] font-medium tracking-[1px] border border-white/10 disabled:opacity-40 transition-all active:scale-[0.98]"
              >
                {portalLoading ? t("loading") : t("profile_manageSubscription")}
              </button>
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
