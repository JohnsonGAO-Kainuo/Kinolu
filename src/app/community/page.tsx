"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /community → redirect to /landing/community
 * Prevents 404 when users navigate here directly or via back-button history.
 */
export default function CommunityRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/landing/community");
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
    </div>
  );
}
