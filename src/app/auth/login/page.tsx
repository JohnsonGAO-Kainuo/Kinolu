"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, resetPassword, resendVerification, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || !email) return;
    const { error: err } = await resendVerification(email);
    if (err) {
      setResendMsg(err);
    } else {
      setResendMsg(t("auth_resendSent"));
    }
    setResendCooldown(60);
    setTimeout(() => setResendMsg(null), 4000);
  }, [email, resendCooldown, resendVerification, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEmailNotVerified(false);
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      // Detect unverified email error
      const isNotConfirmed = err.toLowerCase().includes("email not confirmed") || err.toLowerCase().includes("not confirmed");
      setEmailNotVerified(isNotConfirmed);
      setError(err);
      setLoading(false);
    } else {
      router.push("/profile");
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-black">
      {/* Header */}
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
          {t("auth_signIn")}
        </span>
        <div className="w-8" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <img src="/logo-icon.png" alt="Kinolu" width={56} height={56} className="w-14 h-14 rounded-2xl mb-3" />
            <h2 className="text-[18px] font-bold text-white">
              {t("auth_welcomeBack")}
            </h2>
            <p className="text-[12px] text-white/40 mt-1">
              {t("auth_signInDesc")}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder={t("auth_email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full h-12 px-4 rounded-xl bg-white/[0.06] border border-white/10 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors"
            />
            <input
              type="password"
              placeholder={t("auth_password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              minLength={6}
              className="w-full h-12 px-4 rounded-xl bg-white/[0.06] border border-white/10 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors"
            />

            {/* Forgot password */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  if (!email.trim()) { setError(t("auth_enterEmailFirst")); return; }
                  setLoading(true); setError(null);
                  const { error: err } = await resetPassword(email.trim());
                  setLoading(false);
                  if (err) { setError(err); } else { setResetSent(true); }
                }}
                className="text-[11px] text-white/40 hover:text-white/60 transition-colors"
              >
                {t("auth_forgotPassword")}
              </button>
            </div>

            {resetSent && (
              <div className="bg-emerald-900/30 border border-emerald-500/20 rounded-xl px-4 py-3 text-center">
                <p className="text-[12px] text-emerald-300">{t("auth_resetEmailSent")}</p>
                <p className="text-[10px] text-emerald-300/60 mt-1">{t("auth_resetEmailSentDesc")}</p>
              </div>
            )}

            {error && (
              <p className="text-[12px] text-red-400 text-center">{error}</p>
            )}

            {/* Resend verification for unverified users */}
            {emailNotVerified && (
              <div className="bg-amber-900/20 border border-amber-500/20 rounded-xl px-4 py-3 text-center">
                <p className="text-[12px] text-amber-300 mb-2">{t("auth_emailNotVerified")}</p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="text-[12px] text-amber-200 underline underline-offset-2 disabled:text-amber-200/40 disabled:no-underline transition-colors"
                >
                  {resendCooldown > 0
                    ? (t("auth_resendCooldown") as string).replace("{seconds}", String(resendCooldown))
                    : t("auth_resendVerification")}
                </button>
                {resendMsg && (
                  <p className="text-[11px] text-green-400/80 mt-1.5">{resendMsg}</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || authLoading}
              className="w-full h-12 mt-2 bg-white text-black rounded-xl text-[13px] font-bold tracking-wide disabled:opacity-50 active:opacity-80 transition-opacity"
            >
              {loading ? t("loading") : t("auth_signIn")}
            </button>
          </form>

          {/* Register link */}
          <p className="text-center text-[12px] text-white/40 mt-6">
            {t("auth_noAccount")}{" "}
            <button
              onClick={() => router.push("/auth/register")}
              className="text-white/70 underline underline-offset-2"
            >
              {t("auth_signUp")}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
