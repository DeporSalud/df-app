import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia" as any,
  appInfo: {
    name: "Dance Factory Student App",
    version: "1.0.0",
  },
});
