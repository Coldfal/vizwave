import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { DEFAULT_PROJECT_CONFIG } from "@/lib/types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, session.user.id))
    .orderBy(desc(projects.createdAt));

  return NextResponse.json(userProjects);
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [project] = await db
    .insert(projects)
    .values({
      userId: session.user.id,
      name: "Untitled Video",
      presetId: "radial-waveform",
      audioUrl: "/demo/demo-track.mp3",
      logoUrl: "/demo/demo-logo.png",
      config: JSON.stringify(DEFAULT_PROJECT_CONFIG),
    })
    .returning();

  return NextResponse.json(project);
}
