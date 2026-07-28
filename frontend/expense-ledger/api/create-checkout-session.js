import { stripe } from "./_stripeClient.js";
import { supabaseAdmin, getUserFromRequest } from "./_supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  const appUrl = process.env.APP_URL;
  if (!priceId || !appUrl) {
    res.status(500).json({ error: "Server is missing STRIPE_PRICE_ID or APP_URL." });
    return;
  }

  try {
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("subscriptions")
        .upsert({ user_id: user.id, stripe_customer_id: customerId, status: "none" }, { onConflict: "user_id" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?checkout=success`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
      subscription_data: { metadata: { supabase_user_id: user.id } },
      metadata: { supabase_user_id: user.id },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("create-checkout-session failed", err);
    res.status(500).json({ error: "Could not start checkout." });
  }
}
