"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { AlertCircle, Music } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "Access denied. You may not have permission.",
    Verification: "The verification link has expired or has already been used.",
    Default: "An unexpected error occurred. Please try again.",
  };

  const message = errorMessages[error || ""] || errorMessages.Default;

  return (
    <Card className="border-destructive/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <CardTitle>Authentication Error</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Link href="/auth/signin" className={cn(buttonVariants())}>
          Try Again
        </Link>
      </CardContent>
    </Card>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Music className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">VizWave</span>
          </Link>
        </div>
        <Suspense>
          <AuthErrorContent />
        </Suspense>
      </div>
    </div>
  );
}
