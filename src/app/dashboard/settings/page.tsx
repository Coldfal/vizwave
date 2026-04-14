"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Shield } from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account settings
        </p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" />
              Email
            </Label>
            <Input
              id="email"
              value={session?.user?.email || ""}
              disabled
              className="max-w-md"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              Account ID
            </Label>
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 text-xs">
                {session?.user?.id || "..."}
              </code>
              <Badge variant="secondary">
                {session?.user ? "Active" : "..."}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
