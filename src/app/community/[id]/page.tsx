"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/components/AuthProvider";
import {
  IconHeart, IconHeartFilled, IconComment, IconClose, IconShare,
} from "@/components/icons";
import {
  fetchPost,
  fetchComments,
  createComment,
  deleteComment,
  deletePost,
  toggleLike,
  checkUserLikes,
  type Post,
  type Comment,
} from "@/lib/supabase/community";

/* ═══════════════════════════════════════════════════════════
   /community/[id] — Post detail + comments
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

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { t } = useI18n();
  const { user } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([fetchPost(id), fetchComments(id)]);
      setPost(p);
      setComments(c);
      if (user && p) {
        const likes = await checkUserLikes([p.id], user.id);
        setLiked(likes.has(p.id));
      }
    } catch (e) {
      console.error("Load failed", e);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  /* ── Like ── */
  const handleLike = async () => {
    if (!user) { router.push("/auth/login"); return; }
    if (!post) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setPost((p) => p ? { ...p, likes_count: p.likes_count + (wasLiked ? -1 : 1) } : p);
    try {
      await toggleLike(post.id, user.id);
    } catch {
      setLiked(wasLiked);
      setPost((p) => p ? { ...p, likes_count: p.likes_count + (wasLiked ? 1 : -1) } : p);
    }
  };

  /* ── Add comment ── */
  const handleComment = async () => {
    if (!user || !commentText.trim() || !post) return;
    setSending(true);
    try {
      await createComment(post.id, user.id, commentText.trim());
      setCommentText("");
      const c = await fetchComments(id);
      setComments(c);
      setPost((p) => p ? { ...p, comments_count: c.length } : p);
    } catch (e) {
      console.error("Comment failed", e);
    } finally {
      setSending(false);
    }
  };

  /* ── Delete comment ── */
  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setPost((p) => p ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p);
    } catch (e) {
      console.error("Delete comment failed", e);
    }
  };

  /* ── Delete post ── */
  const handleDeletePost = async () => {
    if (!post || !confirm(t("community_deleteConfirm"))) return;
    try {
      await deletePost(post.id);
      router.push("/landing#community");
    } catch (e) {
      console.error("Delete post failed", e);
    }
  };

  /* ── Share ── */
  const handleShare = async () => {
    const url = `${window.location.origin}/share/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: post?.title, url });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

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
        <button onClick={() => router.push("/landing#community")} className="text-[12px] underline hover:text-white/60">
          ← {t("community_title")}
        </button>
      </div>
    );
  }

  const isAuthor = user?.id === post.user_id;

  return (
    <div className="relative w-full min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/[0.06] safe-top">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-white/50 hover:text-white transition-colors text-[13px]">
            ← {t("community_title")}
          </button>
          <div className="flex items-center gap-3">
            <button onClick={handleShare} className="text-white/40 hover:text-white/70"><IconShare size={18} /></button>
            {isAuthor && (
              <button onClick={handleDeletePost} className="text-red-400/60 hover:text-red-400 text-[11px] tracking-wide">
                {t("delete")}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-6">
        {/* Image */}
        <div className="rounded-2xl overflow-hidden bg-white/5 mb-6">
          <img src={post.image_url} alt={post.title} className="w-full max-h-[70vh] object-contain" />
        </div>

        {/* Post Info */}
        <h1 className="text-[22px] font-bold tracking-wide">{post.title}</h1>
        {post.description && (
          <p className="text-[13px] text-white/50 mt-2 leading-relaxed">{post.description}</p>
        )}
        <div className="flex items-center gap-3 mt-4 text-[11px] text-white/30">
          <span>{post.author_name || "Anonymous"}</span>
          <span>·</span>
          <span>{timeAgo(post.created_at, t)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-6 mt-5 py-4 border-y border-white/[0.06]">
          <button
            onClick={handleLike}
            className={`flex items-center gap-2 text-[13px] font-medium transition-colors ${liked ? "text-red-400" : "text-white/40 hover:text-white/70"}`}
          >
            <span className="text-[18px]">{liked ? <IconHeartFilled size={18} /> : <IconHeart size={18} />}</span>
            {post.likes_count} {liked ? t("community_liked") : t("community_like")}
          </button>
          <span className="text-[13px] text-white/30 flex items-center gap-1.5">
            <IconComment size={16} /> {post.comments_count} {t("community_comments")}
          </span>
        </div>

        {/* ── Comments Section ── */}
        <section className="mt-6">
          <h2 className="text-[14px] font-semibold tracking-wide mb-4">{t("community_comments")}</h2>

          {/* Comment input */}
          {user ? (
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                placeholder={t("community_commentPlaceholder")}
                className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-white placeholder-white/25 outline-none focus:border-white/20"
              />
              <button
                onClick={handleComment}
                disabled={sending || !commentText.trim()}
                className="px-5 py-2.5 bg-white text-black text-[11px] font-bold tracking-[1.5px] uppercase rounded-xl disabled:opacity-30 hover:bg-white/90 transition-colors"
              >
                {t("community_send")}
              </button>
            </div>
          ) : (
            <p className="text-[12px] text-white/30 mb-6">
              <button onClick={() => router.push("/auth/login")} className="underline hover:text-white/60">
                {t("community_signInToComment")}
              </button>
            </p>
          )}

          {/* Comments list */}
          {comments.length === 0 ? (
            <p className="text-[12px] text-white/20 text-center py-8">{t("community_noComments")}</p>
          ) : (
            <div className="space-y-4">
              {comments.map((c) => (
                <div key={c.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-[11px] text-white/40">
                      <span className="font-medium text-white/60">{c.author_name || "Anonymous"}</span>
                      <span>·</span>
                      <span>{timeAgo(c.created_at, t)}</span>
                    </div>
                    {user?.id === c.user_id && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-[10px] text-white/20 hover:text-red-400/60 transition-colors"
                      >
                        {t("delete")}
                      </button>
                    )}
                  </div>
                  <p className="text-[13px] text-white/70 leading-relaxed">{c.content}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
