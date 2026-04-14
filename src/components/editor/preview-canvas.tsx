"use client";

import { useRef, useEffect, useCallback } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { renderPreset, generateProceduralFreq } from "./preset-renderers";
import type { RendererConfig } from "./preset-renderers";

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
  const bassSlice = freq.slice(0, 15);
  const bass = bassSlice.reduce((s, v) => s + v, 0) / bassSlice.length;

  // Detect beat: sudden bass spike
  const threshold = 0.15;
  const isBeat = bass - state.prevBass > threshold && bass > 0.4;
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

  // Play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      if (!audioContextRef.current) {
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = config.waveformSmoothing;
        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;
      }
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, config.waveformSmoothing]);

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

  // Render loop
  const draw = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

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
      } else {
        freq = generateProceduralFreq(t);
      }

      // Beat detection
      const beat = detectBeat(freq, beatRef.current, dt, config);
      const bs = beatRef.current;

      // ─── Draw ────────────────────────────────────────────────

      // Background: solid color base
      ctx.fillStyle = config.backgroundColor;
      ctx.fillRect(0, 0, W, H);

      // Background image or video (blurred + darkened)
      if (config.backgroundType === "video" && bgVideoRef.current && bgVideoRef.current.readyState >= 2) {
        drawBackgroundSource(ctx, W, H, bgVideoRef.current, config);
      } else if (bgImgRef.current) {
        drawBackgroundSource(ctx, W, H, bgImgRef.current, config);
      }

      // Apply camera shake + zoom
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(bs.zoom, bs.zoom);
      ctx.translate(-cx + bs.shakeX, -cy + bs.shakeY);

      // Render preset visualizer
      const rendererConfig: RendererConfig = {
        waveColor1: config.waveColor1,
        waveColor2: config.waveColor2,
        accentColor: config.accentColor,
        backgroundColor: config.backgroundColor,
        reactivity: config.reactivity,
        waveformScale: config.waveformScale,
        particles: config.particles,
        particleDensity: config.particleDensity,
        particleColor: config.particleColor,
      };

      renderPreset(presetId, { ctx, W, H, cx, cy, freq, config: rendererConfig, t });

      // Particles overlay (skip for particle-based presets)
      if (config.particles && !["particle-storm", "glitter-storm"].includes(presetId || "")) {
        drawParticlesOverlay(ctx, W, H, cx, cy, freq, config, t);
      }

      // ─── Center logo / image (Trap Nation style) ─────────────
      drawCenterLogo(ctx, cx, cy, W, H, config, logoImgRef.current, beat.bass, bs.energy);

      // Text overlay
      drawText(ctx, W, H, config);

      ctx.restore(); // end camera shake/zoom

      // Corner overlay (drawn on top of everything, outside camera shake)
      if (config.overlayEnabled && overlayImgRef.current) {
        drawCornerOverlay(ctx, W, H, overlayImgRef.current, config);
      }

      animFrameRef.current = requestAnimationFrame(draw);
    },
    [config, presetId, isPlaying]
  );

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

    lastFrameRef.current = 0;
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg shadow-2xl shadow-primary/10"
    />
  );
}

// ─── Background image/video (blurred + darkened) ───────────────────

function drawBackgroundSource(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  source: HTMLImageElement | HTMLVideoElement,
  config: { backgroundBlur: number; backgroundDarken: number }
) {
  ctx.save();

  // Cover-fit the source
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

  // Draw oversized to hide blur edge artifacts
  const pad = blurPx > 0 ? blurPx * 2.5 : 0;
  ctx.drawImage(source, sx, sy, sw, sh, -pad, -pad, W + pad * 2, H + pad * 2);
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
  config: { particleDensity: number; particleColor: string },
  t: number
) {
  const count = Math.floor(config.particleDensity * 0.4);
  const avg = freq.reduce((s, v) => s + v, 0) / freq.length;

  ctx.save();
  for (let i = 0; i < count; i++) {
    const seed = i * 137.508;
    const px = cx + Math.sin(seed + t * 0.3) * W * 0.45;
    const py = cy + Math.cos(seed * 0.7 + t * 0.2) * H * 0.45;
    const alpha = (Math.sin(t + seed) * 0.5 + 0.5) * 0.2 * (0.5 + avg);
    const size = 1 + Math.sin(seed) * 0.5;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── Text overlay ───────────────────────────────────────────────────

function drawText(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  config: { artistName: string; trackName: string; textColor: string; fontSize: number; textPosition: string }
) {
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
  ctx.font = `bold ${config.fontSize}px sans-serif`;
  ctx.globalAlpha = 0.95;
  ctx.fillText(config.artistName, W / 2, baseY);

  // Track name
  ctx.font = `${config.fontSize * 0.65}px sans-serif`;
  ctx.globalAlpha = 0.6;
  ctx.fillText(config.trackName, W / 2, baseY + config.fontSize * 0.85);

  ctx.restore();
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
