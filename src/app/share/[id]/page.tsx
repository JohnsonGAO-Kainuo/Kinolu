import { Metadata } from "next";
import { createClient } from "@/lib/supabase/client";
import SharePageClient from "./SharePageClient";

/* ═══════════════════════════════════════════════════════════
   /share/[id] — Public share page with OG meta for social
   Server component for metadata + client component for UI
   ═══════════════════════════════════════════════════════════ */

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const sb = createClient();
    const { data: post } = await sb
      .from("posts")
      .select("title, description, image_url")
      .eq("id", id)
      .single();

    if (!post) return { title: "Kinolu" };

    return {
      title: `${post.title} — Kinolu`,
      description: post.description || "Color grading by Kinolu",
      openGraph: {
        title: `${post.title} — Kinolu`,
        description: post.description || "Color grading by Kinolu",
        images: post.image_url ? [{ url: post.image_url, width: 1200, height: 630 }] : [],
        type: "article",
        siteName: "Kinolu",
      },
      twitter: {
        card: "summary_large_image",
        title: `${post.title} — Kinolu`,
        description: post.description || "Color grading by Kinolu",
        images: post.image_url ? [post.image_url] : [],
      },
    };
  } catch {
    return { title: "Kinolu" };
  }
}

export default async function SharePage({ params }: Props) {
  const { id } = await params;
  return <SharePageClient id={id} />;
}
