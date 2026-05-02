import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    priceId: null,
    features: {
      genres: ["fantasy"],
      saveSlots: 1,
      aiActionsPerDay: 50,
      asciiArt: "basic",
    },
  },
  adventurer: {
    name: "Adventurer",
    price: 699,
    priceId: process.env.STRIPE_ADVENTURER_PRICE_ID,
    features: {
      genres: ["fantasy", "cyberpunk", "noir", "space-opera"],
      saveSlots: 3,
      aiActionsPerDay: Infinity,
      asciiArt: "enhanced",
    },
  },
  legend: {
    name: "Legend",
    price: 1499,
    priceId: process.env.STRIPE_LEGEND_PRICE_ID,
    features: {
      genres: ["fantasy", "cyberpunk", "noir", "space-opera"],
      saveSlots: Infinity,
      aiActionsPerDay: Infinity,
      asciiArt: "enhanced-custom",
      priorityAI: true,
    },
  },
} as const;
