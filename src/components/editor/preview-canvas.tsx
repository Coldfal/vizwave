"use client";

import { useRef, useEffect, useCallback } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { renderPreset, generateProceduralFreq } from "./preset-renderers";
import type { RendererConfig } from "./preset-renderers";
import type { ProjectConfig, CustomText } from "@/lib/types";
import {
  registerStartExport,
  pickMimeType,
  type StartExport,
  type StartExportOpts,
  type ExportResult,
} from "@/lib/exporter";

// ─── Beat detection state ────────────────────────────────────────────

interface BeatState {
  prevBass: number;
  shakeX: number;
  shakeY: number;
  zoom: number;
  energy: number; // decaying beat energy for smooth effects
}

function detectBeat(freq: number[], state: BeatState, dt: number, config: { beatShake: boolean; beatZoom: boolean; beatShakeIntensity: number; beatZoomIntensity: number }) {
  // Bass energy (first ~15 bins ≈ 20-300 Hz)
  // Beat analyser always uses fftSize=2048 (1024 bins) with standard dB range
  const bassSlice = freq.slice(0, 15);
  const bass = bassSlice.reduce((s, v) => s + v, 0) / bassSlice.length;

  // Detect beat: sudden bass spike
  const threshold = 0.10;
  const isBeat = bass - state.prevBass > threshold && bass > 0.25;
  state.prevBass = bass;

  // Trigger on beat
  if (isBeat) {
    state.energy = Math.min(1, state.energy + 0.8);
  }

  // Decay
  state.energy *= Math.pow(0.04, dt); // fast decay

  // Apply shake
  if (config.beatShake && state.energy > 0.05) {
    const intensity = state.energy * config.beatShakeIntensity * 12;
    state.shakeX = (Math.random() - 0.5) * intensity;
    state.shakeY = (Math.random() - 0.5) * intensity;
  } else {
    state.shakeX *= 0.8;
    state.shakeY *= 0.8;
  }

  // Apply zoom
  if (config.beatZoom) {
    state.zoom = 1 + state.energy * config.beatZoomIntensity * 0.08;
  } else {
    state.zoom = 1;
  }

  return { bass, isBeat };
}

// ─── Component ───────────────────────────────────────────────────────

export function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const beatAnalyserRef = useRef<AnalyserNode | null>(null); // separate analyser for beat detection
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const beatRef = useRef<BeatState>({ prevBass: 0, shakeX: 0, shakeY: 0, zoom: 1, energy: 0 });
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const logoLoadedRef = useRef<string | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const bgLoadedRef = useRef<string | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const bgVideoLoadedRef = useRef<string | null>(null);
  const overlayImgRef = useRef<HTMLImageElement | null>(null);
  const overlayLoadedRef = useRef<string | null>(null);

  const config = useEditorStore((s) => s.config);
  const audioUrl = useEditorStore((s) => s.audioUrl);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const project = useEditorStore((s) => s.project);
  const presetId = project?.presetId;

  // Latest values — read from inside the RAF loop so config/preset changes
  // don't cancel and restart the animation (which caused flicker / "frozen" appearance).
  const configRef = useRef<ProjectConfig>(config);
  const presetIdRef = useRef<string | null | undefined>(presetId);
  const isPlayingRef = useRef<boolean>(isPlaying);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { presetIdRef.current = presetId; }, [presetId]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Load logo image
  useEffect(() => {
    const logoUrl = project?.logoUrl;
    if (!logoUrl) {
      logoImgRef.current = null;
      logoLoadedRef.current = null;
      return;
    }
    if (logoUrl === logoLoadedRef.current) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      logoImgRef.current = img;
      logoLoadedRef.current = logoUrl;
    };
    img.onerror = () => {
      logoImgRef.current = null;
    };
    img.src = logoUrl;
  }, [project?.logoUrl]);

  // Load background image (use dedicated bg, or fall back to logo)
  useEffect(() => {
    const bgUrl = project?.backgroundUrl || project?.logoUrl;
    if (!bgUrl) {
      bgImgRef.current = null;
      bgLoadedRef.current = null;
      return;
    }
    if (bgUrl === bgLoadedRef.current) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      bgImgRef.current = img;
      bgLoadedRef.current = bgUrl;
    };
    img.onerror = () => {
      bgImgRef.current = null;
    };
    img.src = bgUrl;
  }, [project?.backgroundUrl, project?.logoUrl]);

  // Load background video
  useEffect(() => {
    if (config.backgroundType !== "video") {
      if (bgVideoRef.current) {
        bgVideoRef.current.pause();
        bgVideoRef.current.src = "";
      }
      bgVideoRef.current = null;
      bgVideoLoadedRef.current = null;
      return;
    }
    const bgUrl = project?.backgroundUrl;
    if (!bgUrl) {
      bgVideoRef.current = null;
      bgVideoLoadedRef.current = null;
      return;
    }
    if (bgUrl === bgVideoLoadedRef.current) return;

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.src = bgUrl;
    video.play().catch(() => {});
    bgVideoRef.current = video;
    bgVideoLoadedRef.current = bgUrl;

    return () => {
      video.pause();
      video.src = "";
    };
  }, [project?.backgroundUrl, config.backgroundType]);

  // Load overlay image
  useEffect(() => {
    const overlayUrl = project?.overlayUrl;
    if (!overlayUrl) {
      overlayImgRef.current = null;
      overlayLoadedRef.current = null;
      return;
    }
    if (overlayUrl === overlayLoadedRef.current) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      overlayImgRef.current = img;
      overlayLoadedRef.current = overlayUrl;
    };
    img.onerror = () => {
      overlayImgRef.current = null;
    };
    img.src = overlayUrl;
  }, [project?.overlayUrl]);

  // Set up audio element
  useEffect(() => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    // Detect duration when metadata loads
    audio.addEventListener("loadedmetadata", () => {
      if (audio.duration && isFinite(audio.duration)) {
        useEditorStore.setState({ audioDuration: audio.duration });
      }
    });

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [audioUrl]);

  // Lazily create the audio pipeline (one AudioContext, source node, and
  // analysers). Called from play/pause and also from the exporter — both
  // are triggered by a user gesture, which satisfies AudioContext rules.
  const ensureAudioPipeline = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return null;
    if (audioContextRef.current && sourceRef.current) {
      return audioContextRef.current;
    }
    const ctx = new AudioContext();
    const currentPreset = presetIdRef.current;
    const currentConfig = configRef.current;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = currentPreset === "trap-nation" ? 16384 : 2048;
    analyser.smoothingTimeConstant = currentPreset === "trap-nation" ? 0.1 : currentConfig.waveformSmoothing;
    if (currentPreset === "trap-nation") {
      analyser.minDecibels = -40;
      analyser.maxDecibels = -30;
    }

    const beatAnalyser = ctx.createAnalyser();
    beatAnalyser.fftSize = 2048;
    beatAnalyser.smoothingTimeConstant = 0.5;

    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    source.connect(beatAnalyser);
    analyser.connect(ctx.destination);

    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    beatAnalyserRef.current = beatAnalyser;
    sourceRef.current = source;
    return ctx;
  }, []);

  // Play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      const ctx = ensureAudioPipeline();
      if (analyserRef.current) {
        // Keep analyser settings in sync with current preset/config.
        const a = analyserRef.current;
        if (presetId === "trap-nation") {
          a.fftSize = 16384;
          a.smoothingTimeConstant = 0.1;
          a.minDecibels = -40;
          a.maxDecibels = -30;
        } else {
          a.fftSize = 2048;
          a.smoothingTimeConstant = config.waveformSmoothing;
          a.minDecibels = -100;
          a.maxDecibels = -30;
        }
      }
      ctx?.resume();
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, config.waveformSmoothing, presetId, ensureAudioPipeline]);

  // Register the client-side video exporter. Runs once on mount.
  useEffect(() => {
    const startFn: StartExport = async (opts: StartExportOpts): Promise<ExportResult> => {
      const canvas = canvasRef.current;
      const audio = audioRef.current;
      if (!canvas) throw new Error("Canvas not mounted");
      if (!audio) throw new Error("No audio loaded — upload an audio file first");
      if (typeof MediaRecorder === "undefined") {
        throw new Error("MediaRecorder is not available in this browser");
      }

      const ctx = ensureAudioPipeline();
      const source = sourceRef.current;
      if (!ctx || !source) throw new Error("Failed to set up audio pipeline");

      opts.onProgress?.({ stage: "preparing", elapsed: 0, total: audio.duration || 0 });

      // Tee the audio to a MediaStreamDestination without disturbing the
      // existing analyser/speaker branch.
      const streamDest = ctx.createMediaStreamDestination();
      source.connect(streamDest);

      const videoStream = canvas.captureStream(opts.fps ?? 30);
      const combined = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...streamDest.stream.getAudioTracks(),
      ]);

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond: opts.videoBitsPerSecond ?? 8_000_000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const cleanup = () => {
        try { source.disconnect(streamDest); } catch { /* already disconnected */ }
        videoStream.getTracks().forEach((t) => t.stop());
        streamDest.stream.getTracks().forEach((t) => t.stop());
      };

      const startTs = performance.now();
      let progressTimer: ReturnType<typeof setInterval> | null = null;
      let aborted = false;

      const stopPromise = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      // Seek to 0, set playback state so the draw loop reads live analyser data.
      audio.pause();
      audio.currentTime = 0;
      await ctx.resume();
      useEditorStore.setState({ isPlaying: true });
      try {
        await audio.play();
      } catch (err) {
        cleanup();
        useEditorStore.setState({ isPlaying: false });
        throw err;
      }

      recorder.start(500);
      opts.onProgress?.({ stage: "recording", elapsed: 0, total: audio.duration || 0 });

      progressTimer = setInterval(() => {
        opts.onProgress?.({
          stage: "recording",
          elapsed: audio.currentTime,
          total: audio.duration || audio.currentTime,
        });
      }, 250);

      const onAbort = () => {
        aborted = true;
        if (recorder.state === "recording") recorder.stop();
      };
      opts.signal?.addEventListener("abort", onAbort);

      // Wait for audio to finish
      await new Promise<void>((resolve) => {
        const onEnded = () => { audio.removeEventListener("ended", onEnded); resolve(); };
        audio.addEventListener("ended", onEnded);
        // If aborted, resolve immediately
        opts.signal?.addEventListener("abort", () => {
          audio.removeEventListener("ended", onEnded);
          resolve();
        });
      });

      if (progressTimer) clearInterval(progressTimer);
      opts.onProgress?.({ stage: "finalizing", elapsed: audio.currentTime, total: audio.duration || 0 });

      if (recorder.state === "recording") recorder.stop();
      await stopPromise;

      useEditorStore.setState({ isPlaying: false, currentTime: 0 });
      cleanup();

      if (aborted) throw new Error("Export cancelled");

      return {
        blob: new Blob(chunks, { type: mimeType }),
        mimeType,
        durationMs: performance.now() - startTs,
      };
    };

    registerStartExport(startFn);
    return () => registerStartExport(null);
  }, [ensureAudioPipeline]);

  // Seek handling
  const seekTo = useEditorStore((s) => s.seekTo);
  useEffect(() => {
    if (seekTo === null) return;
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = seekTo;
    }
    useEditorStore.setState({ seekTo: null });
  }, [seekTo]);

  // Time tracking
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => {
      useEditorStore.setState({ currentTime: audio.currentTime });
    };
    const onEnded = () => {
      useEditorStore.setState({ isPlaying: false, currentTime: 0 });
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  // Mount-once render loop — reads config/preset/isPlaying from refs so the
  // RAF chain is never interrupted by state changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (container) {
      const aspect = 16 / 9;
      const maxW = container.clientWidth - 32;
      const maxH = container.clientHeight - 32;
      let w = maxW;
      let h = w / aspect;
      if (h > maxH) {
        h = maxH;
        w = h * aspect;
      }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = 1920;
      canvas.height = 1080;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    lastFrameRef.current = 0;

    const draw = (timestamp: number) => {
      // Schedule next frame first — guarantees the loop never dies from an
      // exception in the body.
      animFrameRef.current = requestAnimationFrame(draw);

      const config = configRef.current;
      const presetId = presetIdRef.current;
      const isPlaying = isPlayingRef.current;

      // Delta time
      if (!lastFrameRef.current) lastFrameRef.current = timestamp;
      const dt = Math.min((timestamp - lastFrameRef.current) / 1000, 0.1);
      lastFrameRef.current = timestamp;
      timeRef.current += dt;
      const t = timeRef.current;

      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;

      // Get frequency data
      let freq: number[];
      if (analyserRef.current && isPlaying) {
        const raw = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(raw);
        freq = Array.from(raw).map((v) => v / 255);
      } else if (presetId === "trap-nation") {
        freq = new Array(128).fill(0);
      } else {
        freq = generateProceduralFreq(t);
      }

      // Beat detection — uses separate analyser with standard dB range
      let beatFreq: number[];
      if (beatAnalyserRef.current && isPlaying) {
        const beatRaw = new Uint8Array(beatAnalyserRef.current.frequencyBinCount);
        beatAnalyserRef.current.getByteFrequencyData(beatRaw);
        beatFreq = Array.from(beatRaw).map((v) => v / 255);
      } else {
        beatFreq = freq;
      }
      const beat = detectBeat(beatFreq, beatRef.current, dt, config);
      const bs = beatRef.current;

      // Background: solid color base
      ctx.fillStyle = config.backgroundColor;
      ctx.fillRect(0, 0, W, H);

      // Background image or video (blurred + darkened)
      const hasBg =
        (config.backgroundType === "video" && bgVideoRef.current && bgVideoRef.current.readyState >= 2) ||
        bgImgRef.current;

      if (hasBg) {
        ctx.save();

        // Max translation magnitude this frame — used to pad the image so
        // drift/rumble never reveals the canvas behind it.
        let driftPadX = 0;
        let driftPadY = 0;

        if (config.backgroundDrift) {
          const driftX = Math.sin(t * 0.15) * W * 0.03;
          const driftY = Math.cos(t * 0.11) * H * 0.02;
          ctx.translate(driftX, driftY);
          driftPadX = Math.max(driftPadX, W * 0.03);
          driftPadY = Math.max(driftPadY, H * 0.02);
        }

        if (config.backgroundRumble) {
          const bassAvg = freq.slice(0, 10).reduce((s, v) => s + v, 0) / 10;
          const rumbleAmt = bassAvg * 6;
          ctx.translate(
            (Math.random() - 0.5) * rumbleAmt,
            (Math.random() - 0.5) * rumbleAmt,
          );
          driftPadX += rumbleAmt / 2;
          driftPadY += rumbleAmt / 2;
        }

        const bgSource =
          config.backgroundType === "video" && bgVideoRef.current && bgVideoRef.current.readyState >= 2
            ? bgVideoRef.current
            : bgImgRef.current!;

        if (config.backgroundFilter) {
          const avg = freq.reduce((s, v) => s + v, 0) / freq.length;
          const hue = Math.round(t * 20 + avg * 60) % 360;
          ctx.filter = `saturate(1.4) hue-rotate(${hue}deg)`;
        }

        drawBackgroundSource(ctx, W, H, bgSource, config, driftPadX, driftPadY);

        if (config.backgroundFilter) {
          ctx.filter = "none";
        }

        ctx.restore();
      }

      // Apply camera shake + zoom
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(bs.zoom, bs.zoom);
      ctx.translate(-cx + bs.shakeX, -cy + bs.shakeY);

      const rendererConfig: RendererConfig = {
        waveColor1: config.waveColor1,
        waveColor2: config.waveColor2,
        accentColor: config.accentColor,
        backgroundColor: config.backgroundColor,
        reactivity: config.reactivity,
        waveformScale: config.waveformScale,
        spectrumFill: config.spectrumFill,
        particles: config.particles,
        particleDensity: config.particleDensity,
        particleColor: config.particleColor,
        linearPosition: config.linearPosition,
        linearRepeat: config.linearRepeat,
        linearBarColor: config.linearBarColor,
        linearYOffset: config.linearYOffset,
        linearWidth: config.linearWidth,
        linearCenterText:
          config.linearCenterTextSource === "artist"
            ? config.artistName
            : config.linearCenterTextSource === "track"
            ? config.trackName
            : config.linearCenterTextSource === "custom"
            ? config.linearCenterText
            : "",
        linearCenterTextSize: config.linearCenterTextSize,
      };

      renderPreset(presetId, { ctx, W, H, cx, cy, freq, config: rendererConfig, t });

      if (config.particles && !["particle-storm", "glitter-storm"].includes(presetId || "")) {
        drawParticlesOverlay(ctx, W, H, cx, cy, freq, config, t);
      }

      if (config.logoEnabled) {
        drawCenterLogo(ctx, cx, cy, W, H, config, logoImgRef.current, beat.bass, bs.energy);
      }
      drawText(ctx, W, H, config);

      ctx.restore(); // end camera shake/zoom

      if (config.reflection !== "none") {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(canvas, 0, 0);
        if (config.reflection === "4-way") {
          ctx.translate(0, H);
          ctx.scale(1, -1);
          ctx.drawImage(canvas, 0, 0);
          ctx.setTransform(1, 0, 0, -1, 0, H);
          ctx.drawImage(canvas, 0, 0);
        }
        ctx.restore();
      }

      if (config.overlayEnabled && overlayImgRef.current) {
        drawCornerOverlay(ctx, W, H, overlayImgRef.current, config);
      }

      // Custom draggable text overlays (drawn on top of everything)
      for (const txt of config.customTexts) {
        drawCustomText(ctx, W, H, txt);
      }
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  // Drag state for custom text overlays
  const dragRef = useRef<{
    index: number;
    offsetX: number; // canvas-space offset from text anchor to cursor
    offsetY: number;
  } | null>(null);

  // Convert client (mouse) coords to canvas internal coords (1920×1080)
  const clientToCanvas = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    const texts = configRef.current.customTexts;
    // Hit-test top-most first (reverse order since later items draw on top)
    for (let i = texts.length - 1; i >= 0; i--) {
      if (hitTestCustomText(ctx, canvas.width, canvas.height, texts[i], x, y)) {
        dragRef.current = {
          index: i,
          offsetX: x - texts[i].x * canvas.width,
          offsetY: y - texts[i].y * canvas.height,
        };
        break;
      }
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    const newX = Math.max(0, Math.min(1, (x - drag.offsetX) / canvas.width));
    const newY = Math.max(0, Math.min(1, (y - drag.offsetY) / canvas.height));
    const { config: currentConfig, updateConfig } = useEditorStore.getState();
    const texts = currentConfig.customTexts.map((t, idx) =>
      idx === drag.index ? { ...t, x: newX, y: newY } : t,
    );
    updateConfig({ customTexts: texts });
  };

  const onMouseUp = () => {
    dragRef.current = null;
  };

  // Cursor feedback: pointer over text, grabbing while dragging
  const onMouseMoveHover = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (dragRef.current) {
      onMouseMove(e);
      canvas.style.cursor = "grabbing";
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    const texts = configRef.current.customTexts;
    let over = false;
    for (let i = texts.length - 1; i >= 0; i--) {
      if (hitTestCustomText(ctx, canvas.width, canvas.height, texts[i], x, y)) {
        over = true;
        break;
      }
    }
    canvas.style.cursor = over ? "grab" : "default";
  };

  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg shadow-2xl shadow-primary/10"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMoveHover}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    />
  );
}

// ─── Background image/video (blurred + darkened) ───────────────────

function drawBackgroundSource(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  source: HTMLImageElement | HTMLVideoElement,
  config: { backgroundBlur: number; backgroundDarken: number },
  extraPadX: number = 0,
  extraPadY: number = 0,
) {
  ctx.save();

  // Cover-fit the source. We shrink the sampled source rect slightly so the
  // visible portion zooms in — that way the image still cover-fits after we
  // draw it oversized to cover drift / blur padding.
  const srcW = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const srcH = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (srcW === 0 || srcH === 0) { ctx.restore(); return; }
  const imgAspect = srcW / srcH;
  const canvasAspect = W / H;
  let sx = 0, sy = 0, sw = srcW, sh = srcH;
  if (imgAspect > canvasAspect) {
    sw = srcH * canvasAspect;
    sx = (srcW - sw) / 2;
  } else {
    sh = srcW / canvasAspect;
    sy = (srcH - sh) / 2;
  }

  // Scale blur to canvas size (blur value is authored for 960px, scale for actual)
  const blurScale = W / 960;
  const blurPx = config.backgroundBlur * blurScale;

  // Apply blur via canvas filter
  if (blurPx > 0) {
    ctx.filter = `blur(${Math.round(blurPx)}px)`;
  }

  // Draw oversized to hide blur-edge artifacts AND drift translation.
  // padX/padY must cover: blur feathering + drift displacement.
  const blurPad = blurPx > 0 ? blurPx * 2.5 : 0;
  const padX = Math.max(blurPad, extraPadX);
  const padY = Math.max(blurPad, extraPadY);
  ctx.drawImage(source, sx, sy, sw, sh, -padX, -padY, W + padX * 2, H + padY * 2);
  ctx.filter = "none";

  // Darken overlay
  const darken = config.backgroundDarken;
  ctx.globalAlpha = darken;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ─── Center logo (Trap Nation style) ─────────────────────────────────

function drawCenterLogo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  W: number,
  H: number,
  config: { logoScale: number; logoBorderRadius: number; waveColor1: string; waveColor2: string },
  logoImg: HTMLImageElement | null,
  bass: number,
  beatEnergy: number
) {
  const baseSize = Math.min(W, H) * 0.28 * config.logoScale;
  // Subtle beat pulse on the logo itself
  const pulse = 1 + beatEnergy * 0.04;
  const size = baseSize * pulse;
  const radius = (config.logoBorderRadius / 100) * (size / 2);
  const x = cx - size / 2;
  const y = cy - size / 2;

  ctx.save();

  // Glow behind logo
  const glowSize = size * 1.3;
  const glow = ctx.createRadialGradient(cx, cy, size * 0.3, cx, cy, glowSize);
  glow.addColorStop(0, hexToRgba(config.waveColor2, 0.15 + beatEnergy * 0.15));
  glow.addColorStop(0.5, hexToRgba(config.waveColor1, 0.05));
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, glowSize, 0, Math.PI * 2);
  ctx.fill();

  if (logoImg) {
    // Draw rounded image
    ctx.beginPath();
    roundedRect(ctx, x, y, size, size, radius);
    ctx.closePath();
    ctx.clip();

    // Draw image cover-fit
    const imgAspect = logoImg.width / logoImg.height;
    let sx = 0, sy = 0, sw = logoImg.width, sh = logoImg.height;
    if (imgAspect > 1) {
      sw = logoImg.height;
      sx = (logoImg.width - sw) / 2;
    } else {
      sh = logoImg.width;
      sy = (logoImg.height - sh) / 2;
    }
    ctx.drawImage(logoImg, sx, sy, sw, sh, x, y, size, size);

    ctx.restore();
    ctx.save();
  } else {
    // Placeholder: dark circle with subtle icon
    ctx.beginPath();
    roundedRect(ctx, x, y, size, size, radius);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(config.waveColor1, 0.06);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(config.waveColor1, 0.15);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Mini waveform icon inside
    ctx.strokeStyle = hexToRgba(config.waveColor1, 0.35);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const iconBars = [0.3, 0.6, 1.0, 0.6, 0.3];
    const barW = size * 0.06;
    const totalBarW = iconBars.length * barW + (iconBars.length - 1) * barW * 0.8;
    let bx = cx - totalBarW / 2;
    for (const bh of iconBars) {
      const h = size * 0.25 * bh;
      ctx.beginPath();
      ctx.moveTo(bx + barW / 2, cy - h / 2);
      ctx.lineTo(bx + barW / 2, cy + h / 2);
      ctx.stroke();
      bx += barW * 1.8;
    }
  }

  ctx.restore();
}

// ─── Particles overlay ──────────────────────────────────────────────

function drawParticlesOverlay(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  cx: number,
  cy: number,
  freq: number[],
  config: { particleStyle: string; particleDensity: number; particleColor: string },
  t: number
) {
  const style = config.particleStyle || "floating";
  switch (style) {
    case "snow": return drawSnowParticles(ctx, W, H, config, t);
    case "fireflies": return drawFireflyParticles(ctx, W, H, cx, cy, freq, config, t);
    case "rain": return drawRainParticles(ctx, W, H, config, t);
    case "stars": return drawStarParticles(ctx, W, H, freq, config, t);
    case "smoke": return drawSmokeParticles(ctx, W, H, cx, cy, freq, config, t);
    default: return drawFloatingParticles(ctx, W, H, cx, cy, freq, config, t);
  }
}

function drawFloatingParticles(
  ctx: CanvasRenderingContext2D, W: number, H: number, cx: number, cy: number,
  freq: number[], config: { particleDensity: number; particleColor: string }, t: number
) {
  const count = Math.floor(config.particleDensity * 0.4);
  const avg = freq.reduce((s, v) => s + v, 0) / freq.length;
  const c = hexToRgb(config.particleColor);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const seed = i * 137.508;
    const px = cx + Math.sin(seed + t * 0.3) * W * 0.45;
    const py = cy + Math.cos(seed * 0.7 + t * 0.2) * H * 0.45;
    const alpha = (Math.sin(t + seed) * 0.5 + 0.5) * 0.25 * (0.5 + avg);
    const size = 1 + Math.sin(seed) * 0.5;
    ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSnowParticles(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  config: { particleDensity: number; particleColor: string }, t: number
) {
  const count = Math.floor(config.particleDensity * 0.6);
  const c = hexToRgb(config.particleColor);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const seed = i * 97.31;
    const speed = 0.3 + (seed % 1) * 0.4;
    const px = ((seed * 73.17) % W + Math.sin(t * 0.5 + seed) * 30) % W;
    const py = ((t * speed * 40 + seed * 53.71) % (H + 20)) - 10;
    const size = 1.5 + (seed % 3) * 0.5;
    const alpha = 0.3 + Math.sin(seed + t * 0.3) * 0.15;
    ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFireflyParticles(
  ctx: CanvasRenderingContext2D, W: number, H: number, cx: number, cy: number,
  freq: number[], config: { particleDensity: number; particleColor: string }, t: number
) {
  const count = Math.floor(config.particleDensity * 0.3);
  const avg = freq.reduce((s, v) => s + v, 0) / freq.length;
  const c = hexToRgb(config.particleColor);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const seed = i * 211.13;
    const orbit = 0.15 + (seed % 1) * 0.35;
    const px = cx + Math.sin(seed * 0.3 + t * (0.2 + (seed % 0.3))) * W * orbit;
    const py = cy + Math.cos(seed * 0.7 + t * (0.15 + (seed % 0.2))) * H * orbit;
    // Slow pulsing glow
    const pulse = Math.sin(t * 2 + seed) * 0.5 + 0.5;
    const alpha = pulse * 0.5 * (0.5 + avg);
    const size = 2 + pulse * 2;
    // Glow effect
    const grad = ctx.createRadialGradient(px, py, 0, px, py, size * 3);
    grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${alpha})`);
    grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, size * 3, 0, Math.PI * 2);
    ctx.fill();
    // Bright core
    ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${alpha * 1.5})`;
    ctx.beginPath();
    ctx.arc(px, py, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRainParticles(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  config: { particleDensity: number; particleColor: string }, t: number
) {
  const count = Math.floor(config.particleDensity * 0.8);
  const c = hexToRgb(config.particleColor);
  ctx.save();
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    const seed = i * 61.73;
    const speed = 1.5 + (seed % 1) * 2;
    const px = (seed * 37.19) % W;
    const py = ((t * speed * 120 + seed * 47.91) % (H + 40)) - 20;
    const len = 8 + (seed % 10);
    const alpha = 0.15 + (seed % 0.15);
    ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - 1, py + len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStarParticles(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  freq: number[], config: { particleDensity: number; particleColor: string }, t: number
) {
  const count = Math.floor(config.particleDensity * 0.5);
  const avg = freq.reduce((s, v) => s + v, 0) / freq.length;
  const c = hexToRgb(config.particleColor);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const seed = i * 173.29;
    // Fixed positions that twinkle
    const px = (seed * 83.41) % W;
    const py = (seed * 47.63) % H;
    const twinkle = Math.sin(t * (2 + seed % 3) + seed) * 0.5 + 0.5;
    const alpha = twinkle * 0.4 * (0.6 + avg * 0.8);
    const size = 0.8 + twinkle * 1.2;
    ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
    // Cross flare on bright ones
    if (twinkle > 0.7) {
      ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${alpha * 0.4})`;
      ctx.lineWidth = 0.5;
      const fl = size * 4;
      ctx.beginPath();
      ctx.moveTo(px - fl, py); ctx.lineTo(px + fl, py);
      ctx.moveTo(px, py - fl); ctx.lineTo(px, py + fl);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawSmokeParticles(
  ctx: CanvasRenderingContext2D, W: number, H: number, cx: number, cy: number,
  freq: number[], config: { particleDensity: number; particleColor: string }, t: number
) {
  const count = Math.floor(config.particleDensity * 0.2);
  const avg = freq.reduce((s, v) => s + v, 0) / freq.length;
  const c = hexToRgb(config.particleColor);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const seed = i * 251.07;
    const life = ((t * 0.3 + seed * 0.01) % 1); // 0→1 cycle
    const px = cx + Math.sin(seed) * W * 0.3 + Math.sin(t * 0.2 + seed) * 40;
    const py = cy + (1 - life) * H * 0.5 - H * 0.1; // rise upward
    const size = 15 + life * 30 + avg * 20;
    const alpha = (1 - life) * 0.06 * (0.5 + avg);
    const grad = ctx.createRadialGradient(px, py, 0, px, py, size);
    grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${alpha})`);
    grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function hexToRgb(hex: string) {
  const c = hex.replace("#", "");
  return {
    r: parseInt(c.substring(0, 2), 16) || 255,
    g: parseInt(c.substring(2, 4), 16) || 255,
    b: parseInt(c.substring(4, 6), 16) || 255,
  };
}

// ─── Text overlay ───────────────────────────────────────────────────

function drawText(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  config: {
    artistName: string;
    trackName: string;
    textColor: string;
    fontSize: number;
    textPosition: string;
    linearCenterTextSource: "none" | "custom" | "artist" | "track";
  }
) {
  // Suppress either line if the linear visualizer is already promoting it
  // into the center slot (avoids the two texts overlapping).
  const skipArtist = config.linearCenterTextSource === "artist";
  const skipTrack = config.linearCenterTextSource === "track";

  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = config.textColor;

  let baseY: number;
  switch (config.textPosition) {
    case "top":
      baseY = 60;
      break;
    case "center":
      baseY = H / 2 + H * 0.25;
      break;
    default:
      baseY = H - 80;
  }

  // Artist name
  if (!skipArtist) {
    ctx.font = `bold ${config.fontSize}px sans-serif`;
    ctx.globalAlpha = 0.95;
    ctx.fillText(config.artistName, W / 2, baseY);
  }

  // Track name
  if (!skipTrack) {
    ctx.font = `${config.fontSize * 0.65}px sans-serif`;
    ctx.globalAlpha = 0.6;
    const trackY = skipArtist ? baseY : baseY + config.fontSize * 0.85;
    ctx.fillText(config.trackName, W / 2, trackY);
  }

  ctx.restore();
}

// ─── Custom text overlays (draggable) ───────────────────────────────

function customTextFont(size: number, weight: CustomText["weight"], W: number) {
  const px = size * (W / 1920);
  const w = weight === "black" ? 900 : weight === "bold" ? 700 : 400;
  return `${w} ${px}px sans-serif`;
}

function drawCustomText(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  txt: CustomText,
) {
  if (!txt.text.trim()) return;
  ctx.save();
  ctx.font = customTextFont(txt.size, txt.weight, W);
  ctx.fillStyle = txt.color;
  ctx.textAlign = txt.align;
  ctx.textBaseline = "middle";
  ctx.fillText(txt.text, txt.x * W, txt.y * H);
  ctx.restore();
}

// Hit-test: is the given canvas-space point over the text's bounding box?
function hitTestCustomText(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  txt: CustomText,
  px: number,
  py: number,
): boolean {
  if (!txt.text.trim()) return false;
  ctx.save();
  ctx.font = customTextFont(txt.size, txt.weight, W);
  const metrics = ctx.measureText(txt.text);
  const textW = metrics.width;
  const renderedPx = txt.size * (W / 1920);
  const textH = renderedPx * 1.2;
  ctx.restore();

  const anchorX = txt.x * W;
  const anchorY = txt.y * H;
  let x0 = anchorX;
  if (txt.align === "center") x0 = anchorX - textW / 2;
  else if (txt.align === "right") x0 = anchorX - textW;
  const y0 = anchorY - textH / 2;
  return px >= x0 && px <= x0 + textW && py >= y0 && py <= y0 + textH;
}

// ─── Corner overlay ─────────────────────────────────────────────────

function drawCornerOverlay(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  img: HTMLImageElement,
  config: { overlayPosition: string; overlayScale: number; overlayOpacity: number; overlayOffsetX: number; overlayOffsetY: number }
) {
  ctx.save();

  const maxSize = Math.min(W, H) * 0.12 * config.overlayScale;
  const aspect = img.width / img.height;
  let drawW: number, drawH: number;
  if (aspect >= 1) {
    drawW = maxSize;
    drawH = maxSize / aspect;
  } else {
    drawH = maxSize;
    drawW = maxSize * aspect;
  }

  const margin = W * 0.03;
  let x: number, y: number;
  switch (config.overlayPosition) {
    case "top-left":
      x = margin;
      y = margin;
      break;
    case "top-right":
      x = W - drawW - margin;
      y = margin;
      break;
    case "bottom-left":
      x = margin;
      y = H - drawH - margin;
      break;
    default: // bottom-right
      x = W - drawW - margin;
      y = H - drawH - margin;
  }

  // Apply user offset (percentage of canvas dimensions)
  x += (config.overlayOffsetX / 100) * W;
  y += (config.overlayOffsetY / 100) * H;

  ctx.globalAlpha = config.overlayOpacity;
  ctx.drawImage(img, x, y, drawW, drawH);
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ─── Helpers ────────────────────────────────────────────────────────

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
}

function hexToRgba(hex: string, a: number) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) || 128;
  const g = parseInt(c.substring(2, 4), 16) || 128;
  const b = parseInt(c.substring(4, 6), 16) || 128;
  return `rgba(${r},${g},${b},${a})`;
}
