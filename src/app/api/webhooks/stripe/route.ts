import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId || !session.subscription) break;

      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      );
      const priceId = subscription.items.data[0]?.price.id;

      let tier: "pro" | "enterprise" = "pro";
      if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
        tier = "enterprise";
      }

      await db
        .update(users)
        .set({
          subscriptionTier: tier,
          subscriptionStatus: "active",
          stripeSubscriptionId: subscription.id,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.stripeCustomerId, customerId));

      if (!user) break;

      const priceId = subscription.items.data[0]?.price.id;
      let tier: "free" | "pro" | "enterprise" = "pro";
      if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
        tier = "enterprise";
      }

      const statusMap: Record<string, "active" | "past_due" | "canceled"> = {
        active: "active",
        past_due: "past_due",
        canceled: "canceled",
        unpaid: "past_due",
      };

      await db
        .update(users)
        .set({
          subscriptionTier: subscription.status === "canceled" ? "free" : tier,
          subscriptionStatus: statusMap[subscription.status] || "active",
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      await db
        .update(users)
        .set({
          subscriptionTier: "free",
          subscriptionStatus: "canceled",
          stripeSubscriptionId: null,
          updatedAt: new Date(),
        })
        .where(eq(users.stripeCustomerId, customerId));
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      await db
        .update(users)
        .set({
          subscriptionStatus: "past_due",
          updatedAt: new Date(),
        })
        .where(eq(users.stripeCustomerId, customerId));
      break;
    }
  }

  return NextResponse.json({ received: true });
}
