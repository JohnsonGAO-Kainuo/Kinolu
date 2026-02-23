"use client";

import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col w-full h-full bg-black">
      <header className="flex items-center justify-between h-[44px] px-4 safe-top">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center text-white/60">
          <IconBack size={20} />
        </button>
        <span className="text-[12px] font-semibold tracking-[2.5px] uppercase text-white/70">Privacy Policy</span>
        <div className="w-8" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="max-w-2xl mx-auto prose prose-invert prose-sm">
          <p className="text-[11px] text-white/40 mb-4">Last updated: February 23, 2026</p>
          
          <h2 className="text-[14px] font-bold text-white/90 mt-6 mb-3">Data Collection</h2>
          <p className="text-[12px] text-white/60 leading-relaxed mb-4">
            Kinolu processes all photos locally on your device. We do not upload, store, or have access to your photos unless you explicitly enable cloud sync.
          </p>

          <h2 className="text-[14px] font-bold text-white/90 mt-6 mb-3">Local Storage</h2>
          <p className="text-[12px] text-white/60 leading-relaxed mb-4">
            Generated presets and LUT files are stored locally in your browser. You can export or delete them at any time.
          </p>

          <h2 className="text-[14px] font-bold text-white/90 mt-6 mb-3">Analytics</h2>
          <p className="text-[12px] text-white/60 leading-relaxed mb-4">
            We use privacy-respecting analytics to understand how Kinolu is used. No personal information is collected.
          </p>

          <h2 className="text-[14px] font-bold text-white/90 mt-6 mb-3">Contact</h2>
          <p className="text-[12px] text-white/60 leading-relaxed">
            For questions about privacy, please contact us at privacy@kinolu.app
          </p>
        </div>
      </div>
    </div>
  );
}
