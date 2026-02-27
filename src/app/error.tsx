"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Kinolu error boundary:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-black gap-6 px-8">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
        <span className="text-[24px]">⚠</span>
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-[16px] font-semibold text-white/80">
          Something went wrong
        </h2>
        <p className="text-[12px] text-white/40 max-w-[280px] leading-relaxed">
          An unexpected error occurred. Please try again.
        </p>
      </div>
      <button
        onClick={reset}
        className="px-6 py-2.5 bg-white text-black rounded-xl text-[12px] font-semibold tracking-wider active:scale-[0.98] transition-all"
      >
        Try Again
      </button>
    </div>
  );
}
