"use client";

import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase";
import { useState, useRef } from "react";

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, profile, isPro, subscription, signOut, loading, refreshProfile } = useAuth();
  const [portalLoading, setPortalLoading] = useState(false);

  /* ── Profile edit state ── */
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditName(profile?.display_name || "");
    setEditing(true);
  };

  const saveProfile = async () => {
    if (!user || !editName.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase.from("profiles").update({ display_name: editName.trim() }).eq("id", user.id);
      await refreshProfile();
      setEditing(false);
    } catch (e) {
      console.error("Save profile failed", e);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;

      // Upload (upsert to overwrite previous)
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: true });
      if (uploadErr) throw uploadErr;

      // Get public URL
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`; // cache bust

      // Update profile
      await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);
      await refreshProfile();
    } catch (e) {
      console.error("Avatar upload failed", e);
    } finally {
      setAvatarUploading(false);
    }
  };

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
            {/* Avatar — tap to change */}
            <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            <button
              onClick={() => avatarRef.current?.click()}
              className="cursor-pointer relative w-20 h-20 rounded-full bg-white/10 flex items-center justify-center overflow-hidden group"
              disabled={avatarUploading}
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[28px] font-bold text-white/60">
                  {(profile.display_name || profile.email || "U").charAt(0).toUpperCase()}
                </span>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                {avatarUploading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
              </div>
            </button>

            {/* Name + email — editable */}
            {editing ? (
              <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={t("profile_namePlaceholder" as any)}
                  className="w-full bg-white/[0.05] border border-white/[0.12] rounded-lg px-4 py-2.5 text-[14px] text-white text-center placeholder-white/25 outline-none focus:border-white/25"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") saveProfile(); }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="cursor-pointer px-4 py-2 text-[11px] text-white/40 border border-white/10 rounded-lg hover:text-white/60 transition-colors"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={saving || !editName.trim()}
                    className="cursor-pointer px-5 py-2 bg-white text-black text-[11px] font-bold rounded-lg disabled:opacity-30 hover:bg-white/90 transition-colors"
                  >
                    {saving ? t("loading") : t("save")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={startEdit}
                  className="cursor-pointer flex items-center gap-2 group"
                >
                  <h2 className="text-[16px] font-semibold text-white/90">
                    {profile.display_name || profile.email?.split("@")[0]}
                  </h2>
                  <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <p className="text-[11px] text-white/40">{profile.email}</p>
              </div>
            )}

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

                {/* Action button — receipt for lifetime, portal for recurring */}
                {subscription?.plan_type === "lifetime" ? (
                  subscription?.receipt_url && (
                    <a
                      href={subscription.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 mt-1 bg-white/[0.06] text-white/80 rounded-xl text-[12px] font-medium tracking-[0.5px] border border-white/10 transition-all active:scale-[0.98] text-center block"
                    >
                      {t("profile_viewReceipt" as Parameters<typeof t>[0])}
                    </a>
                  )
                ) : (
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
