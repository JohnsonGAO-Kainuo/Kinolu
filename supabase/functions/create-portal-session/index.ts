import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* ── Kinolu Stripe Customer Portal Session ──
 * Creates a Stripe Billing Portal session so users can manage
 * their subscription (cancel, update payment method, etc.)
 *
 * Required secrets:
 *   STRIPE_SECRET_KEY — sk_live_... or sk_test_...
 *
 * Called from the profile page with the user's JWT.
 * verify_jwt is disabled because the function validates
 * the token itself via supabaseAuth.auth.getUser().
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return new Response(
      JSON.stringify({ error: "Stripe not configured" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Verify the user is authenticated
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Get user from JWT
  const token = authHeader.replace("Bearer ", "");
  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Get the user's stripe_customer_id from profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single();

  let stripeCustomerId = profile?.stripe_customer_id;

  // If no Stripe customer exists, create one on-the-fly
  if (!stripeCustomerId) {
    const email = profile?.email || user.email;
    console.log(`🆕 No Stripe customer for user ${user.id}, creating one...`);
    try {
      const custRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          email: email || "",
          "metadata[supabase_user_id]": user.id,
        }),
      });
      if (custRes.ok) {
        const cust = await custRes.json();
        stripeCustomerId = cust.id;
        // Save back to profiles
        await supabase
          .from("profiles")
          .update({ stripe_customer_id: cust.id, updated_at: new Date().toISOString() })
          .eq("id", user.id);
        console.log(`✅ Created Stripe customer: ${cust.id}`);
      } else {
        const errText = await custRes.text();
        console.error("Failed to create Stripe customer:", errText);
      }
    } catch (err) {
      console.error("Error creating Stripe customer:", err);
    }
  }

  if (!stripeCustomerId) {
    return new Response(
      JSON.stringify({ error: "Could not find or create a Stripe customer for this account" }),
      { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Parse return_url from request body
  let returnUrl = "";
  try {
    const body = await req.json();
    returnUrl = body.return_url || "";
  } catch {
    // Default return URL
  }

  // Create Stripe Billing Portal session
  const portalRes = await fetch(
    "https://api.stripe.com/v1/billing_portal/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: stripeCustomerId,
        return_url: returnUrl || `${req.headers.get("origin") || "https://kinolu.app"}/profile`,
      }),
    },
  );

  if (!portalRes.ok) {
    const err = await portalRes.text();
    console.error("Stripe portal error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to create portal session" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const portalSession = await portalRes.json();

  return new Response(
    JSON.stringify({ url: portalSession.url }),
    {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    },
  );
});
