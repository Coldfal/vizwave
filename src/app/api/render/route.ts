import { NextResponse } from "next/server";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { computeSpectrum } from "@/lib/render/audio-spectrum";
import { isRemovedPreset } from "@/lib/presets/removed";

const FFMPEG = ffmpegInstaller.path;

// ─── Encoder probe (cached at module scope) ───────────────────────
// Pick the fastest available h264 encoder. Hardware encoders are
// typically 3-5× faster than libx264 at comparable quality.

type EncoderChoice = {
  name: string;
  args: string[]; // ffmpeg flags, including `-c:v <enc>` and quality/preset
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
  if (has("h264_nvenc")) {
    choice = {
      name: "h264_nvenc",
      args: ["-c:v", "h264_nvenc", "-preset", "p5", "-tune", "hq", "-rc", "vbr", "-cq", String(crf), "-b:v", "0"],
    };
  } else if (has("h264_qsv")) {
    choice = {
      name: "h264_qsv",
      args: ["-c:v", "h264_qsv", "-preset", "medium", "-global_quality", String(crf)],
    };
  } else if (has("h264_amf")) {
    choice = {
      name: "h264_amf",
      args: ["-c:v", "h264_amf", "-quality", "balanced", "-rc", "cqp", "-qp_i", String(crf), "-qp_p", String(crf)],
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

// This route drives Puppeteer + ffmpeg — it must run for potentially many
// minutes. Mark as dynamic and Node runtime only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3600; // 1 hour

interface RenderBody {
  projectId: string;
  fps?: number;
  videoBitsPerSecond?: number;
  crf?: number; // x264 quality, 18 (hq) - 28 (low); default 20
}

function resolveLocalPath(publicUrl: string): string {
  // URLs in the db look like "/uploads/abc.mp3" — resolve under public/
  if (publicUrl.startsWith("/")) {
    return path.join(process.cwd(), "public", publicUrl.replace(/^\//, ""));
  }
  return publicUrl;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RenderBody;
  try {
    body = (await req.json()) as RenderBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { projectId } = body;
  const fps = body.fps ?? 30;
  const crf = body.crf ?? 20;

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!project.audioUrl) {
    return NextResponse.json(
      { error: "Project has no audio to render" },
      { status: 400 },
    );
  }
  if (isRemovedPreset(project.presetId)) {
    return NextResponse.json(
      { error: "Preset no longer available — open the project and pick a replacement." },
      { status: 400 },
    );
  }

  const audioLocalPath = resolveLocalPath(project.audioUrl);
  try {
    await stat(audioLocalPath);
  } catch {
    return NextResponse.json(
      { error: `Audio file not found on disk: ${audioLocalPath}` },
      { status: 400 },
    );
  }

  // Output location
  const rendersDir = path.join(process.cwd(), "public", "renders");
  await mkdir(rendersDir, { recursive: true });
  const outputFilename = `${project.id}-${Date.now()}.mp4`;
  const outputPath = path.join(rendersDir, outputFilename);
  const outputUrl = `/renders/${outputFilename}`;

  const startTs = Date.now();
  let browser: Browser | null = null;
  let ffmpegProc: ReturnType<typeof spawn> | null = null;

  try {
    // 1. Analyse audio → per-frame spectrum (matches getByteFrequencyData)
    const spectrum = await computeSpectrum({
      inputPath: audioLocalPath,
      fps,
      fftSize: 2048,
      sampleRate: 44100,
      smoothing: 0.7,
      minDecibels: -100,
      maxDecibels: -30,
    });

    // Flatten frames into one contiguous Uint8Array for fast transfer
    const binsPerFrame = spectrum.fftSize / 2;
    const flat = new Uint8Array(binsPerFrame * spectrum.frames.length);
    for (let i = 0; i < spectrum.frames.length; i++) {
      flat.set(spectrum.frames[i], i * binsPerFrame);
    }

    // 2. Launch headless Chrome
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page: Page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    // Route render-frame page to localhost (Puppeteer runs on the same machine)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
    await page.goto(`${baseUrl}/render-frame/${project.id}`, {
      waitUntil: "networkidle0",
      timeout: 60_000,
    });

    await page.waitForFunction("window.__renderReady === true", { timeout: 60_000 });

    // 3. Inject spectrum into page (chunked to avoid huge single-shot payload).
    const CHUNK_BYTES = 4 * 1024 * 1024; // 4 MB per chunk
    await page.evaluate((totalBytes, bins) => {
      (window as unknown as { __spectrumBuf: Uint8Array; __bins: number }).__spectrumBuf =
        new Uint8Array(totalBytes);
      (window as unknown as { __bins: number }).__bins = bins;
    }, flat.length, binsPerFrame);

    for (let offset = 0; offset < flat.length; offset += CHUNK_BYTES) {
      const chunk = flat.subarray(offset, Math.min(offset + CHUNK_BYTES, flat.length));
      // Pass chunk as regular array (puppeteer serialises as JSON)
      await page.evaluate(
        (arr: number[], off: number) => {
          const buf = (window as unknown as { __spectrumBuf: Uint8Array }).__spectrumBuf;
          buf.set(arr, off);
        },
        Array.from(chunk),
        offset,
      );
    }

    await page.evaluate((fpsVal) => {
      const buf = (window as unknown as { __spectrumBuf: Uint8Array }).__spectrumBuf;
      const bins = (window as unknown as { __bins: number }).__bins;
      window.__setSpectrum(buf, bins);
      window.__setFps(fpsVal);
    }, fps);

    const frameCount: number = await page.evaluate(() => window.__getFrameCount());
    if (frameCount <= 0) {
      throw new Error("Frame count is zero — audio decode or FFT may have failed");
    }

    // 4. Boot ffmpeg — receives a sequence of JPEG frames via stdin, muxes
    //    with the original audio, outputs h264 MP4. Uses the best h264
    //    encoder available (NVENC > QSV > AMF > libx264).
    const encoder = pickEncoder(crf);
    console.log(`[render] using encoder ${encoder.name}`);
    ffmpegProc = spawn(FFMPEG, [
      "-y",
      "-hide_banner",
      "-loglevel", "error",
      "-f", "image2pipe",
      "-framerate", String(fps),
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
    ffmpegProc.stderr?.on("data", (d: Buffer) => ffmpegErrChunks.push(d));
    const ffmpegClose = new Promise<number>((resolve, reject) => {
      ffmpegProc?.on("close", (code) => resolve(code ?? 0));
      ffmpegProc?.on("error", reject);
    });

    // 5. Render each frame and pipe a binary JPEG to ffmpeg.
    //    We use page.screenshot({ encoding: "binary" }) instead of
    //    toDataURL → base64: skips the ~30 % base64 bloat and the
    //    slow synchronous toDataURL path in Blink.
    const clip = { x: 0, y: 0, width: 1920, height: 1080 };
    for (let i = 0; i < frameCount; i++) {
      await page.evaluate((frameIdx: number) => {
        window.__renderFrame(frameIdx);
      }, i);
      const shot = await page.screenshot({
        type: "jpeg",
        quality: 92,
        encoding: "binary",
        clip,
        omitBackground: false,
        captureBeyondViewport: false,
      });
      const buf = Buffer.isBuffer(shot) ? shot : Buffer.from(shot as Uint8Array);
      if (!ffmpegProc.stdin?.write(buf)) {
        await new Promise<void>((r) => ffmpegProc?.stdin?.once("drain", () => r()));
      }
    }

    ffmpegProc.stdin?.end();
    const code = await ffmpegClose;
    if (code !== 0) {
      const stderr = Buffer.concat(ffmpegErrChunks).toString("utf8");
      throw new Error(`ffmpeg exited with code ${code}: ${stderr.slice(0, 1000)}`);
    }

    await browser.close();
    browser = null;

    const stats = await stat(outputPath);
    const elapsedMs = Date.now() - startTs;

    return NextResponse.json({
      ok: true,
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
    try { ffmpegProc?.kill(); } catch { /* noop */ }
    try { await browser?.close(); } catch { /* noop */ }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
