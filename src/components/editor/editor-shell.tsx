"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { EditorSidebar } from "./editor-sidebar";
import { PreviewCanvas } from "./preview-canvas";
import { PlaybackControls } from "./playback-controls";
import { Music, ArrowLeft, Save, Loader2, Pencil, AlertTriangle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { isRemovedPreset } from "@/lib/presets/removed";

export function EditorShell() {
  const project = useEditorStore((s) => s.project);
  const config = useEditorStore((s) => s.config);
  const isDirty = useEditorStore((s) => s.isDirty);
  const resetDirty = useEditorStore((s) => s.resetDirty);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const presetBlocked = isRemovedPreset(project?.presetId);

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
          <div className="relative flex flex-1 items-center justify-center bg-black/20 p-4">
            <PreviewCanvas />
            {presetBlocked && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/85 p-6 backdrop-blur-sm">
                <div className="max-w-md rounded-lg border border-yellow-500/40 bg-card p-6 shadow-xl">
                  <div className="mb-3 flex items-center gap-2 text-yellow-400">
                    <AlertTriangle className="h-5 w-5" />
                    <h2 className="text-base font-semibold">Preset no longer available</h2>
                  </div>
                  <p className="mb-4 text-sm text-muted-foreground">
                    This project uses a GPU shader preset that has been removed.
                    Pick a replacement from the Preset panel to continue editing
                    and exporting.
                  </p>
                  <Button onClick={() => setActivePanel("preset")}>
                    Open Preset Panel
                  </Button>
                </div>
              </div>
            )}
          </div>
          <PlaybackControls />
        </div>
      </div>
    </div>
  );
}
