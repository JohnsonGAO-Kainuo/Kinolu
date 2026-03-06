"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/components/AuthProvider";
import {
  fetchPosts,
  createPost,
  uploadCommunityImage,
  toggleLike,
  checkUserLikes,
  type Post,
} from "@/lib/supabase/community";

/* ═══════════════════════════════════════════════════════════
   /landing — Public Landing Page + Community
   Separate from the in-app home screen (/).
   ═══════════════════════════════════════════════════════════ */

const FEATURES = [
  { icon: "🎨", key: "landing_feat1Title" as const, descKey: "landing_feat1Desc" as const },
  { icon: "🎛️", key: "landing_feat2Title" as const, descKey: "landing_feat2Desc" as const },
  { icon: "🎞️", key: "landing_feat3Title" as const, descKey: "landing_feat3Desc" as const },
  { icon: "📷", key: "landing_feat4Title" as const, descKey: "landing_feat4Desc" as const },
  { icon: "✂️", key: "landing_feat5Title" as const, descKey: "landing_feat5Desc" as const },
  { icon: "📦", key: "landing_feat6Title" as const, descKey: "landing_feat6Desc" as const },
] as const;

const STEPS = [
  { num: "01", key: "landing_step1Title" as const, descKey: "landing_step1Desc" as const },
  { num: "02", key: "landing_step2Title" as const, descKey: "landing_step2Desc" as const },
  { num: "03", key: "landing_step3Title" as const, descKey: "landing_step3Desc" as const },
  { num: "04", key: "landing_step4Title" as const, descKey: "landing_step4Desc" as const },
] as const;

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

export default function LandingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();

  /* ── Community state ── */
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Load community posts ── */
  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const { posts: data } = await fetchPosts(1, 30);
      setPosts(data);
      if (user) {
        const ids = data.map((p) => p.id);
        const liked = await checkUserLikes(ids, user.id);
        setLikedSet(liked);
      }
    } catch (e) {
      console.error("Failed to load posts", e);
    } finally {
      setLoadingPosts(false);
    }
  }, [user]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  /* ── Like toggle ── */
  const handleLike = async (postId: string) => {
    if (!user) { router.push("/auth"); return; }
    const wasLiked = likedSet.has(postId);
    setLikedSet((prev) => {
      const next = new Set(prev);
      wasLiked ? next.delete(postId) : next.add(postId);
      return next;
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, likes_count: p.likes_count + (wasLiked ? -1 : 1) } : p,
      ),
    );
    try {
      await toggleLike(postId, user.id);
    } catch {
      setLikedSet((prev) => {
        const next = new Set(prev);
        wasLiked ? next.add(postId) : next.delete(postId);
        return next;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likes_count: p.likes_count + (wasLiked ? 1 : -1) } : p,
        ),
      );
    }
  };

  /* ── Image pick ── */
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  /* ── Publish post ── */
  const handlePublish = async () => {
    if (!user || !imageFile || !title.trim()) return;
    setPublishing(true);
    try {
      const imageUrl = await uploadCommunityImage(user.id, imageFile);
      await createPost(user.id, title.trim(), desc.trim(), imageUrl);
      setShowForm(false);
      setTitle("");
      setDesc("");
      setImageFile(null);
      setImagePreview(null);
      await loadPosts();
    } catch (e) {
      console.error("Publish failed", e);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-black text-white overflow-y-auto">
      {/* ─── Nav Bar ─── */}
      <nav className="fixed top-0 left-0 w-full z-50 safe-top bg-black/60 backdrop-blur-md border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-icon-sm.png" alt="Kinolu" width={28} height={28} className="w-7 h-7" />
            <span className="text-[13px] font-bold tracking-[4px] text-white/90">KINOLU</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#community" className="text-[10px] tracking-[1.5px] text-white/40 uppercase hover:text-white/70 transition-colors">
              {t("community_title")}
            </a>
            <button
              onClick={() => router.push("/")}
              className="text-[10px] tracking-[1.5px] text-white/50 border border-white/15 rounded-full px-3 py-1 hover:text-white/80 transition-colors uppercase"
            >
              {t("share_openInApp")}
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="relative w-full h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: "url(/heroes/editor.jpg)" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black" />
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-[42px] md:text-[64px] font-black tracking-[6px] leading-tight uppercase">
            {t("landing_heroTitle")}
          </h1>
          <p className="mt-4 text-[14px] md:text-[16px] text-white/60 tracking-wide leading-relaxed max-w-md mx-auto">
            {t("landing_heroDesc")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center">
            <button
              onClick={() => router.push("/editor")}
              className="px-8 py-3 bg-white text-black text-[12px] font-bold tracking-[3px] rounded-full uppercase hover:bg-white/90 transition-colors"
            >
              {t("landing_ctaEditor")}
            </button>
            <button
              onClick={() => router.push("/camera")}
              className="px-8 py-3 border border-white/25 text-[12px] font-bold tracking-[3px] rounded-full uppercase text-white/80 hover:bg-white/10 transition-colors"
            >
              {t("landing_ctaCamera")}
            </button>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30">
            <path d="M7 13l5 5 5-5M7 7l5 5 5-5" />
          </svg>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section className="max-w-6xl mx-auto px-5 py-20">
        <h2 className="text-[11px] tracking-[4px] text-white/40 uppercase text-center mb-2">{t("landing_featuresLabel")}</h2>
        <h3 className="text-[24px] md:text-[32px] font-bold tracking-[2px] text-center mb-12">{t("landing_featuresTitle")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.key} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.05] transition-colors">
              <div className="text-[28px] mb-3">{f.icon}</div>
              <h4 className="text-[13px] font-semibold tracking-wide mb-1">{t(f.key)}</h4>
              <p className="text-[11px] text-white/40 leading-relaxed">{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="text-[11px] tracking-[4px] text-white/40 uppercase text-center mb-2">{t("landing_howLabel")}</h2>
        <h3 className="text-[24px] md:text-[32px] font-bold tracking-[2px] text-center mb-12">{t("landing_howTitle")}</h3>
        <div className="space-y-6">
          {STEPS.map((s) => (
            <div key={s.num} className="flex gap-5 items-start">
              <div className="text-[28px] font-black text-white/10 tracking-tight min-w-[48px]">{s.num}</div>
              <div>
                <h4 className="text-[14px] font-semibold tracking-wide mb-1">{t(s.key)}</h4>
                <p className="text-[12px] text-white/40 leading-relaxed">{t(s.descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Example Gallery ─── */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <h2 className="text-[11px] tracking-[4px] text-white/40 uppercase text-center mb-2">{t("landing_galleryLabel")}</h2>
        <h3 className="text-[24px] md:text-[32px] font-bold tracking-[2px] text-center mb-8">{t("landing_galleryTitle")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {["/heroes/camera.jpg", "/heroes/editor.jpg", "/heroes/presets.jpg"].map((src, i) => (
            <div key={i} className="rounded-2xl overflow-hidden aspect-[4/3] bg-white/5">
              <img src={src} alt={`Kinolu example ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
         Community Section — integrated into landing page
         ═══════════════════════════════════════════════════════════ */}
      <section id="community" className="max-w-6xl mx-auto px-5 py-20 scroll-mt-16">
        <h2 className="text-[11px] tracking-[4px] text-white/40 uppercase text-center mb-2">{t("community_title")}</h2>
        <h3 className="text-[24px] md:text-[32px] font-bold tracking-[2px] text-center mb-3">{t("landing_communityTitle")}</h3>
        <p className="text-[13px] text-white/40 text-center mb-8 max-w-md mx-auto">{t("community_desc")}</p>

        {/* Create post button */}
        <div className="text-center mb-8">
          {user ? (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-6 py-2.5 bg-white text-black text-[11px] font-bold tracking-[2px] uppercase rounded-full hover:bg-white/90 transition-colors"
            >
              {showForm ? t("cancel") : t("community_createPost")}
            </button>
          ) : (
            <button
              onClick={() => router.push("/auth")}
              className="text-[12px] text-white/30 underline hover:text-white/60 transition-colors"
            >
              {t("community_signInToPost")}
            </button>
          )}
        </div>

        {/* Create post form */}
        {showForm && (
          <div className="max-w-xl mx-auto mb-10">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 space-y-4">
              <input
                type="text"
                placeholder={t("community_postTitlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-[13px] text-white placeholder-white/25 outline-none focus:border-white/20"
              />
              <textarea
                placeholder={t("community_postDescPlaceholder")}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-[13px] text-white placeholder-white/25 outline-none focus:border-white/20 resize-none"
              />
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden">
                  <img src={imagePreview} alt="preview" className="w-full max-h-[300px] object-cover" />
                  <button
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white/70 hover:text-white"
                  >✕</button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-8 border-2 border-dashed border-white/10 rounded-xl text-[12px] text-white/30 hover:text-white/50 hover:border-white/20 transition-colors"
                >
                  📷 {t("community_uploadImage")}
                </button>
              )}
              <button
                onClick={handlePublish}
                disabled={publishing || !imageFile || !title.trim()}
                className="w-full py-3 bg-white text-black text-[12px] font-bold tracking-[2px] uppercase rounded-full disabled:opacity-30 hover:bg-white/90 transition-colors"
              >
                {publishing ? t("community_publishing") : t("community_publish")}
              </button>
            </div>
          </div>
        )}

        {/* Posts grid */}
        {loadingPosts ? (
          <div className="text-center py-16">
            <div className="inline-block w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-[13px] text-white/25 py-16">{t("community_noPostsYet")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((post) => (
              <article
                key={post.id}
                className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden hover:bg-white/[0.04] transition-colors group"
              >
                <button
                  onClick={() => router.push(`/community/${post.id}`)}
                  className="w-full aspect-[4/3] overflow-hidden cursor-pointer"
                >
                  <img
                    src={post.image_url}
                    alt={post.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </button>
                <div className="p-4">
                  <button onClick={() => router.push(`/community/${post.id}`)} className="text-left w-full">
                    <h4 className="text-[14px] font-semibold tracking-wide line-clamp-1">{post.title}</h4>
                  </button>
                  {post.description && (
                    <p className="text-[11px] text-white/40 mt-1 line-clamp-2">{post.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-3 text-[10px] text-white/30">
                    <span>{post.author_name || post.author_email?.split("@")[0] || "Anonymous"}</span>
                    <span>{timeAgo(post.created_at, t)}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.06]">
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-1.5 text-[11px] transition-colors ${likedSet.has(post.id) ? "text-red-400" : "text-white/30 hover:text-white/60"}`}
                    >
                      <span>{likedSet.has(post.id) ? "♥" : "♡"}</span>
                      <span>{post.likes_count}</span>
                    </button>
                    <button
                      onClick={() => router.push(`/community/${post.id}`)}
                      className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors"
                    >
                      <span>💬</span>
                      <span>{post.comments_count}</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ─── Final CTA ─── */}
      <section className="max-w-4xl mx-auto px-5 py-20 text-center">
        <h2 className="text-[32px] md:text-[48px] font-black tracking-[4px] uppercase mb-4">{t("landing_finalTitle")}</h2>
        <p className="text-[13px] text-white/40 mb-8">{t("landing_finalDesc")}</p>
        <button
          onClick={() => router.push("/editor")}
          className="px-10 py-3.5 bg-white text-black text-[12px] font-bold tracking-[3px] rounded-full uppercase hover:bg-white/90 transition-colors"
        >
          {t("landing_ctaStart")}
        </button>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.06] py-10 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo-icon-sm.png" alt="" width={20} height={20} />
            <span className="text-[11px] tracking-[3px] text-white/40 font-bold">KINOLU</span>
          </div>
          <div className="flex gap-6 text-[10px] tracking-[1.5px] text-white/30 uppercase">
            <button onClick={() => router.push("/privacy")} className="hover:text-white/60 transition-colors">{t("sidebar_privacy")}</button>
            <button onClick={() => router.push("/terms")} className="hover:text-white/60 transition-colors">{t("sidebar_terms")}</button>
            <button onClick={() => router.push("/feedback")} className="hover:text-white/60 transition-colors">{t("sidebar_feedback")}</button>
          </div>
          <p className="text-[10px] text-white/20">© 2026 Kainuo Tech</p>
        </div>
      </footer>
    </div>
  );
}
