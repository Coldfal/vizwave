/**
 * Client-side video exporter.
 *
 * Records the preview canvas + audio via MediaRecorder in the user's
 * browser and returns a .webm Blob. The editor's preview canvas
 * component registers a "start" function (via registerStartExport)
 * that owns all the refs — canvas, audio element, AudioContext,
 * source node. The Export panel just calls `startExport`.
 *
 * Constraints this flow has:
 *  - The browser tab must stay open and focused while recording.
 *  - The recording takes as long as the track (realtime capture).
 *  - Output is WebM; MP4 conversion can be added later with ffmpeg.wasm.
 */

export type ExportStage = "preparing" | "recording" | "finalizing";

export interface ExportProgress {
  stage: ExportStage;
  elapsed: number; // seconds
  total: number; // seconds
}

export interface StartExportOpts {
  fps?: number; // default 30
  videoBitsPerSecond?: number; // default 8_000_000
  onProgress?: (p: ExportProgress) => void;
  signal?: AbortSignal; // for cancellation
}

export interface ExportResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export type StartExport = (opts: StartExportOpts) => Promise<ExportResult>;

// Module-level registration — PreviewCanvas populates this on mount.
let registeredStart: StartExport | null = null;

export function registerStartExport(fn: StartExport | null) {
  registeredStart = fn;
}

export function canExport() {
  return registeredStart !== null;
}

export async function startExport(opts: StartExportOpts): Promise<ExportResult> {
  if (!registeredStart) {
    throw new Error("Preview canvas not ready yet. Try again in a moment.");
  }
  return registeredStart(opts);
}

// Pick the best supported WebM codec at runtime.
export function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return "video/webm";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke later so the browser can finish writing the file
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
