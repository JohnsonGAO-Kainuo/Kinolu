/**
 * Community data layer — posts, comments, likes, image upload.
 * All operations go through Supabase client (browser-side).
 */
import { createClient } from "./client";

/* ─── Types ─── */

export interface Post {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_url: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  /* joined from profiles */
  author_name?: string;
  author_email?: string;
  author_avatar_url?: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  /* joined from profiles */
  author_name?: string;
  author_avatar_url?: string;
}

/* ─── Image Upload ─── */

export async function uploadCommunityImage(
  userId: string,
  file: File,
): Promise<string> {
  const sb = createClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await sb.storage
    .from("community")
    .upload(path, file, { cacheControl: "31536000", upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = sb.storage.from("community").getPublicUrl(path);
  return data.publicUrl;
}

/* ─── Posts ─── */

export async function fetchPosts(
  page = 0,
  pageSize = 20,
): Promise<{ posts: Post[]; hasMore: boolean }> {
  const sb = createClient();
  const from = page * pageSize;
  const to = from + pageSize;

  const { data, error } = await sb
    .from("posts")
    .select("*, profiles!posts_user_id_fkey(display_name, avatar_url)")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);

  const posts: Post[] = (data ?? []).map((row: Record<string, unknown>) => {
    const profile = row.profiles as Record<string, unknown> | null;
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      title: row.title as string,
      description: (row.description as string) || "",
      image_url: row.image_url as string,
      likes_count: (row.likes_count as number) || 0,
      comments_count: (row.comments_count as number) || 0,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      author_name: (profile?.display_name as string) || "Anonymous",
      author_avatar_url: (profile?.avatar_url as string) || undefined,
    };
  });

  return { posts, hasMore: posts.length > pageSize };
}

export async function fetchPost(id: string): Promise<Post | null> {
  const sb = createClient();
  const { data, error } = await sb
    .from("posts")
    .select("*, profiles!posts_user_id_fkey(display_name, avatar_url)")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const profile = data.profiles as Record<string, unknown> | null;
  return {
    ...data,
    author_name: (profile?.display_name as string) || "Anonymous",
    author_avatar_url: (profile?.avatar_url as string) || undefined,
  } as Post;
}

export async function createPost(
  userId: string,
  title: string,
  description: string,
  imageUrl?: string,
): Promise<Post> {
  const sb = createClient();
  const row: Record<string, string> = { user_id: userId, title, description };
  if (imageUrl) row.image_url = imageUrl;
  const { data, error } = await sb
    .from("posts")
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Post;
}

export async function deletePost(postId: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("posts").delete().eq("id", postId);
  if (error) throw new Error(error.message);
}

/* ─── Comments ─── */

export async function fetchComments(postId: string): Promise<Comment[]> {
  const sb = createClient();
  const { data, error } = await sb
    .from("comments")
    .select("*, profiles!comments_user_id_fkey(display_name, avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => {
    const profile = row.profiles as Record<string, unknown> | null;
    return {
      id: row.id as string,
      post_id: row.post_id as string,
      user_id: row.user_id as string,
      content: row.content as string,
      created_at: row.created_at as string,
      author_name: (profile?.display_name as string) || "Anonymous",
      author_avatar_url: (profile?.avatar_url as string) || undefined,
    };
  });
}

export async function createComment(
  postId: string,
  userId: string,
  content: string,
): Promise<Comment> {
  const sb = createClient();
  const { data, error } = await sb
    .from("comments")
    .insert({ post_id: postId, user_id: userId, content })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Comment;
}

export async function deleteComment(commentId: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("comments").delete().eq("id", commentId);
  if (error) throw new Error(error.message);
}

/* ─── Likes ─── */

export async function toggleLike(
  postId: string,
  userId: string,
): Promise<boolean> {
  const sb = createClient();

  // Check if already liked
  const { data: existing } = await sb
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    // Unlike
    await sb.from("likes").delete().eq("id", existing.id);
    return false;
  } else {
    // Like
    const { error } = await sb
      .from("likes")
      .insert({ post_id: postId, user_id: userId });
    if (error) throw new Error(error.message);
    return true;
  }
}

export async function checkUserLikes(
  postIds: string[],
  userId: string,
): Promise<Set<string>> {
  if (!userId || postIds.length === 0) return new Set();
  const sb = createClient();
  const { data } = await sb
    .from("likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);

  return new Set((data ?? []).map((r: { post_id: string }) => r.post_id));
}
