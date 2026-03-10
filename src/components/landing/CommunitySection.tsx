"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/components/AuthProvider";
import {
  IconClose, IconHeart, IconHeartFilled, IconComment, IconUploadImage,
} from "@/components/icons";
import {
  fetchPosts,
  createPost,
  deletePost,
  uploadCommunityImage,
  toggleLike,
  checkUserLikes,
  type Post,
} from "@/lib/supabase/community";

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

interface CommunitySectionProps {
  standalone?: boolean;
}

export default function CommunitySection({ standalone }: CommunitySectionProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();

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

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const { posts: data } = await fetchPosts(0, 30);
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

  const handleLike = async (postId: string) => {
    if (!user) { router.push("/auth/login"); return; }
    const wasLiked = likedSet.has(postId);
    setLikedSet((prev) => {
      const next = new Set(prev);
      wasLiked ? next.delete(postId) : next.add(postId);
      return next;
    });
    setPosts((prev) =>
      prev.map((p) => p.id === postId ? { ...p, likes_count: p.likes_count + (wasLiked ? -1 : 1) } : p),
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
        prev.map((p) => p.id === postId ? { ...p, likes_count: p.likes_count + (wasLiked ? 1 : -1) } : p),
      );
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePublish = async () => {
    if (!user || !title.trim()) return;
    setPublishing(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile) imageUrl = await uploadCommunityImage(user.id, imageFile);
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

  /* ── Delete own post from listing ── */
  const handleDeletePost = async (postId: string) => {
    if (!confirm(t("community_deleteConfirm"))) return;
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  return (
    <section id="community" className={`max-w-6xl mx-auto px-5 scroll-mt-20 ${standalone ? "py-28" : "py-24"}`}>
      <h2 className="text-[10px] tracking-[4px] text-white/30 uppercase text-center mb-2">
        {t("community_title")}
      </h2>
      <h3 className="text-[24px] md:text-[36px] font-bold tracking-[2px] text-center mb-3">
        {t("landing_communityTitle")}
      </h3>
      <p className="text-[13px] text-white/40 text-center mb-10 max-w-md mx-auto">
        {t("community_desc")}
      </p>

      {/* Create post / Feedback buttons */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {user ? (
          <>
            <button
              onClick={() => setShowForm(!showForm)}
              className="cursor-pointer px-6 py-2.5 bg-white text-black text-[11px] font-bold tracking-[2px] uppercase rounded-full hover:bg-white/90 transition-colors"
            >
              {showForm ? t("cancel") : t("community_createPost")}
            </button>
            <button
              onClick={() => router.push("/feedback")}
              className="cursor-pointer px-5 py-2.5 border border-white/15 text-white/50 text-[11px] font-bold tracking-[2px] uppercase rounded-full hover:text-white/80 hover:border-white/30 transition-colors"
            >
              {t("community_feedback")}
            </button>
          </>
        ) : (
          <button
            onClick={() => router.push("/auth/login")}
            className="cursor-pointer text-[12px] text-white/30 underline hover:text-white/60 transition-colors"
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
                >
                  <IconClose size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-white/10 rounded-xl text-[12px] text-white/30 hover:text-white/50 hover:border-white/20 transition-colors flex items-center justify-center gap-2"
              >
                <IconUploadImage size={18} />
                {t("community_uploadImageOptional")}
              </button>
            )}
            <button
              onClick={handlePublish}
              disabled={publishing || !title.trim()}
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
              className="relative bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden hover:bg-white/[0.04] transition-colors group"
            >
              {/* Owner delete button */}
              {user?.id === post.user_id && (
                <button
                  onClick={() => handleDeletePost(post.id)}
                  className="cursor-pointer absolute top-2 right-2 z-10 w-7 h-7 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100"
                  title={t("delete")}
                >
                  <IconClose size={12} />
                </button>
              )}
              {post.image_url && (
                <button onClick={() => router.push(`/community/${post.id}`)} className="w-full aspect-[4/3] overflow-hidden cursor-pointer">
                  <img src={post.image_url} alt={post.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                </button>
              )}
              <div className="p-4">
                <button onClick={() => router.push(`/community/${post.id}`)} className="text-left w-full">
                  <h4 className="text-[14px] font-semibold tracking-wide line-clamp-1">{post.title}</h4>
                </button>
                {post.description && <p className="text-[11px] text-white/40 mt-1 line-clamp-2">{post.description}</p>}
                <div className="flex items-center justify-between mt-3 text-[10px] text-white/30">
                  <span>{post.author_name || "Anonymous"}</span>
                  <span>{timeAgo(post.created_at, t)}</span>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.06]">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`flex items-center gap-1.5 text-[11px] transition-colors ${likedSet.has(post.id) ? "text-red-400" : "text-white/30 hover:text-white/60"}`}
                  >
                    {likedSet.has(post.id) ? <IconHeartFilled size={14} /> : <IconHeart size={14} />}
                    <span>{post.likes_count}</span>
                  </button>
                  <button
                    onClick={() => router.push(`/community/${post.id}`)}
                    className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors"
                  >
                    <IconComment size={14} />
                    <span>{post.comments_count}</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
