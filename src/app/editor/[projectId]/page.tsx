"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useEditorStore } from "@/stores/editor-store";
import { EditorShell } from "@/components/editor/editor-shell";

export default function EditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const setProject = useEditorStore((s) => s.setProject);

  useEffect(() => {
    async function loadProject() {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        router.push("/dashboard");
        return;
      }
      const project = await res.json();
      setProject(project);
    }
    loadProject();
  }, [projectId, setProject, router]);

  const project = useEditorStore((s) => s.project);

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <EditorShell />;
}
