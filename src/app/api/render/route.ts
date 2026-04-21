import { spawn, spawnSync } from "node:child_process";
import { mkdir, stat, readFile } from "node:fs/promises";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { createCanvas, loadImage, type Image } from "@napi-rs/canvas";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { computeSpectrum } from "@/lib/render/audio-spectrum";
import { isRemovedPreset } from "@/lib/presets/removed";
import { renderFrame, createBeatState } from "@/components/editor/frame-renderer";
import { DEFAULT_PROJECT_CONFIG, type ProjectConfig } from "@/lib/types";

const FFMPEG = ffmpegInstaller.path;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3600;

// ─── Encoder probe (cached at module scope) ───────────────────────

type EncoderChoice = {
  name: string;
  args: string[];
};

let cachedEncoder: EncoderChoice | null = null;

function pickEncoder(crf: number): EncoderChoice {
  if (cachedEncoder) return cachedEncoder;
  let list = "";
  try {
    const out = spawnSync(FFMPEG, ["-hide_banner", "-encoders"], {
      encoding: "utf8",
      timeout: 10_000,
    });
    list = (out.stdout || "") + (out.stderr || "");
  } catch {
    list = "";
  }
  const has = (name: string) => list.includes(name);
  let choice: EncoderChoice;
  // Hardware encoders (NVENC/QSV/AMF) are a minefield across driver and
  // ffmpeg versions — the @ffmpeg-installer build ships an older NVENC SDK
  // that rejects both new (p1-p7) and old-style presets on recent drivers.
  // libx264 -preset ultrafast keeps close pace with NVENC on modern CPUs
  // and is the only choice that reliably works everywhere. Override via
  // VIZWAVE_ENCODER=h264_nvenc|h264_qsv|h264_amf if you want to try HW.
  const forced = process.env.VIZWAVE_ENCODER?.trim();
  if (forced === "h264_nvenc" && has("h264_nvenc")) {
    choice = {
      name: "h264_nvenc",
      args: ["-c:v", "h264_nvenc", "-qp", String(crf)],
    };
  } else if (forced === "h264_qsv" && has("h264_qsv")) {
    choice = {
      name: "h264_qsv",
      args: ["-c:v", "h264_qsv", "-global_quality", String(crf)],
    };
  } else if (forced === "h264_amf" && has("h264_amf")) {
    choice = {
      name: "h264_amf",
      args: ["-c:v", "h264_amf", "-rc", "cqp", "-qp_i", String(crf), "-qp_p", String(crf)],
    };
  } else {
    choice = {
      name: "libx264",
      args: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", String(crf)],
    };
  }
  cachedEncoder = choice;
  return choice;
}

// ─── Helpers ───────────────────────────────────────────────────────

interface RenderBody {
  projectId: string;
  fps?: number;
  crf?: number;
}

function resolveLocalPath(publicUrl: string): string {
  if (publicUrl.startsWith("/")) {
    return path.join(process.cwd(), "public", publicUrl.replace(/^\//, ""));
  }
  return publicUrl;
}

async function tryLoadImage(url: string | null | undefined): Promise<Image | null> {
  if (!url) return null;
  try {
    const localPath = resolveLocalPath(url);
    const buf = await readFile(localPath);
    return await loadImage(buf);
  } catch {
    return null;
  }
}

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ─── Route ─────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: RenderBody;
  try {
    body = (await req.json()) as RenderBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { projectId } = body;
  const fps = body.fps ?? 30;
  const crf = body.crf ?? 20;

  if (!projectId) {
    return new Response(JSON.stringify({ error: "projectId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id)))
    .limit(1);

  if (!project) {
    return new Response(JSON.stringify({ error: "Project not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!project.audioUrl) {
    return new Response(JSON.stringify({ error: "Project has no audio" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (isRemovedPreset(project.presetId)) {
    return new Response(
      JSON.stringify({ error: "Preset no longer available — open the project and pick a replacement." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const audioLocalPath = resolveLocalPath(project.audioUrl);
  try {
    await stat(audioLocalPath);
  } catch {
    return new Response(
      JSON.stringify({ error: `Audio file not found on disk: ${audioLocalPath}` }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const rendersDir = path.join(process.cwd(), "public", "renders");
  await mkdir(rendersDir, { recursive: true });
  const outputFilename = `${project.id}-${Date.now()}.mp4`;
  const outputPath = path.join(rendersDir, outputFilename);
  const outputUrl = `/renders/${outputFilename}`;

  // ─── Stream progress back via SSE ────────────────────────────
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: unknown) => {
        try { controller.enqueue(enc.encode(sseEvent(obj))); } catch { /* closed */ }
      };
      const startTs = Date.now();

      try {
        send({ stage: "analysing_audio" });
        const spectrum = await computeSpectrum({
          inputPath: audioLocalPath,
          fps,
          fftSize: 2048,
          sampleRate: 44100,
          smoothing: 0.7,
          minDecibels: -100,
          maxDecibels: -30,
        });

        send({ stage: "loading_assets", frameCount: spectrum.frames.length, durationSec: spectrum.duration });

        const [logoImg, bgImg, overlayImg] = await Promise.all([
          tryLoadImage(project.logoUrl),
          tryLoadImage(project.backgroundUrl || project.logoUrl),
          tryLoadImage(project.overlayUrl),
        ]);

        // ─── Set up node-canvas ───────────────────────────────
        const W = 1920;
        const H = 1080;
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext("2d");
        // Type assertion: @napi-rs/canvas context is structurally compatible
        // with the CanvasRenderingContext2D parts we use.
        const ctxAny = ctx as unknown as CanvasRenderingContext2D;
        const canvasAny = canvas as unknown as HTMLCanvasElement;

        const configRaw = project.config
          ? (JSON.parse(project.config) as Partial<ProjectConfig>)
          : {};
        const config: ProjectConfig = { ...DEFAULT_PROJECT_CONFIG, ...configRaw };
        const beatState = createBeatState();

        // ─── Spawn ffmpeg ────────────────────────────────────
        const encoder = pickEncoder(crf);
        console.log(`[render] using encoder ${encoder.name}, ${spectrum.frames.length} frames`);

        const ffmpegProc = spawn(FFMPEG, [
          "-y",
          "-hide_banner",
          "-loglevel", "warning",
          "-f", "image2pipe",
          "-vcodec", "mjpeg",
          "-framerate", String(fps),
          "-thread_queue_size", "512",
          "-i", "-",
          "-i", audioLocalPath,
          ...encoder.args,
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-b:a", "192k",
          "-shortest",
          "-movflags", "+faststart",
          outputPath,
        ]);

        const ffmpegErrChunks: Buffer[] = [];
        ffmpegProc.stderr?.on("data", (d: Buffer) => {
          ffmpegErrChunks.push(d);
          console.error(`[ffmpeg] ${d.toString("utf8").trim()}`);
        });
        // stdin errors (EPIPE when ffmpeg dies early) must be swallowed
        // here so the stream can surface a useful message via the catch
        // block instead of crashing the whole Next server.
        ffmpegProc.stdin?.on("error", (e) => {
          console.error(`[ffmpeg stdin] ${(e as Error).message}`);
        });
        let ffmpegExitCode: number | null = null;
        const ffmpegClose = new Promise<number>((resolve, reject) => {
          ffmpegProc.on("close", (code) => {
            ffmpegExitCode = code ?? 0;
            resolve(code ?? 0);
          });
          ffmpegProc.on("error", reject);
        });

        send({ stage: "rendering", encoder: encoder.name });

        // ─── Render loop ─────────────────────────────────────
        // Overlap: while @napi-rs/canvas encodes frame N on the libuv
        // thread pool, we render frame N+1 on the main JS thread. Cuts
        // wall time by roughly the slower of the two stages.
        const frameCount = spectrum.frames.length;
        const binsPerFrame = spectrum.fftSize / 2;
        let lastProgressTs = Date.now();
        const progressIntervalMs = 250;

        const renderOne = (i: number) => {
          const t = i / fps;
          const dt = 1 / fps;
          const bytes = spectrum.frames[i];
          const freq = new Array<number>(binsPerFrame);
          for (let j = 0; j < binsPerFrame; j++) freq[j] = bytes[j] / 255;
          renderFrame({
            ctx: ctxAny,
            canvas: canvasAny,
            W,
            H,
            t,
            dt,
            freq,
            beatFreq: freq,
            beatState,
            config,
            presetId: project.presetId,
            logoImg,
            bgImg,
            bgVideo: null,
            overlayImg,
          });
        };

        const writeJpeg = async (jpeg: Buffer) => {
          const stdin = ffmpegProc.stdin;
          if (!stdin || stdin.destroyed) {
            const stderr = Buffer.concat(ffmpegErrChunks).toString("utf8");
            throw new Error(`ffmpeg stdin closed: ${stderr.slice(-800)}`);
          }
          if (!stdin.write(jpeg)) {
            await new Promise<void>((r) => stdin.once("drain", () => r()));
          }
        };

        // Prime: render frame 0 + kick off its encode
        renderOne(0);
        let pendingEncode: Promise<Buffer> = canvas.encode("jpeg", 92);

        for (let i = 1; i < frameCount; i++) {
          // In parallel: render frame i on main thread, encode of frame
          // i-1 runs on the libuv thread pool.
          renderOne(i);
          const [jpegPrev] = await Promise.all([
            pendingEncode,
            // NB: renderOne ran synchronously already; this array is for
            // symmetry in case we add more parallel work later.
          ]);
          if (ffmpegExitCode !== null) {
            const stderr = Buffer.concat(ffmpegErrChunks).toString("utf8");
            throw new Error(
              `ffmpeg exited early (code ${ffmpegExitCode}) after ${i - 1} frames: ${stderr.slice(-800)}`,
            );
          }
          await writeJpeg(jpegPrev);
          pendingEncode = canvas.encode("jpeg", 92);

          const now = Date.now();
          if (now - lastProgressTs > progressIntervalMs || i === frameCount - 1) {
            const elapsedMs = now - startTs;
            const rate = i > 0 ? i / (elapsedMs / 1000) : 0;
            const etaSec = rate > 0 ? (frameCount - i) / rate : 0;
            send({
              stage: "rendering",
              frame: i + 1,
              frameCount,
              elapsedMs,
              etaSec,
              fps: rate,
            });
            lastProgressTs = now;
          }
        }
        // Flush the tail encode
        const finalJpeg = await pendingEncode;
        await writeJpeg(finalJpeg);

        ffmpegProc.stdin?.end();
        send({ stage: "encoding" });
        const code = await ffmpegClose;
        if (code !== 0) {
          const stderr = Buffer.concat(ffmpegErrChunks).toString("utf8");
          throw new Error(`ffmpeg exited with code ${code}: ${stderr.slice(0, 1000)}`);
        }

        const stats = await stat(outputPath);
        const elapsedMs = Date.now() - startTs;

        send({
          stage: "done",
          url: outputUrl,
          filename: outputFilename,
          sizeBytes: stats.size,
          frameCount,
          fps,
          encoder: encoder.name,
          durationSec: spectrum.duration,
          elapsedMs,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ stage: "error", error: msg });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
