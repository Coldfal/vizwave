"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { EditorSidebar } from "./editor-sidebar";
import { PreviewCanvas } from "./preview-canvas";
import { PlaybackControls } from "./playback-controls";
import { Music, ArrowLeft, Save, Loader2, Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function EditorShell() {
  const project = useEditorStore((s) => s.project);
  const config = useEditorStore((s) => s.config);
  const isDirty = useEditorStore((s) => s.isDirty);
  const resetDirty = useEditorStore((s) => s.resetDirty);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Auto-save on config change (debounced) — saves all project state
  const save = useCallback(async () => {
    if (!project || savingRef.current) return;
    savingRef.current = true;
    try {
      const payload: Record<string, unknown> = {
        config: JSON.stringify(config),
        presetId: project.presetId,
        logoUrl: project.logoUrl,
        backgroundUrl: project.backgroundUrl,
        overlayUrl: project.overlayUrl,
        audioUrl: project.audioUrl,
        audioDuration: project.audioDuration,
      };
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      resetDirty();
    } finally {
      savingRef.current = false;
    }
  }, [project, config, resetDirty]);

  const saveName = useCallback(async () => {
    const trimmed = nameValue.trim();
    if (!project || !trimmed || trimmed === project.name) {
      setEditingName(false);
      return;
    }
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    useEditorStore.setState((s) => ({
      project: s.project ? { ...s.project, name: trimmed } : null,
    }));
    setEditingName(false);
  }, [project, nameValue]);

  useEffect(() => {
    if (!isDirty) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(save, 1500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [isDirty, save]);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-12 items-center justify-between border-b border-border/50 px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Music className="h-4 w-4 text-primary" />
            {editingName ? (
              <input
                ref={nameInputRef}
                className="h-7 w-48 rounded border border-border bg-muted/50 px-2 text-sm font-medium outline-none focus:border-primary"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                autoFocus
              />
            ) : (
              <button
                className="flex items-center gap-1.5 rounded px-1 text-sm font-medium hover:bg-muted/50"
                onClick={() => {
                  setNameValue(project?.name || "");
                  setEditingName(true);
                }}
              >
                {project?.name || "Untitled"}
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </span>
          )}
          {!isDirty && project && (
            <span className="text-xs text-muted-foreground">Saved</span>
          )}
          <Button size="sm" variant="outline" onClick={save}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <EditorSidebar />

        {/* Preview area */}
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center bg-black/20 p-4">
            <PreviewCanvas />
          </div>
          <PlaybackControls />
        </div>
      </div>
    </div>
  );
}
