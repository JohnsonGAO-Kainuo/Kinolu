"use client";

import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase";

export default function FeedbackPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!feedback.trim()) return;
    try {
      const supabase = createClient();
      await supabase.from("feedback").insert({
        user_id: user?.id ?? null,
        email: user?.email ?? null,
        message: feedback.trim(),
      });
    } catch {
      // Fallback: if table doesn't exist, just log
      console.log("Feedback:", feedback);
    }
    setSubmitted(true);
    setTimeout(() => {
      setFeedback("");
      setSubmitted(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col w-full h-full bg-black">
      <header className="flex items-center justify-between h-[44px] px-4 safe-top">
        <button onClick={() => { if (window.history.length > 1) router.back(); else router.push("/"); }} className="w-8 h-8 flex items-center justify-center text-white/60">
          <IconBack size={20} />
        </button>
        <span className="text-[12px] font-semibold tracking-[2.5px] uppercase text-white/70">{t("feedback_title")}</span>
        <div className="w-8" />
      </header>

      <div className="flex-1 flex flex-col px-5 py-6">
        <div className="max-w-md mx-auto w-full flex flex-col gap-4">
          <p className="text-[12px] text-white/60 leading-relaxed">
            {t("feedback_desc")}
          </p>

          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={t("feedback_placeholder")}
            className="w-full h-40 px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-[13px] text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-white/20 transition-colors"
          />

          <button
            onClick={handleSubmit}
            disabled={!feedback.trim() || submitted}
            className="py-2.5 bg-white text-black rounded-xl text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {submitted ? t("feedback_sent") : t("feedback_send")}
          </button>

          <div className="mt-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
            <h3 className="text-[11px] font-semibold text-white/70 mb-2">{t("feedback_altContact")}</h3>
            <a href="mailto:hello@kinolu.cam" className="text-[11px] text-white/40 underline hover:text-white/60 transition-colors">hello@kinolu.cam</a>
          </div>
        </div>
      </div>
    </div>
  );
}
