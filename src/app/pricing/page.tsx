import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/navbar";
import { Check, X } from "lucide-react";
import Link from "next/link";
import { PLANS } from "@/lib/stripe";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pricing" };

const features: { label: string; key: string; suffix?: string; invert?: boolean }[] = [
  { label: "Exports per month", key: "exportsPerMonth" },
  { label: "Max audio length", key: "maxAudioMinutes", suffix: " min" },
  { label: "Resolution", key: "resolution" },
  { label: "Frame rate", key: "fps", suffix: " fps" },
  { label: "Watermark", key: "watermark", invert: true },
  { label: "Custom backgrounds", key: "customBackground" },
  { label: "Custom fonts", key: "customFonts" },
  { label: "Lyrics overlay", key: "lyricsOverlay" },
  { label: "Batch export", key: "batchExport" },
  { label: "Video storage", key: "videoStorageDays", suffix: " days" },
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold sm:text-4xl">
              Simple, transparent pricing
            </h1>
            <p className="mt-2 text-muted-foreground">
              Start free. Upgrade when you need more.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {(
              [
                ["free", PLANS.free],
                ["pro", PLANS.pro],
                ["enterprise", PLANS.enterprise],
              ] as const
            ).map(([tier, plan]) => (
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
                      <>
                        <span className="text-3xl font-bold text-foreground">
                          ${(plan.priceMonthly / 100).toFixed(2)}
                        </span>
                        <span className="text-muted-foreground">/month</span>
                      </>
                    ) : (
                      <span className="text-3xl font-bold text-foreground">
                        Free
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Link
                    href="/auth/signin"
                    className={cn(
                      buttonVariants({ variant: tier === "pro" ? "default" : "outline" }),
                      "w-full"
                    )}
                  >
                    {tier === "free" ? "Get Started" : `Upgrade to ${plan.name}`}
                  </Link>

                  <ul className="space-y-3 text-sm">
                    {features.map((feature) => {
                      const value = (plan as Record<string, unknown>)[feature.key];
                      const isBoolean = typeof value === "boolean";
                      const display = isBoolean
                        ? feature.invert
                          ? !value
                          : value
                        : true;

                      return (
                        <li key={feature.key} className="flex items-center gap-2">
                          {isBoolean ? (
                            display ? (
                              <Check className="h-4 w-4 text-primary" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground/40" />
                            )
                          ) : (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                          <span
                            className={
                              isBoolean && !display
                                ? "text-muted-foreground/60"
                                : ""
                            }
                          >
                            {isBoolean
                              ? feature.label
                              : `${value === Infinity ? "Unlimited" : value}${feature.suffix || ""} ${feature.label.toLowerCase()}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
