import Stripe from "stripe";

function createStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-03-25.dahlia",
    typescript: true,
  });
}

// Lazy singleton — only initialized when first accessed in an API route
let _stripe: Stripe | undefined;
export function getStripe(): Stripe {
  if (!_stripe) _stripe = createStripe();
  return _stripe;
}

export const PLANS = {
  free: {
    name: "Free",
    exportsPerMonth: 3,
    maxAudioMinutes: 5,
    resolution: "720p" as const,
    fps: 30,
    watermark: true,
    customBackground: false,
    customFonts: false,
    lyricsOverlay: false,
    batchExport: false,
    videoStorageDays: 7,
  },
  pro: {
    name: "Pro",
    priceMonthly: 799, // cents
    priceYearly: 7999, // cents
    exportsPerMonth: Infinity,
    maxAudioMinutes: 15,
    resolution: "1080p" as const,
    fps: 60,
    watermark: false,
    customBackground: true,
    customFonts: true,
    lyricsOverlay: false,
    batchExport: false,
    videoStorageDays: 30,
  },
  enterprise: {
    name: "Enterprise",
    priceMonthly: 2999, // cents
    priceYearly: 29999, // cents
    exportsPerMonth: Infinity,
    maxAudioMinutes: 30,
    resolution: "2160p" as const,
    fps: 60,
    watermark: false,
    customBackground: true,
    customFonts: true,
    lyricsOverlay: true,
    batchExport: true,
    videoStorageDays: 90,
  },
} as const;

export type PlanTier = keyof typeof PLANS;
