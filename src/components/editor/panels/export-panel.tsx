"use client";

import { useRef, useState } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Square } from "lucide-react";
import { toast } from "sonner";
import { isRemovedPreset } from "@/lib/presets/removed";

type Fps = 24 | 30 | 60;

interface ProgressState {
  stage: string;
  frame?: number;
  frameCount?: number;
  elapsedMs?: number;
  etaSec?: number;
  fps?: number;
  encoder?: string;
}

function formatSecs(s: number): string {
  if (!isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function sanitizeFilename(name: string) {
  return (name || "video").replace(/[^a-z0-9\-_.]/gi, "_").slice(0, 80);
}

function stageLabel(stage: string): string {
  switch (stage) {
    case "analysing_audio": return "Analysing audio…";
    case "loading_assets": return "Loading assets…";
    case "rendering": return "Rendering frames…";
    case "encoding": return "Finalising video…";
    case "done": return "Done!";
    default: return stage;
  }
}

export function ExportPanel() {
  const project = useEditorStore((s) => s.project);
  const audioUrl = useEditorStore((s) => s.audioUrl);
  const isDirty = useEditorStore((s) => s.isDirty);
  const presetBlocked = isRemovedPreset(project?.presetId);
  const [exporting, setExporting] = useState(false);
  const [fps, setFps] = useState<Fps>(30);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleExport() {
    if (!project) return;
    if (!audioUrl) {
      toast.error("Upload an audio file first.");
      return;
    }
    if (isDirty) {
      toast.info("Saving latest edits…");
      await new Promise((r) => setTimeout(r, 1800));
    }

    setExporting(true);
    setProgress({ stage: "analysing_audio" });
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, fps }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        let msg = `HTTP ${res.status}`;
        try { msg = JSON.parse(text).error || msg; } catch { /* non-JSON */ }
        throw new Error(msg);
      }

      // Stream SSE events from the server
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let final: ProgressState | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const raw = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 2);
          if (!raw.startsWith("data:")) continue;
          const jsonStr = raw.slice(5).trim();
          try {
            const evt = JSON.parse(jsonStr) as ProgressState & {
              url?: string;
              error?: string;
              durationSec?: number;
            };
            if (evt.stage === "error") {
              throw new Error(evt.error || "Render failed");
            }
            setProgress(evt);
            if (evt.stage === "done") {
              final = evt;
              if (evt.url) {
                const a = document.createElement("a");
                a.href = evt.url;
                a.download = `${sanitizeFilename(project.name || "video")}.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
              const realtime = evt.durationSec ?? 0;
              const actual = (evt.elapsedMs ?? 0) / 1000;
              const ratio = realtime > 0 ? (realtime / actual).toFixed(2) : "?";
              const enc = evt.encoder ? ` via ${evt.encoder}` : "";
              toast.success(
                `Rendered in ${formatSecs(actual)} (${ratio}× realtime${enc}).`,
              );
            }
          } catch (e) {
            if (e instanceof Error && e.message !== "Render failed") throw e;
          }
        }
      }

      if (!final) throw new Error("Stream ended before completion");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        toast.info("Export cancelled.");
      } else {
        toast.error(err instanceof Error ? err.message : "Export failed");
      }
    } finally {
      setExporting(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  const pct =
    progress && progress.frame && progress.frameCount
      ? Math.min(100, (progress.frame / progress.frameCount) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Export</h3>

      <div className="space-y-2">
        <Label>Frame rate</Label>
        <Select value={String(fps)} onValueChange={(v) => v && setFps(Number(v) as Fps)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24">24 fps</SelectItem>
            <SelectItem value="30">30 fps</SelectItem>
            <SelectItem value="60">60 fps</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {exporting && progress && (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{stageLabel(progress.stage)}</span>
            {progress.frame && progress.frameCount ? (
              <span className="font-mono text-muted-foreground">
                {progress.frame}/{progress.frameCount}
              </span>
            ) : null}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {progress.fps ? `${progress.fps.toFixed(1)} fps` : ""}
              {progress.encoder ? ` · ${progress.encoder}` : ""}
            </span>
            <span>
              {progress.etaSec && progress.etaSec > 0
                ? `ETA ${formatSecs(progress.etaSec)}`
                : ""}
            </span>
          </div>
        </div>
      )}

      {!exporting ? (
        <Button
          className="w-full"
          onClick={handleExport}
          disabled={!audioUrl || presetBlocked}
        >
          <Download className="mr-2 h-4 w-4" />
          Export Video
        </Button>
      ) : (
        <Button className="w-full" variant="destructive" onClick={handleCancel}>
          <Square className="mr-2 h-4 w-4" />
          Cancel Export
        </Button>
      )}

      {presetBlocked && (
        <p className="text-[11px] text-yellow-400">
          This project uses a removed preset. Pick a replacement in the Preset
          panel before exporting.
        </p>
      )}

      {!audioUrl && !presetBlocked && (
        <p className="text-[11px] text-muted-foreground">
          Upload an audio file first to enable export.
        </p>
      )}

      <div className="rounded-lg border border-border/30 bg-muted/20 p-3 text-[11px] text-muted-foreground space-y-1">
        <p className="font-medium text-foreground/80">Server render</p>
        <p>
          Frames are rendered with native Skia on your machine and muxed into
          MP4 (H.264 + AAC) via ffmpeg with the fastest hardware encoder
          available.
        </p>
      </div>
    </div>
  );
}
