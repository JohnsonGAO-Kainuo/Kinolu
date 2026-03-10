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

/* Small avatar component used in discussion threads */
function AuthorAvatar({ name, url, size = 28 }: { name: string; url?: string; size?: number }) {
  return url ? (
    <img src={url} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full bg-white/10 flex items-center justify-center shrink-0 text-[10px] font-bold text-white/50" style={{ width: size, height: size }}>
      {(name || "A").charAt(0).toUpperCase()}
    </div>
  );
}

type TabId = "works" | "discussion";

interface CommunitySectionProps {
  standalone?: boolean;
}

export default function CommunitySection({ standalone }: CommunitySectionProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>("works");
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

  /* Split posts by type: works = has image, discussion = text-only */
  const workPosts = posts.filter((p) => !!p.image_url);
  const discussionPosts = posts.filter((p) => !p.image_url);

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
    <section id="community" className={`max-w-7xl mx-auto px-6 scroll-mt-20 ${standalone ? "py-28" : "py-24"}`}>
      <h2 className="text-[10px] tracking-[4px] text-white/30 uppercase text-center mb-2">
        {t("community_title")}
      </h2>
      <h3 className="text-[24px] md:text-[36px] font-bold tracking-[2px] text-center mb-3">
        {t("landing_communityTitle")}
      </h3>
      <p className="text-[13px] text-white/40 text-center mb-10 max-w-md mx-auto">
        {t("community_desc")}
      </p>

      {/* ── Tab bar ── */}
      <div className="flex items-center justify-center gap-6 mb-8">
        <div className="flex items-center bg-white/[0.05] rounded-lg p-0.5 border border-white/[0.06]">
          {(["works", "discussion"] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setShowForm(false); }}
              className={`cursor-pointer text-[11px] tracking-[1px] uppercase px-5 py-1.5 rounded-md font-medium transition-all duration-200 ${
                activeTab === tab
                  ? "bg-white/[0.12] text-white/90 shadow-sm"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
              }`}
            >
              {tab === "works" ? t("community_tabWorks") : t("community_tabDiscussion")}
            </button>
          ))}
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {user ? (
          <>
            <button
              onClick={() => setShowForm(!showForm)}
              className="cursor-pointer px-6 py-2.5 bg-white text-black text-[11px] font-bold tracking-[2px] uppercase rounded-lg hover:bg-white/90 transition-colors"
            >
              {showForm
                ? t("cancel")
                : activeTab === "works"
                  ? t("community_createPost")
                  : t("community_startDiscussion")
              }
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

      {/* ── Create post form ── */}
      {showForm && (
        <div className="max-w-xl mx-auto mb-10">
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-5 space-y-4">
            <input
              type="text"
              placeholder={
                activeTab === "works"
                  ? t("community_postTitlePlaceholder")
                  : t("community_discussionTitlePlaceholder")
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-3 text-[13px] text-white placeholder-white/25 outline-none focus:border-white/20"
            />
            <textarea
              placeholder={
                activeTab === "works"
                  ? t("community_postDescPlaceholder")
                  : t("community_discussionDescPlaceholder")
              }
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={activeTab === "discussion" ? 5 : 3}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-3 text-[13px] text-white placeholder-white/25 outline-none focus:border-white/20 resize-none"
            />
            {/* Image upload — only for Works tab */}
            {activeTab === "works" && (
              <>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                {imagePreview ? (
                  <div className="relative rounded-lg overflow-hidden">
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
                    className="w-full py-8 border-2 border-dashed border-white/10 rounded-lg text-[12px] text-white/30 hover:text-white/50 hover:border-white/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <IconUploadImage size={18} />
                    {t("community_uploadImageOptional")}
                  </button>
                )}
              </>
            )}
            <button
              onClick={handlePublish}
              disabled={publishing || !title.trim() || (activeTab === "discussion" && !desc.trim())}
              className="w-full py-3 bg-white text-black text-[12px] font-bold tracking-[2px] uppercase rounded-lg disabled:opacity-30 hover:bg-white/90 transition-colors"
            >
              {publishing ? t("community_publishing") : t("community_publish")}
            </button>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {loadingPosts ? (
        <div className="text-center py-16">
          <div className="inline-block w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      ) : activeTab === "works" ? (
        /* ── Works grid ── */
        workPosts.length === 0 ? (
          <p className="text-center text-[13px] text-white/25 py-16">{t("community_noPostsYet")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {workPosts.map((post) => (
              <article
                key={post.id}
                className="relative bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden hover:bg-white/[0.04] transition-colors group"
              >
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
                    <div className="flex items-center gap-1.5">
                      <AuthorAvatar name={post.author_name || "A"} url={post.author_avatar_url} size={18} />
                      <span>{post.author_name || "Anonymous"}</span>
                    </div>
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
        )
      ) : (
        /* ── Discussion list ── */
        discussionPosts.length === 0 ? (
          <p className="text-center text-[13px] text-white/25 py-16">{t("community_noDiscussionsYet")}</p>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {discussionPosts.map((post) => (
              <article
                key={post.id}
                className="relative bg-white/[0.02] border border-white/[0.06] rounded-lg p-5 hover:bg-white/[0.04] transition-colors group"
              >
                {user?.id === post.user_id && (
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="cursor-pointer absolute top-3 right-3 z-10 w-6 h-6 bg-white/[0.05] rounded-full flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
                    title={t("delete")}
                  >
                    <IconClose size={10} />
                  </button>
                )}
                <button onClick={() => router.push(`/community/${post.id}`)} className="text-left w-full">
                  <div className="flex items-start gap-3">
                    <AuthorAvatar name={post.author_name || "A"} url={post.author_avatar_url} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-medium text-white/60">{post.author_name || "Anonymous"}</span>
                        <span className="text-[10px] text-white/20">·</span>
                        <span className="text-[10px] text-white/20">{timeAgo(post.created_at, t)}</span>
                      </div>
                      <h4 className="text-[14px] font-semibold text-white/90 line-clamp-1 mb-1">{post.title}</h4>
                      {post.description && (
                        <p className="text-[12px] text-white/40 line-clamp-3 leading-relaxed">{post.description}</p>
                      )}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.06] ml-11">
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
              </article>
            ))}
          </div>
        )
      )}
    </section>
  );
}
