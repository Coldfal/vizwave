import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      tier: users.subscriptionTier,
      status: users.subscriptionStatus,
      exportsUsed: users.exportsThisMonth,
      exportsResetAt: users.exportsResetAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id));

  return NextResponse.json(user);
}
