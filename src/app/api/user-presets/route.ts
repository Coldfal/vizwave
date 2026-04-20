import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userPresets } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(userPresets)
    .where(eq(userPresets.userId, session.user.id))
    .orderBy(desc(userPresets.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const presetId = typeof body.presetId === "string" ? body.presetId : "";
  const config = body.config;

  if (!name || !presetId || !config) {
    return NextResponse.json({ error: "Missing name, presetId, or config" }, { status: 400 });
  }

  const [row] = await db
    .insert(userPresets)
    .values({
      userId: session.user.id,
      name: name.slice(0, 60),
      presetId,
      config: typeof config === "string" ? config : JSON.stringify(config),
    })
    .returning();

  return NextResponse.json(row);
}
