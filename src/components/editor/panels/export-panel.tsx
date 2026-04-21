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
import { Download, Square, Server, MonitorPlay } from "lucide-react";
import { toast } from "sonner";
import { startExport, downloadBlob, type ExportProgress } from "@/lib/exporter";
import { isRemovedPreset } from "@/lib/presets/removed";

type Fps = 30 | 60;
type Mode = "client" | "server";

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
  const isDirty = useEditorStore((s) => s.isDirty);
  const presetBlocked = isRemovedPreset(project?.presetId);
  const [exporting, setExporting] = useState(false);
  const [mode, setMode] = useState<Mode>("server");
  const [fps, setFps] = useState<Fps>(30);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [serverStage, setServerStage] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  async function handleClientExport() {
    if (!project || !audioUrl) return;
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
      downloadBlob(result.blob, `${sanitizeFilename(project.name || "video")}.webm`);
      toast.success("Export complete — download started.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      if (msg === "Export cancelled") toast.info("Export cancelled.");
      else toast.error(msg);
    } finally {
      setExporting(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  async function handleServerExport() {
    if (!project || !audioUrl) return;
    setExporting(true);
    setServerStage("Starting server render (analysing audio + launching headless Chrome)…");
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, fps }),
        signal: abort.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Render failed" }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        url: string;
        frameCount: number;
        elapsedMs: number;
        durationSec: number;
        encoder?: string;
      };
      const realtime = data.durationSec;
      const actual = data.elapsedMs / 1000;
      const ratio = realtime > 0 ? (realtime / actual).toFixed(2) : "?";
      const enc = data.encoder ? ` via ${data.encoder}` : "";
      toast.success(
        `Render done in ${formatSecs(actual)} (${ratio}x realtime${enc}).`,
      );
      // Trigger download of the MP4
      const a = document.createElement("a");
      a.href = data.url;
      a.download = `${sanitizeFilename(project.name || "video")}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        toast.info("Render cancelled.");
      } else {
        const msg = err instanceof Error ? err.message : "Render failed";
        toast.error(msg);
      }
    } finally {
      setExporting(false);
      setServerStage("");
      abortRef.current = null;
    }
  }

  async function handleExport() {
    if (!project) return;
    if (!audioUrl) {
      toast.error("Upload an audio file first.");
      return;
    }
    if (isDirty) {
      // Server render reads from DB, so the latest edits need to be saved.
      toast.info("Saving latest edits…");
      await new Promise((r) => setTimeout(r, 1800)); // let auto-save flush
    }
    if (mode === "client") await handleClientExport();
    else await handleServerExport();
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
        <Label className="text-xs">Render mode</Label>
        <div className="grid grid-cols-1 gap-1.5">
          <button
            onClick={() => setMode("server")}
            className={`flex items-start gap-2 rounded-md border p-2.5 text-left transition-colors ${
              mode === "server"
                ? "border-primary bg-primary/10"
                : "border-border/50 hover:border-border hover:bg-muted/40"
            }`}
          >
            <Server className="mt-0.5 h-4 w-4 text-primary shrink-0" />
            <div>
              <div className="text-xs font-medium">Server (headless + ffmpeg)</div>
              <div className="text-[10px] text-muted-foreground">
                Faster than realtime. Outputs MP4. Works in the background.
              </div>
            </div>
          </button>
          <button
            onClick={() => setMode("client")}
            className={`flex items-start gap-2 rounded-md border p-2.5 text-left transition-colors ${
              mode === "client"
                ? "border-primary bg-primary/10"
                : "border-border/50 hover:border-border hover:bg-muted/40"
            }`}
          >
            <MonitorPlay className="mt-0.5 h-4 w-4 text-primary shrink-0" />
            <div>
              <div className="text-xs font-medium">Browser (MediaRecorder)</div>
              <div className="text-[10px] text-muted-foreground">
                Realtime capture in this tab. Outputs WebM.
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Frame rate</Label>
        <Select value={String(fps)} onValueChange={(v) => v && setFps(Number(v) as Fps)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 fps</SelectItem>
            <SelectItem value="60">60 fps</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {exporting && progress && mode === "client" && (
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

      {exporting && mode === "server" && (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="text-xs font-medium">Server rendering…</div>
          <div className="text-[11px] text-muted-foreground">
            {serverStage || "Working…"}
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-pulse bg-primary" />
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
        {mode === "server" ? (
          <>
            <p className="font-medium text-foreground/80">Server render</p>
            <p>
              Runs a headless Chrome + ffmpeg pipeline on your dev machine.
              Faster than realtime depending on CPU. Output: MP4 (H.264 + AAC).
            </p>
          </>
        ) : (
          <>
            <p className="font-medium text-foreground/80">Browser render</p>
            <p>
              Plays the track through once in real time while the preview is
              recorded. Keep this tab focused. Output: WebM (VP9 + Opus).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
