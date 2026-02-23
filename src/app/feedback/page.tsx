"use client";

import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";
import { useState } from "react";

export default function FeedbackPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!feedback.trim()) return;
    // TODO: Connect to Supabase or feedback service
    console.log("Feedback:", feedback);
    setSubmitted(true);
    setTimeout(() => {
      setFeedback("");
      setSubmitted(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col w-full h-full bg-black">
      <header className="flex items-center justify-between h-[44px] px-4 safe-top">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center text-white/60">
          <IconBack size={20} />
        </button>
        <span className="text-[12px] font-semibold tracking-[2.5px] uppercase text-white/70">Feedback</span>
        <div className="w-8" />
      </header>

      <div className="flex-1 flex flex-col px-5 py-6">
        <div className="max-w-md mx-auto w-full flex flex-col gap-4">
          <p className="text-[12px] text-white/60 leading-relaxed">
            Help us improve Kinolu! Share your thoughts, report bugs, or suggest features.
          </p>

          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Your feedback..."
            className="w-full h-40 px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-[13px] text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-white/20 transition-colors"
          />

          <button
            onClick={handleSubmit}
            disabled={!feedback.trim() || submitted}
            className="py-2.5 bg-white text-black rounded-xl text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {submitted ? "✓ Sent" : "Send Feedback"}
          </button>

          <div className="mt-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
            <h3 className="text-[11px] font-semibold text-white/70 mb-2">Alternative Contact</h3>
            <p className="text-[11px] text-white/40">feedback@kinolu.app</p>
          </div>
        </div>
      </div>
    </div>
  );
}
