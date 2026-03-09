import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* ── Kinolu Stripe Webhook ──
 * Handles Stripe Payment Link completions and subscription lifecycle.
 * Deployed as a Supabase Edge Function.
 *
 * Required secrets (set via `supabase secrets set`):
 *   STRIPE_WEBHOOK_SECRET — Stripe webhook signing secret (whsec_...)
 *   STRIPE_SECRET_KEY     — Stripe secret key (sk_live_... or sk_test_...)
 *
 * Auto-available env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

// Price ID → plan type mapping (ALL currencies: USD + HKD + CNY)
// Includes all product variants to ensure no payment is missed.
const PRICE_TO_PLAN: Record<string, "monthly" | "annual" | "lifetime"> = {
  // ── prod_U35UTwnhTYPkFg (Kinolu Pro – primary) ──
  // USD
  price_1T7cWYJTqJOgtjP4I987GTiJ: "monthly",
  price_1T7cWYJTqJOgtjP4Wor0wq2X: "annual",
  price_1T7cWYJTqJOgtjP4GWMQ4uX2: "lifetime",
  // USD (earlier batch)
  price_1T7c2NJTqJOgtjP4Z6YCIFDh: "monthly",
  price_1T7c2OJTqJOgtjP4OJL6hciI: "annual",
  price_1T7c2NJTqJOgtjP4eFKAoT3X: "lifetime",
  // HKD
  price_1T7bGiJTqJOgtjP42mvughtL: "monthly",
  price_1T7bGiJTqJOgtjP4n52jLJq5: "annual",
  price_1T7bGiJTqJOgtjP4dlFrqlKK: "lifetime",
  // USD (oldest batch)
  price_1T4zJUJTqJOgtjP4hPm3hos0: "monthly",
  price_1T4zJUJTqJOgtjP4U0CTHdvF: "annual",
  price_1T4zJUJTqJOgtjP4SvRct4RL: "lifetime",

  // ── prod_Tuc39xxsAmRaK5 (Kinolu Pro – alt product) ──
  // USD
  price_1T7rhPJTqJOgtjP4dIDUZYtn: "monthly",
  price_1T7riQJTqJOgtjP4lV1UxJlB: "annual",
  price_1T7rjDJTqJOgtjP4OqKwRmtj: "lifetime",
  // HKD
  price_1T7rQSJTqJOgtjP4Llsv59Bq: "monthly",
  price_1T7rQSJTqJOgtjP4LM6coUl7: "annual",
  price_1T7rQSJTqJOgtjP4peRkIycs: "lifetime",
  // CNY
  price_1T7rQTJTqJOgtjP4lRfPtTJZ: "monthly",
  price_1T7rQTJTqJOgtjP4sC9lfWko: "annual",
  price_1T7rQSJTqJOgtjP4V9PkyPFc: "lifetime",
  // USD (older batch)
  price_1SwmpqJTqJOgtjP4lrV1AlqF: "monthly",
  price_1SwmqAJTqJOgtjP4sfzuJ4Vi: "annual",
  price_1SwmqMJTqJOgtjP48FPNkAM5: "lifetime",

  // ── prod_U1xppaP6Le7VgI (Kinolu Pro – another variant) ──
  price_1T7suSJTqJOgtjP4ckikWcyY: "monthly",
  price_1T7svUJTqJOgtjP4qocBAlM4: "annual",
  price_1T3ttnJTqJOgtjP4DMwzsdOj: "monthly",
  price_1T3ttuJTqJOgtjP4Uwpdh9mK: "annual",
};

// ── Stripe signature verification ──
async function verifyStripeSignature(
  body: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = sigHeader.split(",");
  let timestamp = "";
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;

  // Check timestamp tolerance (5 minutes)
  const diff = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (diff > 300) return false;

  // Compute expected signature
  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signatures.some((s) => s === expected);
}

// ── Supabase admin client (bypasses RLS) ──
function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ── Fetch line items from Stripe (to get price ID) ──
async function fetchSessionLineItems(
  sessionId: string,
  stripeKey: string,
): Promise<string | null> {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}/line_items?limit=1`,
    {
      headers: { Authorization: `Bearer ${stripeKey}` },
    },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.[0]?.price?.id ?? null;
}

// ── Dynamic plan type detection (fallback when price not in hardcoded map) ──
async function detectPlanType(
  priceId: string,
  stripeKey: string,
): Promise<"monthly" | "annual" | "lifetime" | null> {
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/prices/${priceId}`,
      { headers: { Authorization: `Bearer ${stripeKey}` } },
    );
    if (!res.ok) return null;
    const price = await res.json();

    if (price.type === "one_time") return "lifetime";
    if (price.recurring?.interval === "year") return "annual";
    if (price.recurring?.interval === "month") return "monthly";
    return null;
  } catch {
    return null;
  }
}

// ── Handle checkout.session.completed ──
async function handleCheckoutCompleted(session: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();

  // 1. Try to find user by client_reference_id (most reliable — set by frontend)
  const clientRefId = session.client_reference_id as string | null;

  // 2. Fallback: look up by email
  const customerEmail =
    (session.customer_details as Record<string, unknown>)?.email ??
    session.customer_email;

  console.log(
    `🔍 Looking up user: ref=${clientRefId}, email=${customerEmail}, session=${session.id}`,
  );

  let profileId: string | null = null;
  let existingStripeCustomerId: string | null = null;

  if (clientRefId) {
    // Direct lookup by Supabase user ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, stripe_customer_id")
      .eq("id", clientRefId)
      .single();

    if (profile) {
      profileId = profile.id;
      existingStripeCustomerId = profile.stripe_customer_id;
    }
  }

  if (!profileId && customerEmail) {
    // Fallback: lookup by email
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, stripe_customer_id")
      .eq("email", customerEmail)
      .single();

    if (profile) {
      profileId = profile.id;
      existingStripeCustomerId = profile.stripe_customer_id;
    }
  }

  if (!profileId) {
    console.error(
      `No profile found for ref:${clientRefId} / email:${customerEmail}`,
    );
    return;
  }

  // Get price ID from line items
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  let priceId: string | null = null;

  if (stripeKey && session.id) {
    priceId = await fetchSessionLineItems(session.id as string, stripeKey);
  }

  // Determine plan type: hardcoded map → dynamic API fallback
  let planType = priceId ? PRICE_TO_PLAN[priceId] : null;

  if (!planType && priceId && stripeKey) {
    console.warn(
      `Price ${priceId} not in hardcoded map — detecting dynamically`,
    );
    planType = await detectPlanType(priceId, stripeKey);
  }

  if (!planType) {
    // Last resort: still activate Pro (any valid Stripe payment = Pro)
    console.error(
      `Could not determine plan for price ${priceId} — defaulting to monthly`,
    );
    planType = "monthly";
  }

  let stripeCustomerId = session.customer as string | null;
  const stripeSubscriptionId = session.subscription as string | null;

  // Payment Links may not create a Stripe Customer — create one if needed
  if (!stripeCustomerId && !existingStripeCustomerId && stripeKey && customerEmail) {
    console.log(`🆕 Creating Stripe customer for ${customerEmail}`);
    try {
      const custRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          email: customerEmail as string,
          metadata: JSON.stringify({ supabase_user_id: profileId }),
        }),
      });
      if (custRes.ok) {
        const cust = await custRes.json();
        stripeCustomerId = cust.id;
        console.log(`✅ Created Stripe customer: ${cust.id}`);
      }
    } catch (err) {
      console.warn("Could not create Stripe customer:", err);
    }
  }

  // Update profile → pro
  await supabase
    .from("profiles")
    .update({
      subscription_tier: "pro",
      stripe_customer_id: stripeCustomerId ?? existingStripeCustomerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  // Upsert subscription record
  const subRecord: Record<string, unknown> = {
    user_id: profileId,
    stripe_subscription_id: stripeSubscriptionId,
    stripe_price_id: priceId,
    plan_type: planType,
    status: "active",
    current_period_start: new Date().toISOString(),
    cancel_at_period_end: false,
    updated_at: new Date().toISOString(),
  };

  if (planType === "lifetime") {
    // Lifetime: no end date
    subRecord.current_period_end = null;
  } else if (planType === "annual") {
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);
    subRecord.current_period_end = end.toISOString();
  } else {
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    subRecord.current_period_end = end.toISOString();
  }

  // Check if existing active subscription exists for this user
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", profileId)
    .eq("status", "active")
    .maybeSingle();

  if (existingSub) {
    await supabase
      .from("subscriptions")
      .update(subRecord)
      .eq("id", existingSub.id);
  } else {
    await supabase.from("subscriptions").insert(subRecord);
  }

  console.log(
    `✅ Activated ${planType} for user:${profileId} (ref:${clientRefId}, email:${customerEmail})`,
  );
}

// ── Handle subscription updated/deleted ──
async function handleSubscriptionChange(
  subscription: Record<string, unknown>,
  isDeleted: boolean,
) {
  const supabase = getSupabaseAdmin();
  const stripeSubId = subscription.id as string;
  const status = isDeleted ? "canceled" : (subscription.status as string);

  // Find subscription in our DB
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, user_id, plan_type")
    .eq("stripe_subscription_id", stripeSubId)
    .maybeSingle();

  if (!sub) {
    console.warn(`No subscription found for stripe ID: ${stripeSubId}`);
    return;
  }

  // Update subscription status
  const updates: Record<string, unknown> = {
    status:
      status === "active"
        ? "active"
        : status === "past_due"
          ? "past_due"
          : "canceled",
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString(),
  };

  // Update period dates if available
  if (subscription.current_period_start) {
    updates.current_period_start = new Date(
      (subscription.current_period_start as number) * 1000,
    ).toISOString();
  }
  if (subscription.current_period_end) {
    updates.current_period_end = new Date(
      (subscription.current_period_end as number) * 1000,
    ).toISOString();
  }

  await supabase.from("subscriptions").update(updates).eq("id", sub.id);

  // If canceled or incomplete_expired, downgrade to free
  if (
    isDeleted ||
    status === "canceled" ||
    status === "incomplete_expired" ||
    status === "unpaid"
  ) {
    // Check if user has any OTHER active subscriptions
    const { data: otherActive } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", sub.user_id)
      .eq("status", "active")
      .neq("id", sub.id)
      .maybeSingle();

    if (!otherActive) {
      await supabase
        .from("profiles")
        .update({
          subscription_tier: "free",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.user_id);
      console.log(`⬇️ Downgraded user ${sub.user_id} to free`);
    }
  } else if (status === "active") {
    await supabase
      .from("profiles")
      .update({
        subscription_tier: "pro",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.user_id);
  }

  console.log(
    `🔄 Subscription ${stripeSubId} → ${status} (user: ${sub.user_id})`,
  );
}

// ── Handle invoice.paid (renew period dates) ──
async function handleInvoicePaid(invoice: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const stripeSubId = invoice.subscription as string | null;
  if (!stripeSubId) return; // one-time payment, already handled by checkout

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, user_id")
    .eq("stripe_subscription_id", stripeSubId)
    .maybeSingle();

  if (!sub) return;

  // Ensure profile stays pro
  await supabase
    .from("profiles")
    .update({
      subscription_tier: "pro",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.user_id);

  // Update subscription status
  await supabase
    .from("subscriptions")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", sub.id);

  console.log(`💳 Invoice paid for subscription ${stripeSubId}`);
}

// ── Main handler ──
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  console.log("📥 Webhook request received");

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  // SECURITY: Always require webhook secret in production
  if (!webhookSecret) {
    console.error("❌ STRIPE_WEBHOOK_SECRET not configured — rejecting request");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  if (!sig) {
    console.error("❌ Missing stripe-signature header");
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const valid = await verifyStripeSignature(body, sig, webhookSecret);
  if (!valid) {
    console.error("❌ Invalid Stripe signature — check STRIPE_WEBHOOK_SECRET");
    return new Response("Invalid signature", { status: 400 });
  }

  console.log("✅ Signature verified");

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  console.log(`📨 Stripe event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object, false);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionChange(event.data.object, true);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;

      case "invoice.payment_failed": {
        const inv = event.data.object;
        const subId = inv.subscription as string | null;
        if (subId) {
          const supabase = getSupabaseAdmin();
          await supabase
            .from("subscriptions")
            .update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subId);
          console.log(`⚠️ Payment failed for subscription ${subId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err);
    return new Response("Webhook handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
