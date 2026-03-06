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
   /community — Community Gallery
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

export default function CommunityPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Load posts ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { posts: data } = await fetchPosts(1, 50);
      setPosts(data);
      if (user) {
        const ids = data.map((p) => p.id);
        const liked = await checkUserLikes(ids, user.id);
        setLikedSet(liked);
      }
    } catch (e) {
      console.error("Failed to load posts", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  /* ── Handle like toggle ── */
  const handleLike = async (postId: string) => {
    if (!user) { router.push("/auth"); return; }
    const wasLiked = likedSet.has(postId);
    // Optimistic update
    setLikedSet((prev) => {
      const next = new Set(prev);
      wasLiked ? next.delete(postId) : next.add(postId);
      return next;
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likes_count: p.likes_count + (wasLiked ? -1 : 1) }
          : p,
      ),
    );
    try {
      await toggleLike(postId, user.id);
    } catch {
      // Revert on error
      setLikedSet((prev) => {
        const next = new Set(prev);
        wasLiked ? next.add(postId) : next.delete(postId);
        return next;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likes_count: p.likes_count + (wasLiked ? 1 : -1) }
            : p,
        ),
      );
    }
  };

  /* ── Handle image pick ── */
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
      await load();
    } catch (e) {
      console.error("Publish failed", e);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-black text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/[0.06] safe-top">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <button onClick={() => router.push("/")} className="text-white/50 hover:text-white transition-colors text-[13px]">
            ← {t("back")}
          </button>
          <h1 className="text-[14px] font-bold tracking-[3px] uppercase">{t("community_title")}</h1>
          <div className="w-16" />
        </div>
      </header>

      {/* ── Intro + Create Button ── */}
      <div className="max-w-6xl mx-auto px-5 py-8">
        <p className="text-[13px] text-white/40 text-center mb-6">{t("community_desc")}</p>
        {user ? (
          <div className="text-center">
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-6 py-2.5 bg-white text-black text-[11px] font-bold tracking-[2px] uppercase rounded-full hover:bg-white/90 transition-colors"
            >
              {showForm ? t("cancel") : t("community_createPost")}
            </button>
          </div>
        ) : (
          <p className="text-center text-[12px] text-white/30">
            <button onClick={() => router.push("/auth")} className="underline hover:text-white/60">{t("community_signInToPost")}</button>
          </p>
        )}
      </div>

      {/* ── Create Post Form ── */}
      {showForm && (
        <div className="max-w-xl mx-auto px-5 pb-8">
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

      {/* ── Posts Grid ── */}
      <div className="max-w-6xl mx-auto px-5 pb-16">
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-[13px] text-white/25 py-20">{t("community_noPostsYet")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((post) => (
              <article
                key={post.id}
                className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden hover:bg-white/[0.04] transition-colors group"
              >
                {/* Image */}
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

                {/* Info */}
                <div className="p-4">
                  <button onClick={() => router.push(`/community/${post.id}`)} className="text-left w-full">
                    <h3 className="text-[14px] font-semibold tracking-wide line-clamp-1">{post.title}</h3>
                  </button>
                  {post.description && (
                    <p className="text-[11px] text-white/40 mt-1 line-clamp-2">{post.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-3 text-[10px] text-white/30">
                    <span>{post.author_name || post.author_email?.split("@")[0] || "Anonymous"}</span>
                    <span>{timeAgo(post.created_at, t)}</span>
                  </div>
                  {/* Actions */}
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
      </div>
    </div>
  );
}
