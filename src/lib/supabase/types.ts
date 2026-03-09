/* ── Kinolu Supabase Types ── */

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  subscription_tier: "free" | "pro";
  stripe_customer_id: string | null;
  daily_transfer_count: number;
  daily_transfer_reset_at: string;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan_type: "monthly" | "annual" | "lifetime";
  status: "active" | "canceled" | "past_due" | "incomplete" | "trialing";
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
}
