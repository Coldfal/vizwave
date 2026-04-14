"use client";

import { Suspense } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLANS, type PlanTier } from "@/lib/stripe";
import { CreditCard, Check, Loader2, ExternalLink } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export default function BillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const { data: billing } = useQuery({
    queryKey: ["billing"],
    queryFn: async () => {
      const res = await fetch("/api/billing/status");
      return res.json();
    },
  });

  useEffect(() => {
    if (searchParams.get("success")) {
      toast.success("Subscription activated! Welcome to Pro.");
    }
    if (searchParams.get("canceled")) {
      toast.info("Checkout canceled.");
    }
  }, [searchParams]);

  async function handleCheckout(priceId: string) {
    setLoadingPlan(priceId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoadingPlan(null);
    }
  }

  async function handlePortal() {
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  const currentTier = (billing?.tier || "free") as PlanTier;
  const currentPlan = PLANS[currentTier];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and billing
        </p>
      </div>

      {/* Current plan */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <CardDescription>
            You are on the{" "}
            <Badge variant="secondary" className="ml-1">
              {currentPlan.name}
            </Badge>{" "}
            plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {billing?.exportsUsed ?? 0} / {currentPlan.exportsPerMonth === Infinity ? "Unlimited" : currentPlan.exportsPerMonth}{" "}
              exports this month
            </div>
            {currentTier !== "free" && (
              <Button variant="outline" size="sm" onClick={handlePortal}>
                <ExternalLink className="mr-2 h-3 w-3" />
                Manage Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.entries(PLANS) as [PlanTier, typeof PLANS[PlanTier]][]).map(
          ([tier, plan]) => (
            <Card
              key={tier}
              className={`relative ${tier === "pro" ? "border-primary shadow-lg shadow-primary/10" : "border-border/50"}`}
            >
              {tier === "pro" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  {"priceMonthly" in plan ? (
                    <span className="text-2xl font-bold text-foreground">
                      ${(plan.priceMonthly / 100).toFixed(2)}
                      <span className="text-sm font-normal text-muted-foreground">
                        /mo
                      </span>
                    </span>
                  ) : (
                    <span className="text-2xl font-bold text-foreground">
                      Free
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    {plan.exportsPerMonth === Infinity
                      ? "Unlimited"
                      : plan.exportsPerMonth}{" "}
                    exports/month
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Up to {plan.maxAudioMinutes} min audio
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    {plan.resolution} @ {plan.fps}fps
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    {plan.watermark ? "With watermark" : "No watermark"}
                  </li>
                  {plan.customBackground && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Custom backgrounds
                    </li>
                  )}
                  {plan.lyricsOverlay && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Lyrics overlay
                    </li>
                  )}
                </ul>

                {tier === currentTier ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : tier === "free" ? (
                  <Button variant="outline" className="w-full" disabled>
                    Free
                  </Button>
                ) : (
                  <Button
                    className={`w-full ${tier === "pro" ? "" : "variant-outline"}`}
                    variant={tier === "pro" ? "default" : "outline"}
                    onClick={() => {
                      const priceId =
                        tier === "pro"
                          ? process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
                          : process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID;
                      if (priceId) handleCheckout(priceId);
                    }}
                    disabled={!!loadingPlan}
                  >
                    {loadingPlan ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Upgrade to {plan.name}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
