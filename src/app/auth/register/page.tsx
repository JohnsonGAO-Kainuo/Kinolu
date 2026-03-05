"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";

export default function RegisterPage() {
  const router = useRouter();
  const { signUp, resendVerification } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
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
    setLoading(true);
    const { error: err } = await signUp(email, password, displayName || undefined);
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
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
          {t("auth_signUp")}
        </span>
        <div className="w-8" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-full max-w-sm">
          {success ? (
            /* ── Confirmation sent ── */
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                <span className="text-[28px]">✓</span>
              </div>
              <h2 className="text-[18px] font-bold text-white">
                {t("auth_checkEmail")}
              </h2>
              <p className="text-[12px] text-white/40 text-center max-w-[280px]">
                {t("auth_checkEmailDesc")}
              </p>
              <button
                onClick={() => router.push("/auth/login")}
                className="mt-4 px-6 py-2.5 bg-white text-black rounded-xl text-[12px] font-semibold tracking-[1px]"
              >
                {t("auth_backToLogin")}
              </button>
              {/* Resend verification email */}
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="mt-2 px-6 py-2 text-[12px] text-white/50 underline underline-offset-2 disabled:text-white/25 disabled:no-underline transition-colors"
              >
                {resendCooldown > 0
                  ? (t("auth_resendCooldown") as string).replace("{seconds}", String(resendCooldown))
                  : t("auth_resendEmail")}
              </button>
              {resendMsg && (
                <p className="text-[11px] text-green-400/80 text-center mt-1">{resendMsg}</p>
              )}
            </div>
          ) : (
            <>
              {/* Logo */}
              <div className="flex flex-col items-center mb-8">
                <img src="/logo-icon.png" alt="Kinolu" width={56} height={56} className="w-14 h-14 rounded-2xl mb-3" />
                <h2 className="text-[18px] font-bold text-white">
                  {t("auth_createAccount")}
                </h2>
                <p className="text-[12px] text-white/40 mt-1">
                  {t("auth_signUpDesc")}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder={t("auth_displayName")}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  className="w-full h-12 px-4 rounded-xl bg-white/[0.06] border border-white/10 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors"
                />
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
                  autoComplete="new-password"
                  minLength={6}
                  className="w-full h-12 px-4 rounded-xl bg-white/[0.06] border border-white/10 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors"
                />

                {error && (
                  <p className="text-[12px] text-red-400 text-center">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 mt-2 bg-white text-black rounded-xl text-[13px] font-bold tracking-wide disabled:opacity-50 active:opacity-80 transition-opacity"
                >
                  {loading ? t("loading") : t("auth_signUp")}
                </button>
              </form>

              {/* Login link */}
              <p className="text-center text-[12px] text-white/40 mt-6">
                {t("auth_hasAccount")}{" "}
                <button
                  onClick={() => router.push("/auth/login")}
                  className="text-white/70 underline underline-offset-2"
                >
                  {t("auth_signIn")}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
