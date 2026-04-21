"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectConfig } from "@/lib/types";
import { DEFAULT_PROJECT_CONFIG } from "@/lib/types";
import { renderFrame, createBeatState } from "@/components/editor/frame-renderer";

declare global {
  interface Window {
    __renderReady: boolean;
    __renderFrame: (frameIdx: number) => void;
    __setSpectrum: (flat: Uint8Array | ArrayLike<number>, binsPerFrame: number) => void;
    __setFps: (fps: number) => void;
    __getFrameCount: () => number;
    __renderError: string | null;
  }
}

interface Props {
  projectId: string;
  presetId: string | null;
  configJson: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
  overlayUrl: string | null;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Render-only canvas. The Puppeteer worker:
 *  1. waits for window.__renderReady === true
 *  2. calls window.__setSpectrum(flatBytes, binsPerFrame) with pre-computed spectra
 *  3. calls window.__setFps(fps)
 *  4. calls window.__renderFrame(i) for each frame
 *  5. screenshots the canvas between calls
 */
export function RenderClient(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<string>("Loading…");

  useEffect(() => {
    window.__renderReady = false;
    window.__renderError = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      window.__renderError = "2D context unavailable";
      return;
    }

    let cancelled = false;
    const config: ProjectConfig = {
      ...DEFAULT_PROJECT_CONFIG,
      ...(JSON.parse(props.configJson) as Partial<ProjectConfig>),
    };

    // Mutable state
    const beatState = createBeatState();
    let spectrumFlat: Uint8Array | null = null;
    let binsPerFrame = 1024; // default for fftSize=2048
    let fps = 30;
    let frameCount = 0;
    let logoImg: HTMLImageElement | null = null;
    let bgImg: HTMLImageElement | null = null;
    let overlayImg: HTMLImageElement | null = null;

    // Preload all images in parallel; missing ones are allowed.
    (async () => {
      const loads: Array<Promise<void>> = [];
      if (props.logoUrl) {
        loads.push(loadImage(props.logoUrl).then((i) => { logoImg = i; }).catch(() => { /* noop */ }));
      }
      if (props.backgroundUrl) {
        loads.push(loadImage(props.backgroundUrl).then((i) => { bgImg = i; }).catch(() => { /* noop */ }));
      } else if (props.logoUrl) {
        // Fall back to logo as background, matches preview behaviour
        loads.push(loadImage(props.logoUrl).then((i) => { bgImg = bgImg ?? i; }).catch(() => { /* noop */ }));
      }
      if (props.overlayUrl) {
        loads.push(loadImage(props.overlayUrl).then((i) => { overlayImg = i; }).catch(() => { /* noop */ }));
      }
      await Promise.all(loads);
      if (cancelled) return;

      window.__setSpectrum = (flat, bins) => {
        spectrumFlat = flat instanceof Uint8Array ? flat : Uint8Array.from(flat as ArrayLike<number>);
        binsPerFrame = bins;
        frameCount = Math.floor(spectrumFlat.length / binsPerFrame);
      };
      window.__setFps = (f) => { fps = f; };
      window.__getFrameCount = () => frameCount;

      window.__renderFrame = (frameIdx: number) => {
        if (!spectrumFlat) return;
        const t = frameIdx / fps;
        const dt = 1 / fps;

        // Slice the flat buffer into this frame's freq array, normalise to 0..1
        const start = frameIdx * binsPerFrame;
        const end = start + binsPerFrame;
        const bytes = spectrumFlat.subarray(start, end);
        const freq: number[] = new Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) freq[i] = bytes[i] / 255;

        renderFrame({
          ctx,
          canvas,
          W: canvas.width,
          H: canvas.height,
          t,
          dt,
          freq,
          beatFreq: freq,
          beatState,
          config,
          presetId: props.presetId,
          logoImg,
          bgImg,
          bgVideo: null, // offline render doesn't support video backgrounds yet
          overlayImg,
        });
      };

      setStatus("Ready");
      window.__renderReady = true;
    })().catch((err) => {
      window.__renderError = err instanceof Error ? err.message : String(err);
      setStatus(`Error: ${window.__renderError}`);
    });

    return () => { cancelled = true; };
  }, [props]);

  return (
    <div style={{ margin: 0, padding: 0, background: "#000" }}>
      <div
        id="render-status"
        style={{
          position: "fixed",
          top: 8,
          left: 8,
          color: "#fff",
          fontFamily: "monospace",
          fontSize: 12,
          zIndex: 10,
          background: "rgba(0,0,0,0.6)",
          padding: "4px 8px",
          borderRadius: 4,
        }}
      >
        {status}
      </div>
      <canvas
        ref={canvasRef}
        id="render-canvas"
        style={{ display: "block", width: "1920px", height: "1080px" }}
      />
    </div>
  );
}
