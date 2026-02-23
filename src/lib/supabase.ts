/* ── Kinolu Supabase Integration ──
 * Future database schema and API interfaces for cloud features.
 * NOT YET CONNECTED — placeholder for future implementation.
 */

export interface SupabaseUser {
  id: string;
  email: string;
  created_at: string;
  subscription_tier: "free" | "pro";
}

export interface CloudPreset {
  id: string;
  user_id: string;
  name: string;
  cube_file_url: string; // Supabase Storage URL
  thumbnail_url?: string;
  source_type: "generated" | "imported_cube";
  tags?: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Feedback {
  id: string;
  user_id?: string;
  message: string;
  category?: "bug" | "feature" | "general";
  created_at: string;
}

/* ── Future API methods (not implemented) ── */

export interface SupabaseAPI {
  // Auth
  signIn: (email: string, password: string) => Promise<SupabaseUser>;
  signOut: () => Promise<void>;
  getCurrentUser: () => Promise<SupabaseUser | null>;

  // Presets
  syncPresets: () => Promise<CloudPreset[]>;
  uploadPreset: (preset: Partial<CloudPreset>, cubeBlob: Blob) => Promise<CloudPreset>;
  deletePreset: (id: string) => Promise<void>;
  
  // Feedback
  submitFeedback: (message: string, category?: string) => Promise<void>;

  // Subscription
  createCheckoutSession: (tier: "pro") => Promise<{ url: string }>;
  cancelSubscription: () => Promise<void>;
}

/* ── Supabase Client Stub ── */
export const supabase: SupabaseAPI | null = null; // Replace with real Supabase client when ready

/* ── Migration Plan ──
 * 
 * 1. Set up Supabase project (supabase.com)
 * 2. Create tables:
 *    - users (id, email, subscription_tier, created_at)
 *    - cloud_presets (id, user_id, name, cube_file_url, ...)
 *    - feedback (id, user_id, message, category, created_at)
 * 
 * 3. Enable Storage bucket for .cube files
 * 4. Set up Row Level Security (RLS) policies
 * 5. Install @supabase/supabase-js
 * 6. Create lib/supabase.ts with actual client
 * 7. Update profile/subscription pages to use real auth
 * 8. Add sync button to Library page
 */
