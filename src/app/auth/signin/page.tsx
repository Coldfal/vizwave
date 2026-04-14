"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Music, Mail, Loader2, LogIn } from "lucide-react";
import Link from "next/link";

function SignInContent() {
  const [email, setEmail] = useState("test@vizwave.dev");
  const [password, setPassword] = useState("dev");
  const [loading, setLoading] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const isDev = process.env.NODE_ENV === "development";

  async function handleDevSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading("dev");
    await signIn("credentials", { email, password, callbackUrl });
    setLoading(null);
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading("email");
    await signIn("resend", { email, callbackUrl });
    setLoading(null);
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="text-center">
        <CardTitle>Welcome</CardTitle>
        <CardDescription>
          Sign in or create an account to get started
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dev login — always visible in development */}
        {isDev && (
          <>
            <form onSubmit={handleDevSignIn} className="space-y-3">
              <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">
                Dev mode — any email + password works
              </div>
              <div className="space-y-2">
                <Label htmlFor="dev-email">Email</Label>
                <Input
                  id="dev-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dev-password">Password</Label>
                <Input
                  id="dev-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading === "dev"}
              >
                {loading === "dev" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" />
                )}
                Sign In (Dev)
              </Button>
            </form>
            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                or
              </span>
            </div>
          </>
        )}

        {/* Email magic link */}
        <form onSubmit={handleEmailSignIn} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={loading === "email"}
          >
            {loading === "email" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            Magic Link
          </Button>
        </form>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => signIn("google", { callbackUrl })}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Music className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">VizWave</span>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Create stunning music visualizer videos
          </p>
        </div>
        <Suspense>
          <SignInContent />
        </Suspense>
      </div>
    </div>
  );
}
