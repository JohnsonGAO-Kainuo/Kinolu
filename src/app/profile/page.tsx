"use client";

import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";

export default function ProfilePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col w-full h-full bg-black">
      <header className="flex items-center justify-between h-[44px] px-4 safe-top">
        <button onClick={() => { if (window.history.length > 1) router.back(); else router.push("/"); }} className="w-8 h-8 flex items-center justify-center text-white/60">
          <IconBack size={20} />
        </button>
        <span className="text-[12px] font-semibold tracking-[2.5px] uppercase text-white/70">Profile</span>
        <div className="w-8" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-[16px] font-semibold text-white/80">Sign in to sync</h2>
          <p className="text-[11px] text-white/40 text-center max-w-[260px]">
            Save your presets to the cloud and access them across all your devices
          </p>
        </div>
        <button className="mt-4 px-6 py-2.5 bg-white text-black rounded-xl text-[12px] font-semibold tracking-[1px]">
          Sign In
        </button>
        <span className="text-[10px] text-white/25 mt-2">Coming soon</span>
      </div>
    </div>
  );
}
