"use client";

import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";

export default function SubscriptionPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col w-full h-full bg-black">
      <header className="flex items-center justify-between h-[44px] px-4 safe-top">
        <button onClick={() => { if (window.history.length > 1) router.back(); else router.push("/"); }} className="w-8 h-8 flex items-center justify-center text-white/60">
          <IconBack size={20} />
        </button>
        <span className="text-[12px] font-semibold tracking-[2.5px] uppercase text-white/70">Subscription</span>
        <div className="w-8" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-md mx-auto flex flex-col gap-4">
          {/* Free tier */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-bold text-white/90">Free</h3>
              <span className="text-[11px] text-white/40 tracking-[1px]">CURRENT</span>
            </div>
            <ul className="space-y-2 text-[12px] text-white/60">
              <li>• Unlimited local presets</li>
              <li>• All color transfer methods</li>
              <li>• LUT export (.cube)</li>
              <li>• Full editor suite</li>
            </ul>
          </div>

          {/* Pro tier */}
          <div className="rounded-2xl border border-white/20 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-bold text-white">Pro</h3>
              <span className="text-[13px] font-semibold text-white/90">$4.99/mo</span>
            </div>
            <ul className="space-y-2 text-[12px] text-white/70 mb-4">
              <li>• Everything in Free</li>
              <li>• Cloud sync for presets</li>
              <li>• Batch processing</li>
              <li>• Priority support</li>
            </ul>
            <button className="w-full py-2.5 bg-white text-black rounded-xl text-[12px] font-semibold">
              Upgrade to Pro
            </button>
          </div>

          <p className="text-[10px] text-white/30 text-center mt-4">Coming soon</p>
        </div>
      </div>
    </div>
  );
}
