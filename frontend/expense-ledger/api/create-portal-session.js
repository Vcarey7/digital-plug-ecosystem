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

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    res.status(500).json({ error: "Server is missing APP_URL." });
    return;
  }

  try {
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data?.stripe_customer_id) {
      res.status(400).json({ error: "No billing account found yet." });
      return;
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${appUrl}/`,
    });

    res.status(200).json({ url: portalSession.url });
  } catch (err) {
    console.error("create-portal-session failed", err);
    res.status(500).json({ error: "Could not open billing portal." });
  }
}
