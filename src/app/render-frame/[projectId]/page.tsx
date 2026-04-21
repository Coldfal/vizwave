import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { RenderClient } from "./render-client";

/**
 * Render-only page loaded by the server-side Puppeteer worker. Not
 * intended for humans to visit directly. Skips auth because the
 * Puppeteer client runs on the same host as the Next.js server.
 */
export default async function RenderFramePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) notFound();

  return (
    <RenderClient
      projectId={project.id}
      presetId={project.presetId}
      configJson={project.config}
      logoUrl={project.logoUrl}
      backgroundUrl={project.backgroundUrl}
      overlayUrl={project.overlayUrl}
    />
  );
}
