"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/components/AuthProvider";
import {
  IconPalette, IconXYPad, IconFilm, IconCamera, IconEdit, IconPackage,
  IconClose, IconHeart, IconHeartFilled, IconComment, IconUploadImage, IconBack,
} from "@/components/icons";
import {
  fetchPosts,
  createPost,
  uploadCommunityImage,
  toggleLike,
  checkUserLikes,
  type Post,
} from "@/lib/supabase/community";

/* ═══════════════════════════════════════════════════════════
   Landing Page — Dual-mode navigation
   ─────────────────────────────────────────────────────────
   Mode 1 (default): Full scrollable page with all sections.
   Mode 2 (focus):   Click a nav item → only that section is
                     shown. A back button returns to mode 1.
   ═══════════════════════════════════════════════════════════ */

const FEATURES = [
  { Icon: IconPalette, key: "landing_feat1Title" as const, descKey: "landing_feat1Desc" as const },
  { Icon: IconXYPad, key: "landing_feat2Title" as const, descKey: "landing_feat2Desc" as const },
  { Icon: IconFilm, key: "landing_feat3Title" as const, descKey: "landing_feat3Desc" as const },
  { Icon: IconCamera, key: "landing_feat4Title" as const, descKey: "landing_feat4Desc" as const },
  { Icon: IconEdit, key: "landing_feat5Title" as const, descKey: "landing_feat5Desc" as const },
  { Icon: IconPackage, key: "landing_feat6Title" as const, descKey: "landing_feat6Desc" as const },
] as const;

const STEPS = [
  { num: "01", key: "landing_step1Title" as const, descKey: "landing_step1Desc" as const },
  { num: "02", key: "landing_step2Title" as const, descKey: "landing_step2Desc" as const },
  { num: "03", key: "landing_step3Title" as const, descKey: "landing_step3Desc" as const },
  { num: "04", key: "landing_step4Title" as const, descKey: "landing_step4Desc" as const },
] as const;

const SHOWCASE_PAIRS = [
  { src: "/heroes/editor.jpg", label: "landing_showcase_filmEmulation" as const },
  { src: "/heroes/camera.jpg", label: "landing_showcase_colorMatch" as const },
  { src: "/heroes/presets.jpg", label: "landing_showcase_moodTransfer" as const },
];

type SectionId = "features" | "showcase" | "how-it-works" | "community";

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

  /* ── Focus mode: null = full scroll, string = only show that section ── */
  const [focusSection, setFocusSection] = useState<SectionId | null>(null);

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

  /* ── Active nav tracking (scroll mode only) ── */
  const [activeSection, setActiveSection] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusSection) return; // no tracking in focus mode
    const root = scrollRef.current;
    if (!root) return;
    const sections = root.querySelectorAll("section[id]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { root, rootMargin: "-30% 0px -70% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [focusSection]);

  /* ── Handle hash on first load ── */
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as SectionId;
    if (hash && ["features", "showcase", "how-it-works", "community"].includes(hash)) {
      // Scroll to section rather than focusing, so user sees full page context
      requestAnimationFrame(() => {
        const el = document.getElementById(hash);
        el?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, []);

  /* ── Load community posts ── */
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

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  /* ── Like toggle ── */
  const handleLike = async (postId: string) => {
    if (!user) { router.push("/auth/login"); return; }
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

  /* ── Nav click handler ── */
  const handleNavClick = (id: SectionId) => {
    if (focusSection) {
      // Already in focus mode → switch to that section
      setFocusSection(id);
      return;
    }
    // In scroll mode → smooth-scroll to section
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  /* ── Enter focus mode ── */
  const enterFocus = (id: SectionId) => {
    setFocusSection(id);
    window.scrollTo({ top: 0 });
  };

  /* ── Exit focus mode → back to full scroll ── */
  const exitFocus = () => {
    setFocusSection(null);
  };

  const navItems: { id: SectionId; label: string }[] = [
    { id: "features", label: t("landing_featuresLabel") },
    { id: "showcase", label: t("landing_galleryLabel") },
    { id: "how-it-works", label: t("landing_howLabel") },
    { id: "community", label: t("community_title") },
  ];

  /* ── Helper: should this section be visible? ── */
  const show = (id: SectionId) => !focusSection || focusSection === id;

  /* ═══════════════════════════════════════════════════════════ */
  /* Render */
  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div
      ref={scrollRef}
      className="relative w-full bg-black text-white"
      style={{ height: "100dvh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
    >
      {/* ═══ Nav Bar ═══ */}
      <nav className="sticky top-0 z-50 safe-top bg-black/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          {/* Left: Logo or Back button */}
          <div className="flex items-center gap-2">
            {focusSection ? (
              <button
                onClick={exitFocus}
                className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors"
              >
                <IconBack size={18} />
                <span className="text-[10px] tracking-[2px] uppercase font-bold">KINOLU</span>
              </button>
            ) : (
              <>
                <img src="/logo-icon-sm.png" alt="Kinolu" width={28} height={28} className="w-7 h-7" />
                <span className="text-[13px] font-bold tracking-[4px] text-white/90">KINOLU</span>
              </>
            )}
          </div>

          {/* Center: nav links */}
          <div className="hidden sm:flex items-center gap-6">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => focusSection ? setFocusSection(item.id) : handleNavClick(item.id)}
                className={`text-[10px] tracking-[1.5px] uppercase transition-colors ${
                  (focusSection === item.id || (!focusSection && activeSection === item.id))
                    ? "text-white/80"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/subscription")}
              className="hidden sm:block text-[10px] tracking-[1.5px] text-white/40 uppercase hover:text-white/70 transition-colors"
            >
              {t("landing_nav_pricing")}
            </button>
            <button
              onClick={() => router.push("/")}
              className="text-[10px] tracking-[1.5px] text-white/50 border border-white/15 rounded-full px-3.5 py-1.5 hover:text-white/80 hover:border-white/30 transition-colors uppercase"
            >
              {t("share_openInApp")}
            </button>
          </div>
        </div>

        {/* Mobile nav — horizontal scroll pills */}
        <div className="sm:hidden flex gap-2 px-5 pb-2.5 overflow-x-auto no-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => focusSection ? setFocusSection(item.id) : handleNavClick(item.id)}
              className={`shrink-0 text-[9px] tracking-[1.5px] uppercase px-3 py-1.5 rounded-full border transition-colors ${
                (focusSection === item.id || (!focusSection && activeSection === item.id))
                  ? "text-white/80 border-white/20 bg-white/[0.06]"
                  : "text-white/30 border-white/[0.06] hover:text-white/50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ═══ Hero Section — only in scroll mode ═══ */}
      {!focusSection && (
        <section className="relative w-full flex flex-col items-center justify-center px-6 text-center" style={{ minHeight: "calc(100dvh - 56px)" }}>
          <div
            className="absolute inset-0 bg-cover bg-center opacity-35"
            style={{ backgroundImage: "url(/heroes/editor.jpg)" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black" />
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-[32px] sm:text-[48px] md:text-[64px] font-black tracking-[4px] sm:tracking-[6px] leading-[1.1] uppercase">
              {t("landing_heroTitle")}
            </h1>
            <p className="mt-5 text-[14px] md:text-[16px] text-white/55 tracking-wide leading-relaxed max-w-md mx-auto">
              {t("landing_heroDesc")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-10 justify-center">
              <button
                onClick={() => router.push("/")}
                className="px-10 py-3.5 bg-white text-black text-[12px] font-bold tracking-[3px] rounded-full uppercase hover:bg-white/90 transition-colors"
              >
                {t("landing_ctaTry")}
              </button>
              <button
                onClick={() => handleNavClick("features")}
                className="px-8 py-3.5 border border-white/20 text-[12px] font-bold tracking-[3px] rounded-full uppercase text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
              >
                {t("landing_ctaLearnMore")}
              </button>
            </div>
          </div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/25">
              <path d="M7 13l5 5 5-5M7 7l5 5 5-5" />
            </svg>
          </div>
        </section>
      )}

      {/* ═══ Focus mode header — shows which section is active ═══ */}
      {focusSection && (
        <div className="text-center pt-10 pb-2 px-5">
          <p className="text-[10px] text-white/20 tracking-[2px] uppercase">
            {navItems.find((n) => n.id === focusSection)?.label}
          </p>
        </div>
      )}

      {/* ═══ Features Grid ═══ */}
      {show("features") && (
        <section id="features" className="max-w-6xl mx-auto px-5 py-24 scroll-mt-20">
          {!focusSection && (
            <button onClick={() => enterFocus("features")} className="block mx-auto mb-2 text-[10px] tracking-[4px] text-white/30 uppercase text-center hover:text-white/50 transition-colors">
              {t("landing_featuresLabel")}
            </button>
          )}
          <h3 className="text-[24px] md:text-[36px] font-bold tracking-[2px] text-center mb-4">
            {t("landing_featuresTitle")}
          </h3>
          <p className="text-[13px] text-white/40 text-center mb-14 max-w-lg mx-auto">
            {t("landing_featuresSubtitle")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.key}
                className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center mb-4 group-hover:bg-white/[0.1] transition-colors">
                  <f.Icon size={20} className="text-white/60 group-hover:text-white/80 transition-colors" />
                </div>
                <h4 className="text-[13px] font-semibold tracking-wide mb-1.5">{t(f.key)}</h4>
                <p className="text-[11px] text-white/35 leading-relaxed">{t(f.descKey)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ Before / After Showcase ═══ */}
      {show("showcase") && (
        <section id="showcase" className="max-w-6xl mx-auto px-5 py-20 scroll-mt-20">
          {!focusSection && (
            <button onClick={() => enterFocus("showcase")} className="block mx-auto mb-2 text-[10px] tracking-[4px] text-white/30 uppercase text-center hover:text-white/50 transition-colors">
              {t("landing_galleryLabel")}
            </button>
          )}
          <h3 className="text-[24px] md:text-[36px] font-bold tracking-[2px] text-center mb-4">
            {t("landing_galleryTitle")}
          </h3>
          <p className="text-[13px] text-white/40 text-center mb-12 max-w-lg mx-auto">
            {t("landing_showcaseSubtitle")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SHOWCASE_PAIRS.map((pair, i) => (
              <div key={i} className="group relative">
                <div className="rounded-2xl overflow-hidden aspect-[4/3] bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all">
                  <img
                    src={pair.src}
                    alt={t(pair.label)}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <span className="text-[11px] font-semibold tracking-[1.5px] text-white/80 uppercase">
                      {t(pair.label)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/20 text-center mt-6 italic">
            {t("landing_showcasePlaceholder")}
          </p>
        </section>
      )}

      {/* ═══ How It Works ═══ */}
      {show("how-it-works") && (
        <section id="how-it-works" className="max-w-4xl mx-auto px-5 py-20 scroll-mt-20">
          {!focusSection && (
            <button onClick={() => enterFocus("how-it-works")} className="block mx-auto mb-2 text-[10px] tracking-[4px] text-white/30 uppercase text-center hover:text-white/50 transition-colors">
              {t("landing_howLabel")}
            </button>
          )}
          <h3 className="text-[24px] md:text-[36px] font-bold tracking-[2px] text-center mb-14">
            {t("landing_howTitle")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {STEPS.map((step) => (
              <div key={step.num} className="flex gap-4 items-start">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                  <span className="text-[16px] font-black text-white/20 tracking-tight">{step.num}</span>
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold tracking-wide mb-1">{t(step.key)}</h4>
                  <p className="text-[12px] text-white/40 leading-relaxed">{t(step.descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ Community Section ═══ */}
      {show("community") && (
        <section id="community" className="max-w-6xl mx-auto px-5 py-24 scroll-mt-20">
          {!focusSection && (
            <button onClick={() => enterFocus("community")} className="block mx-auto mb-2 text-[10px] tracking-[4px] text-white/30 uppercase text-center hover:text-white/50 transition-colors">
              {t("community_title")}
            </button>
          )}
          <h3 className="text-[24px] md:text-[36px] font-bold tracking-[2px] text-center mb-3">
            {t("landing_communityTitle")}
          </h3>
          <p className="text-[13px] text-white/40 text-center mb-10 max-w-md mx-auto">
            {t("community_desc")}
          </p>

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
                onClick={() => router.push("/auth/login")}
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
                  className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden hover:bg-white/[0.04] transition-colors group"
                >
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
      )}

      {/* ═══ Final CTA — only in scroll mode ═══ */}
      {!focusSection && (
        <section className="max-w-4xl mx-auto px-5 py-24 text-center">
          <h2 className="text-[28px] sm:text-[36px] md:text-[48px] font-black tracking-[4px] uppercase mb-4">
            {t("landing_finalTitle")}
          </h2>
          <p className="text-[13px] text-white/40 mb-10 max-w-md mx-auto">
            {t("landing_finalDesc")}
          </p>
          <button
            onClick={() => router.push("/editor")}
            className="px-10 py-3.5 bg-white text-black text-[12px] font-bold tracking-[3px] rounded-full uppercase hover:bg-white/90 transition-colors"
          >
            {t("landing_ctaStart")}
          </button>
        </section>
      )}

      {/* ═══ Footer ═══ */}
      {!focusSection && (
        <footer className="border-t border-white/[0.06] py-10 px-5">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo-icon-sm.png" alt="" width={20} height={20} />
              <span className="text-[11px] tracking-[3px] text-white/40 font-bold">KINOLU</span>
            </div>
            <div className="flex gap-6 text-[10px] tracking-[1.5px] text-white/30 uppercase">
              <button onClick={() => router.push("/subscription")} className="hover:text-white/60 transition-colors">{t("landing_nav_pricing")}</button>
              <button onClick={() => router.push("/privacy")} className="hover:text-white/60 transition-colors">{t("sidebar_privacy")}</button>
              <button onClick={() => router.push("/terms")} className="hover:text-white/60 transition-colors">{t("sidebar_terms")}</button>
              <button onClick={() => router.push("/feedback")} className="hover:text-white/60 transition-colors">{t("sidebar_feedback")}</button>
            </div>
            <p className="text-[10px] text-white/20">&copy; 2026 Kainuo Tech</p>
          </div>
        </footer>
      )}
    </div>
  );
}
