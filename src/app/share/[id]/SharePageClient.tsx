"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { fetchPost, type Post } from "@/lib/supabase/community";

import {
  IconHeart, IconComment,
} from "@/components/icons";

/* ═══════════════════════════════════════════════════════════
   /share/[id] — Client component for public share view
   ═══════════════════════════════════════════════════════════ */

function timeAgo(dateStr: string, t: (k: any) => string): string {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return t("community_justNow");
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${t("community_ago")}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${t("community_ago")}`;
  const d = Math.floor(h / 24);
  return `${d}d ${t("community_ago")}`;
}

export default function SharePageClient({ id }: { id: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await fetchPost(id);
      setPost(p);
    } catch (e) {
      console.error("Load failed", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-white/40">
        <p className="text-[14px] mb-4">{t("share_postNotFound")}</p>
        <button onClick={() => router.push("/")} className="text-[12px] underline hover:text-white/60">
          ← {t("share_openInApp")}
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/[0.06] safe-top">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-icon-sm.png" alt="" width={24} height={24} />
            <span className="text-[12px] font-bold tracking-[3px] text-white/80">KINOLU</span>
          </div>
          <button
            onClick={() => router.push(`/community/${id}`)}
            className="px-4 py-1.5 border border-white/20 rounded-full text-[10px] font-bold tracking-[1.5px] uppercase text-white/60 hover:bg-white/10 transition-colors"
          >
            {t("share_openInApp")}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8">
        {/* Image */}
        <div className="rounded-2xl overflow-hidden bg-white/5 mb-6">
          <img src={post.image_url} alt={post.title} className="w-full max-h-[75vh] object-contain" />
        </div>

        {/* Info */}
        <h1 className="text-[24px] font-bold tracking-wide">{post.title}</h1>
        {post.description && (
          <p className="text-[13px] text-white/50 mt-2 leading-relaxed">{post.description}</p>
        )}
        <div className="flex items-center gap-2 mt-4 text-[11px] text-white/30">
          <span>{t("share_by")}</span>
          <span className="text-white/50">{post.author_name || "Anonymous"}</span>
          <span>·</span>
          <span>{timeAgo(post.created_at, t)}</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-5 py-4 border-y border-white/[0.06] text-[13px] text-white/30">
          <span className="flex items-center gap-1"><IconHeart size={14} /> {post.likes_count}</span>
          <span className="flex items-center gap-1"><IconComment size={14} /> {post.comments_count}</span>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <p className="text-[12px] text-white/30 mb-4">{t("landing_heroDesc")}</p>
          <button
            onClick={() => router.push("/editor")}
            className="px-8 py-3 bg-white text-black text-[12px] font-bold tracking-[3px] rounded-full uppercase hover:bg-white/90 transition-colors"
          >
            {t("landing_ctaStart")}
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 px-5 mt-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] text-white/20">© 2026 Kainuo Innovision Tech Co., Limited</p>
        </div>
      </footer>
    </div>
  );
}
