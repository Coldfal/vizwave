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
import { startExport, downloadBlob, type ExportProgress } from "@/lib/exporter";

type Fps = 30 | 60;

function formatSecs(s: number): string {
  if (!isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function sanitizeFilename(name: string) {
  return (name || "video").replace(/[^a-z0-9\-_.]/gi, "_").slice(0, 80);
}

export function ExportPanel() {
  const project = useEditorStore((s) => s.project);
  const audioUrl = useEditorStore((s) => s.audioUrl);
  const [exporting, setExporting] = useState(false);
  const [fps, setFps] = useState<Fps>(30);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleExport() {
    if (!project) return;
    if (!audioUrl) {
      toast.error("Upload an audio file first.");
      return;
    }

    setExporting(true);
    setProgress({ stage: "preparing", elapsed: 0, total: 0 });
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const result = await startExport({
        fps,
        onProgress: (p) => setProgress(p),
        signal: abort.signal,
      });
      downloadBlob(
        result.blob,
        `${sanitizeFilename(project.name || "video")}.webm`,
      );
      toast.success("Export complete — download started.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      if (msg === "Export cancelled") {
        toast.info("Export cancelled.");
      } else {
        toast.error(msg);
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
    progress && progress.total > 0
      ? Math.min(100, (progress.elapsed / progress.total) * 100)
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
            <SelectItem value="30">30 fps (smaller file)</SelectItem>
            <SelectItem value="60">60 fps (smoother)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border/30 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground/80">How export works</p>
        <p>
          The track is played through once in real time while the preview is
          recorded. Don&apos;t close or hide the tab until it finishes.
        </p>
        <p>Output: WebM (VP9 + Opus) at 1920×1080.</p>
      </div>

      {exporting && progress && (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium capitalize">{progress.stage}…</span>
            <span className="font-mono text-muted-foreground">
              {formatSecs(progress.elapsed)} / {formatSecs(progress.total)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {!exporting ? (
        <Button
          className="w-full"
          onClick={handleExport}
          disabled={!audioUrl}
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

      {!audioUrl && (
        <p className="text-[11px] text-muted-foreground">
          Upload an audio file first to enable export.
        </p>
      )}
    </div>
  );
}
