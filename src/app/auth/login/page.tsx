"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) {
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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center mb-3">
              <span className="text-[20px] font-bold text-white">K</span>
            </div>
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

            {error && (
              <p className="text-[12px] text-red-400 text-center">{error}</p>
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
