"use client";

import { useRef, useEffect } from "react";

/** Animated radial waveform that plays on the landing hero — no audio, just a looping procedural animation. */
export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    let t = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      const W = canvas!.getBoundingClientRect().width;
      const H = canvas!.getBoundingClientRect().height;
      const cx = W / 2;
      const cy = H / 2;
      t += 0.015;

      ctx.clearRect(0, 0, W, H);

      // Subtle dark gradient background
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
      bg.addColorStop(0, "rgba(30, 10, 50, 0.4)");
      bg.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const baseRadius = Math.min(W, H) * 0.22;
      const numBars = 180;

      // Draw 3 layers — outer to inner (painter's order)
      const layers = [
        { radius: baseRadius * 1.15, maxH: 90, color1: "rgba(168,85,247,0.08)", color2: "rgba(236,72,153,0.08)", width: 3, exp: 1.5, phase: 0.3 },
        { radius: baseRadius * 1.0,  maxH: 70, color1: "rgba(168,85,247,0.2)",  color2: "rgba(236,72,153,0.2)",  width: 2.5, exp: 1.2, phase: 0.1 },
        { radius: baseRadius * 0.9,  maxH: 55, color1: "rgba(255,255,255,0.5)", color2: "rgba(168,85,247,0.5)",  width: 2, exp: 1.0, phase: 0 },
      ];

      ctx.save();
      ctx.translate(cx, cy);

      for (const layer of layers) {
        for (let i = 0; i < numBars; i++) {
          const norm = i / numBars;
          // Procedural "spectrum" — layered sine waves
          const freq1 = Math.sin(norm * Math.PI * 8 + t * 2.5 + layer.phase) * 0.5 + 0.5;
          const freq2 = Math.sin(norm * Math.PI * 3.7 + t * 1.8 + layer.phase * 5) * 0.3 + 0.3;
          const freq3 = Math.sin(norm * Math.PI * 12 + t * 4.2) * 0.2 + 0.2;
          const beat = Math.pow(Math.sin(t * 3.5) * 0.5 + 0.5, 3) * 0.35;
          const amplitude = Math.pow(Math.max(0, freq1 + freq2 + freq3 + beat) / 2, layer.exp);

          const angle = norm * Math.PI * 2 - Math.PI / 2;
          const barH = amplitude * layer.maxH;
          const r0 = layer.radius;
          const r1 = r0 + barH;

          const x0 = Math.cos(angle) * r0;
          const y0 = Math.sin(angle) * r0;
          const x1 = Math.cos(angle) * r1;
          const y1 = Math.sin(angle) * r1;

          ctx.strokeStyle = norm < 0.5 ? layer.color1 : layer.color2;
          ctx.lineWidth = layer.width;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }

        // Inner circle for this layer
        ctx.strokeStyle = layer.color1;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(0, 0, layer.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Center glow
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius * 0.85);
      glow.addColorStop(0, "rgba(168,85,247,0.12)");
      glow.addColorStop(0.7, "rgba(168,85,247,0.03)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 0.85, 0, Math.PI * 2);
      ctx.fill();

      // Center circle outline
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 0.55, 0, Math.PI * 2);
      ctx.stroke();

      // Center icon placeholder — simple waveform icon
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      const iconR = baseRadius * 0.2;
      const bars = [0.4, 0.7, 1.0, 0.7, 0.4];
      const barW = iconR * 0.3;
      const totalW = bars.length * barW + (bars.length - 1) * barW * 0.5;
      let bx = -totalW / 2;
      for (const bh of bars) {
        const h = iconR * bh;
        ctx.beginPath();
        ctx.moveTo(bx + barW / 2, -h / 2);
        ctx.lineTo(bx + barW / 2, h / 2);
        ctx.stroke();
        bx += barW * 1.5;
      }

      ctx.restore();

      // Floating particles
      for (let i = 0; i < 30; i++) {
        const seed = i * 137.508;
        const px = cx + Math.sin(seed + t * 0.3) * W * 0.45;
        const py = cy + Math.cos(seed * 0.7 + t * 0.2) * H * 0.45;
        const alpha = (Math.sin(t + seed) * 0.5 + 0.5) * 0.25;
        const size = 1 + Math.sin(seed) * 0.5;
        ctx.fillStyle = `rgba(168,85,247,${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ pointerEvents: "none" }}
    />
  );
}
