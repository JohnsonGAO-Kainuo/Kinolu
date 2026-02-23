"use client";

import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";

export default function TermsPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col w-full h-full bg-black">
      <header className="flex items-center justify-between h-[44px] px-4 safe-top">
        <button onClick={() => { if (window.history.length > 1) router.back(); else router.push("/"); }} className="w-8 h-8 flex items-center justify-center text-white/60">
          <IconBack size={20} />
        </button>
        <span className="text-[12px] font-semibold tracking-[2.5px] uppercase text-white/70">Terms of Service</span>
        <div className="w-8" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="max-w-2xl mx-auto prose prose-invert prose-sm">
          <p className="text-[11px] text-white/40 mb-4">Last updated: February 23, 2026</p>
          
          <h2 className="text-[14px] font-bold text-white/90 mt-6 mb-3">Acceptance of Terms</h2>
          <p className="text-[12px] text-white/60 leading-relaxed mb-4">
            By using Kinolu, you agree to these terms. If you do not agree, please do not use the service.
          </p>

          <h2 className="text-[14px] font-bold text-white/90 mt-6 mb-3">Use of Service</h2>
          <p className="text-[12px] text-white/60 leading-relaxed mb-4">
            Kinolu is provided as-is for photo color grading. You are responsible for ensuring you have rights to any photos you process.
          </p>

          <h2 className="text-[14px] font-bold text-white/90 mt-6 mb-3">Limitations</h2>
          <p className="text-[12px] text-white/60 leading-relaxed mb-4">
            We are not liable for any loss of data or images processed through Kinolu. Always keep backups of your original photos.
          </p>

          <h2 className="text-[14px] font-bold text-white/90 mt-6 mb-3">Changes</h2>
          <p className="text-[12px] text-white/60 leading-relaxed">
            We may update these terms at any time. Continued use constitutes acceptance of updated terms.
          </p>
        </div>
      </div>
    </div>
  );
}
