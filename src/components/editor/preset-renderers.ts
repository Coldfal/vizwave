/**
 * Draw functions for each visualizer preset.
 *
 * Every renderer has the same signature so the preview canvas can dispatch
 * by preset ID. When there is no live audio the canvas passes in
 * procedurally-generated frequency data so the preset still animates.
 */

export interface RendererArgs {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  cx: number;
  cy: number;
  freq: number[];      // 0-1 normalised frequency bars (length varies)
  config: RendererConfig;
  t: number;           // elapsed time in seconds (for procedural motion)
}

export interface RendererConfig {
  waveColor1: string;
  waveColor2: string;
  accentColor: string;
  backgroundColor: string;
  reactivity: number;
  waveformScale: number;
  particles: boolean;
  particleDensity: number;
  particleColor: string;
}

// ─── helpers ──────────────────────────────────────────────────────────

function hexToRgba(hex: string, a: number) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) || 128;
  const g = parseInt(c.substring(2, 4), 16) || 128;
  const b = parseInt(c.substring(4, 6), 16) || 128;
  return `rgba(${r},${g},${b},${a})`;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function resample(freq: number[], count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i / count) * freq.length * 0.6);
    out.push(freq[idx] ?? 0);
  }
  return out;
}

// ─── 1. Radial Waveform (Trap Nation style) ──────────────────────────
// Bars radiate outward from the logo edge. The logo is drawn by the
// preview-canvas on top, so we just leave the inner area clear.

export function drawRadialWaveform({ ctx, W, H, cx, cy, freq, config, t }: RendererArgs) {
  const numBars = 180;
  // Inner radius matches the logo size so bars start at the logo edge
  const logoSize = Math.min(W, H) * 0.28 * config.waveformScale;
  const innerRadius = logoSize * 0.52; // just outside the logo square's inscribed circle
  const maxBarHeight = Math.min(W, H) * 0.22 * config.reactivity;
  const bars = resample(freq, numBars);
  const symmetric = [...bars, ...bars.slice().reverse()];

  ctx.save();
  ctx.translate(cx, cy);

  // Outer glow ring (subtle atmosphere)
  const outerGlow = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, innerRadius + maxBarHeight * 1.2);
  outerGlow.addColorStop(0, "transparent");
  outerGlow.addColorStop(0.5, hexToRgba(config.waveColor2, 0.03));
  outerGlow.addColorStop(1, "transparent");
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(0, 0, innerRadius + maxBarHeight * 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Draw bars
  for (let i = 0; i < symmetric.length; i++) {
    const angle = (i / symmetric.length) * Math.PI * 2 - Math.PI / 2;
    const barH = symmetric[i] * maxBarHeight;
    const r0 = innerRadius;
    const r1 = r0 + barH;

    const x1 = Math.cos(angle) * r0;
    const y1 = Math.sin(angle) * r0;
    const x2 = Math.cos(angle) * r1;
    const y2 = Math.sin(angle) * r1;

    const n = i / symmetric.length;
    // Gradient from waveColor1 to waveColor2 around the circle
    const blend = Math.abs(n - 0.5) * 2; // 0 at sides, 1 at top/bottom
    ctx.strokeStyle = blend < 0.5 ? config.waveColor1 : config.waveColor2;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4 + symmetric[i] * 0.6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Thin inner ring (right at logo edge)
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = config.waveColor1;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ─── 2. Linear Bars ──────────────────────────────────────────────────

export function drawLinearBars({ ctx, W, H, cx, cy, freq, config, t }: RendererArgs) {
  const numBars = 64;
  const bars = resample(freq, numBars);
  const gap = 3;
  const totalW = W * 0.8;
  const barW = (totalW - gap * (numBars - 1)) / numBars;
  const startX = (W - totalW) / 2;
  const baseY = H * 0.65;
  const maxH = H * 0.4 * config.reactivity;

  ctx.save();
  for (let i = 0; i < numBars; i++) {
    const x = startX + i * (barW + gap);
    const h = bars[i] * maxH;
    const n = i / numBars;

    // gradient per bar
    const grad = ctx.createLinearGradient(x, baseY, x, baseY - h);
    grad.addColorStop(0, hexToRgba(config.waveColor1, 0.9));
    grad.addColorStop(1, hexToRgba(config.waveColor2, 0.9));
    ctx.fillStyle = grad;
    ctx.fillRect(x, baseY - h, barW, h);

    // reflection
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = config.waveColor1;
    ctx.fillRect(x, baseY + 2, barW, h * 0.3);
    ctx.globalAlpha = 1;

    // glow on top of bar
    if (bars[i] > 0.5) {
      ctx.shadowColor = config.waveColor2;
      ctx.shadowBlur = 8;
      ctx.fillStyle = config.waveColor2;
      ctx.fillRect(x, baseY - h, barW, 2);
      ctx.shadowBlur = 0;
    }
  }

  // baseline
  ctx.strokeStyle = hexToRgba(config.waveColor1, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(startX, baseY);
  ctx.lineTo(startX + totalW, baseY);
  ctx.stroke();

  ctx.restore();
}

// ─── 3. Particle Storm ───────────────────────────────────────────────

export function drawParticleStorm({ ctx, W, H, cx, cy, freq, config, t }: RendererArgs) {
  const avg = freq.reduce((s, v) => s + v, 0) / freq.length;
  const bass = freq.slice(0, 10).reduce((s, v) => s + v, 0) / 10;
  const count = Math.floor(60 * (config.particleDensity / 50));

  ctx.save();
  for (let i = 0; i < count; i++) {
    const seed = i * 137.508;
    const speed = 0.2 + (i % 3) * 0.15;
    const radius = 2 + Math.sin(seed) * 1.5 + bass * 4;
    const drift = bass * 30 * config.reactivity;

    const px = cx + Math.sin(seed + t * speed) * (W * 0.42 + drift);
    const py = cy + Math.cos(seed * 0.618 + t * speed * 0.7) * (H * 0.42 + drift);
    const alpha = (0.3 + avg * 0.6) * (0.4 + Math.sin(t * 2 + seed) * 0.3);

    // glow
    const grd = ctx.createRadialGradient(px, py, 0, px, py, radius * 3);
    grd.addColorStop(0, hexToRgba(config.waveColor2, alpha * 0.6));
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(px, py, radius * 3, 0, Math.PI * 2);
    ctx.fill();

    // core
    ctx.fillStyle = hexToRgba(config.particleColor, alpha);
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // central energy ring
  ctx.strokeStyle = hexToRgba(config.waveColor1, 0.15 + bass * 0.3);
  ctx.lineWidth = 1.5;
  const ringR = Math.min(W, H) * 0.12 + bass * 30;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ─── 4. Neon Ring ────────────────────────────────────────────────────

export function drawNeonRing({ ctx, W, H, cx, cy, freq, config, t }: RendererArgs) {
  const numPoints = 256;
  const bars = resample(freq, numPoints);
  const logoSize = Math.min(W, H) * 0.28 * config.waveformScale;
  const baseR = logoSize * 0.55; // ring wraps around the logo
  const maxDisp = Math.min(W, H) * 0.15 * config.reactivity;

  ctx.save();
  ctx.translate(cx, cy);

  // Draw 3 rings: shadow, main, bright core
  const layers = [
    { blur: 20, alpha: 0.15, width: 6, color: config.waveColor2 },
    { blur: 8, alpha: 0.5, width: 3, color: config.waveColor1 },
    { blur: 0, alpha: 0.9, width: 1.5, color: "#ffffff" },
  ];

  for (const layer of layers) {
    ctx.shadowColor = layer.color;
    ctx.shadowBlur = layer.blur;
    ctx.strokeStyle = hexToRgba(layer.color, layer.alpha);
    ctx.lineWidth = layer.width;
    ctx.beginPath();

    for (let i = 0; i <= numPoints; i++) {
      const n = (i % numPoints) / numPoints;
      const angle = n * Math.PI * 2 - Math.PI / 2;
      const disp = bars[i % numPoints] * maxDisp;
      const r = baseR + disp;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  // inner glow
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, baseR * 0.9);
  glow.addColorStop(0, hexToRgba(config.waveColor2, 0.08));
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, baseR * 0.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── 5. Minimal Wave ────────────────────────────────────────────────

export function drawMinimalWave({ ctx, W, H, cx, cy, freq, config, t }: RendererArgs) {
  const numPoints = 200;
  const bars = resample(freq, numPoints);
  const startX = W * 0.08;
  const endX = W * 0.92;
  const rangeX = endX - startX;
  const baseY = H * 0.5;
  const amplitude = H * 0.2 * config.reactivity;

  ctx.save();

  // Subtle grid lines
  ctx.strokeStyle = hexToRgba(config.waveColor1, 0.06);
  ctx.lineWidth = 1;
  for (let y = H * 0.2; y < H * 0.8; y += 30) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }

  // Draw main waveform
  ctx.strokeStyle = config.waveColor1;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  for (let i = 0; i < numPoints; i++) {
    const x = startX + (i / numPoints) * rangeX;
    const y = baseY + (bars[i] - 0.5) * amplitude * 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw shadow copy
  ctx.strokeStyle = hexToRgba(config.waveColor2, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < numPoints; i++) {
    const x = startX + (i / numPoints) * rangeX;
    const y = baseY + (bars[i] - 0.5) * amplitude * 2 + 4;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Horizontal baseline
  ctx.strokeStyle = hexToRgba(config.waveColor1, 0.2);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(startX, baseY);
  ctx.lineTo(endX, baseY);
  ctx.stroke();

  ctx.restore();
}

// ─── 6. Skyline ─────────────────────────────────────────────────────

export function drawSkyline({ ctx, W, H, cx, cy, freq, config, t }: RendererArgs) {
  const numBuildings = 40;
  const bars = resample(freq, numBuildings);
  const groundY = H * 0.75;
  const maxH = H * 0.55 * config.reactivity;
  const bldgW = (W * 0.9) / numBuildings;
  const startX = W * 0.05;

  ctx.save();

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, hexToRgba(config.waveColor2, 0.05));
  sky.addColorStop(1, "transparent");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, groundY);

  // Buildings
  for (let i = 0; i < numBuildings; i++) {
    const x = startX + i * bldgW;
    const h = 20 + bars[i] * maxH;
    const n = i / numBuildings;

    // Building body
    const grad = ctx.createLinearGradient(x, groundY, x, groundY - h);
    grad.addColorStop(0, hexToRgba(config.waveColor1, 0.6));
    grad.addColorStop(1, hexToRgba(config.waveColor2, 0.3));
    ctx.fillStyle = grad;
    ctx.fillRect(x + 1, groundY - h, bldgW - 2, h);

    // Windows
    ctx.fillStyle = hexToRgba(config.accentColor, 0.4 + bars[i] * 0.4);
    const windowRows = Math.floor(h / 12);
    for (let row = 0; row < windowRows; row++) {
      const wy = groundY - h + 6 + row * 12;
      ctx.fillRect(x + 3, wy, bldgW * 0.3, 4);
      ctx.fillRect(x + bldgW * 0.5, wy, bldgW * 0.3, 4);
    }

    // Rooftop glow on active bars
    if (bars[i] > 0.6) {
      ctx.fillStyle = hexToRgba(config.waveColor2, bars[i] * 0.5);
      ctx.fillRect(x, groundY - h - 3, bldgW, 3);
    }
  }

  // Ground line
  ctx.strokeStyle = hexToRgba(config.waveColor1, 0.4);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(W, groundY);
  ctx.stroke();

  // Reflection
  ctx.globalAlpha = 0.08;
  ctx.scale(1, -1);
  ctx.translate(0, -groundY * 2);
  for (let i = 0; i < numBuildings; i++) {
    const x = startX + i * bldgW;
    const h = 20 + bars[i] * maxH;
    ctx.fillStyle = config.waveColor1;
    ctx.fillRect(x + 1, groundY - h * 0.3, bldgW - 2, h * 0.3);
  }

  ctx.restore();
}

// ─── 7. 3D Sphere ───────────────────────────────────────────────────

export function drawSphere3D({ ctx, W, H, cx, cy, freq, config, t }: RendererArgs) {
  const baseR = Math.min(W, H) * 0.2 * config.waveformScale;
  const avg = freq.reduce((s, v) => s + v, 0) / freq.length;
  const bass = freq.slice(0, 10).reduce((s, v) => s + v, 0) / 10;

  ctx.save();
  ctx.translate(cx, cy);

  // Latitude lines
  const latCount = 12;
  for (let lat = 0; lat < latCount; lat++) {
    const phi = (lat / latCount) * Math.PI;
    const r = Math.sin(phi) * baseR;
    const y = Math.cos(phi) * baseR;

    // Displacement from audio
    const freqIdx = Math.floor((lat / latCount) * freq.length * 0.5);
    const disp = (freq[freqIdx] || 0) * baseR * 0.3 * config.reactivity;

    ctx.strokeStyle = hexToRgba(config.waveColor1, 0.2 + (freq[freqIdx] || 0) * 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, y, r + disp, (r + disp) * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Longitude lines (rotating)
  const lonCount = 16;
  for (let lon = 0; lon < lonCount; lon++) {
    const theta = (lon / lonCount) * Math.PI + t * 0.5;
    ctx.strokeStyle = hexToRgba(config.waveColor2, 0.15);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const phi = (i / 40) * Math.PI;
      const freqIdx = Math.floor((i / 40) * freq.length * 0.5);
      const disp = (freq[freqIdx] || 0) * baseR * 0.3 * config.reactivity;
      const r = Math.sin(phi) * (baseR + disp);
      const y = Math.cos(phi) * (baseR + disp);
      const x = Math.cos(theta) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Outer glow pulse
  const glowR = baseR * (1.2 + bass * 0.4);
  const glow = ctx.createRadialGradient(0, 0, baseR * 0.8, 0, 0, glowR);
  glow.addColorStop(0, "transparent");
  glow.addColorStop(0.5, hexToRgba(config.waveColor2, 0.05 + bass * 0.1));
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, glowR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── 8. Crossing Bolts ──────────────────────────────────────────────

export function drawCrossingBolts({ ctx, W, H, cx, cy, freq, config, t }: RendererArgs) {
  const bass = freq.slice(0, 10).reduce((s, v) => s + v, 0) / 10;
  const mid = freq.slice(10, 40).reduce((s, v) => s + v, 0) / 30;
  const boltCount = 8;

  ctx.save();
  ctx.translate(cx, cy);

  for (let b = 0; b < boltCount; b++) {
    const angle = (b / boltCount) * Math.PI * 2 + t * 0.3;
    const intensity = freq[Math.floor((b / boltCount) * freq.length * 0.5)] || 0;
    const len = Math.min(W, H) * 0.35 * (0.3 + intensity * 0.7) * config.reactivity;

    ctx.strokeStyle = hexToRgba(b % 2 === 0 ? config.waveColor1 : config.waveColor2, 0.4 + intensity * 0.5);
    ctx.lineWidth = 1 + intensity * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);

    // Jagged bolt path
    const segs = 8;
    let px = 0, py = 0;
    for (let s = 1; s <= segs; s++) {
      const frac = s / segs;
      const targetX = Math.cos(angle) * len * frac;
      const targetY = Math.sin(angle) * len * frac;
      const jitter = (Math.sin(t * 10 + b * 7 + s * 3) * 15) * intensity;
      const perpX = -Math.sin(angle) * jitter;
      const perpY = Math.cos(angle) * jitter;
      px = targetX + perpX;
      py = targetY + perpY;
      ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Glow at tip
    if (intensity > 0.4) {
      const tipGlow = ctx.createRadialGradient(px, py, 0, px, py, 15);
      tipGlow.addColorStop(0, hexToRgba(config.waveColor2, 0.4));
      tipGlow.addColorStop(1, "transparent");
      ctx.fillStyle = tipGlow;
      ctx.beginPath();
      ctx.arc(px, py, 15, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Center energy orb
  const orbR = 10 + bass * 25;
  const orb = ctx.createRadialGradient(0, 0, 0, 0, 0, orbR);
  orb.addColorStop(0, hexToRgba(config.waveColor1, 0.6));
  orb.addColorStop(0.5, hexToRgba(config.waveColor2, 0.2));
  orb.addColorStop(1, "transparent");
  ctx.fillStyle = orb;
  ctx.beginPath();
  ctx.arc(0, 0, orbR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── 9. Glitter Storm ───────────────────────────────────────────────

export function drawGlitterStorm({ ctx, W, H, cx, cy, freq, config, t }: RendererArgs) {
  const avg = freq.reduce((s, v) => s + v, 0) / freq.length;
  const count = Math.floor(80 * (config.particleDensity / 50));

  ctx.save();

  for (let i = 0; i < count; i++) {
    const seed = i * 97.3 + 13;
    const phase = seed * 0.1 + t;
    const px = (Math.sin(seed * 1.3 + t * 0.4) * 0.5 + 0.5) * W;
    const py = (Math.cos(seed * 0.7 + t * 0.3) * 0.5 + 0.5) * H;
    const sparkle = Math.pow(Math.sin(phase * 3) * 0.5 + 0.5, 3);
    const size = (1 + sparkle * 3) * (0.5 + avg * 1.5);
    const alpha = sparkle * (0.3 + avg * 0.7);

    // Star shape for glitter
    ctx.fillStyle = hexToRgba(i % 3 === 0 ? config.waveColor1 : config.waveColor2, alpha);
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();

    // Cross flare on bright sparkles
    if (sparkle > 0.7 && avg > 0.2) {
      ctx.strokeStyle = hexToRgba(config.particleColor, alpha * 0.5);
      ctx.lineWidth = 0.5;
      const flareLen = size * 4;
      ctx.beginPath();
      ctx.moveTo(px - flareLen, py);
      ctx.lineTo(px + flareLen, py);
      ctx.moveTo(px, py - flareLen);
      ctx.lineTo(px, py + flareLen);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ─── 10. Forest Lights ──────────────────────────────────────────────

export function drawForestLights({ ctx, W, H, cx, cy, freq, config, t }: RendererArgs) {
  const numBeams = 24;
  const bars = resample(freq, numBeams);

  ctx.save();

  for (let i = 0; i < numBeams; i++) {
    const n = i / numBeams;
    const x = W * 0.05 + n * W * 0.9;
    const beamH = H * (0.3 + bars[i] * 0.6) * config.reactivity;
    const beamW = W / numBeams * 0.4;
    const bottomY = H * 0.85;

    // Beam gradient (bottom to top fade)
    const grad = ctx.createLinearGradient(x, bottomY, x, bottomY - beamH);
    const color = i % 2 === 0 ? config.waveColor1 : config.waveColor2;
    grad.addColorStop(0, hexToRgba(color, 0.4 + bars[i] * 0.4));
    grad.addColorStop(0.5, hexToRgba(color, 0.1 + bars[i] * 0.2));
    grad.addColorStop(1, "transparent");

    ctx.fillStyle = grad;
    ctx.fillRect(x - beamW / 2, bottomY - beamH, beamW, beamH);

    // Bottom glow spot
    const spotGlow = ctx.createRadialGradient(x, bottomY, 0, x, bottomY, beamW * 2);
    spotGlow.addColorStop(0, hexToRgba(color, 0.3 + bars[i] * 0.3));
    spotGlow.addColorStop(1, "transparent");
    ctx.fillStyle = spotGlow;
    ctx.beginPath();
    ctx.arc(x, bottomY, beamW * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground plane
  const ground = ctx.createLinearGradient(0, H * 0.85, 0, H);
  ground.addColorStop(0, hexToRgba(config.waveColor1, 0.1));
  ground.addColorStop(1, "transparent");
  ctx.fillStyle = ground;
  ctx.fillRect(0, H * 0.85, W, H * 0.15);

  ctx.restore();
}

// ─── 11. Magma Flow ─────────────────────────────────────────────────

export function drawMagmaFlow({ ctx, W, H, cx, cy, freq, config, t }: RendererArgs) {
  const bass = freq.slice(0, 10).reduce((s, v) => s + v, 0) / 10;
  const numBlobs = 12;

  ctx.save();

  // Flowing blobs
  for (let i = 0; i < numBlobs; i++) {
    const seed = i * 47.1;
    const intensity = freq[Math.floor((i / numBlobs) * freq.length * 0.5)] || 0;
    const bx = cx + Math.sin(seed + t * 0.5) * W * 0.35;
    const by = cy + Math.cos(seed * 0.7 + t * 0.4) * H * 0.3;
    const radius = 30 + intensity * 80 * config.reactivity;

    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, radius);
    const color1 = i % 3 === 0 ? config.waveColor1 : i % 3 === 1 ? config.waveColor2 : config.accentColor;
    grad.addColorStop(0, hexToRgba(color1, 0.3 + intensity * 0.4));
    grad.addColorStop(0.6, hexToRgba(color1, 0.1));
    grad.addColorStop(1, "transparent");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lava cracks overlay
  ctx.globalCompositeOperation = "lighter";
  const numCracks = 6;
  for (let i = 0; i < numCracks; i++) {
    const seed = i * 23.7;
    ctx.strokeStyle = hexToRgba(config.accentColor, 0.1 + bass * 0.3);
    ctx.lineWidth = 1 + bass * 2;
    ctx.beginPath();
    let px = Math.sin(seed) * W * 0.3 + cx;
    let py = Math.cos(seed) * H * 0.3 + cy;
    ctx.moveTo(px, py);
    for (let s = 0; s < 8; s++) {
      px += Math.sin(seed + s * 2 + t) * 40;
      py += Math.cos(seed * 0.5 + s * 3 + t * 0.7) * 30;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";

  ctx.restore();
}

// ─── 12. Neon Tunnel ────────────────────────────────────────────────

export function drawNeonTunnel({ ctx, W, H, cx, cy, freq, config, t }: RendererArgs) {
  const numRings = 16;
  const bars = resample(freq, numRings);

  ctx.save();
  ctx.translate(cx, cy);

  for (let i = numRings - 1; i >= 0; i--) {
    const depth = (i + 1) / numRings;
    const scale = 0.05 + depth * 0.95;
    const intensity = bars[i];
    const maxR = Math.min(W, H) * 0.4;
    const r = maxR * scale;

    // Rotation increases with depth
    const rot = t * 0.3 + i * 0.15;

    ctx.save();
    ctx.rotate(rot);

    // Hexagon shape
    const sides = 6;
    ctx.strokeStyle = hexToRgba(
      i % 2 === 0 ? config.waveColor1 : config.waveColor2,
      0.15 + intensity * 0.6
    );
    ctx.lineWidth = 1 + intensity * 2;
    ctx.beginPath();
    for (let s = 0; s <= sides; s++) {
      const angle = (s / sides) * Math.PI * 2;
      const disp = intensity * r * 0.15 * config.reactivity;
      const pr = r + disp;
      const px = Math.cos(angle) * pr;
      const py = Math.sin(angle) * pr;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  // Center vanishing point glow
  const vpGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.min(W, H) * 0.08);
  vpGlow.addColorStop(0, hexToRgba(config.waveColor1, 0.4));
  vpGlow.addColorStop(1, "transparent");
  ctx.fillStyle = vpGlow;
  ctx.beginPath();
  ctx.arc(0, 0, Math.min(W, H) * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── 13. Neon Pulse (GLSL shader) ───────────────────────────────────

import { renderNeonPulse } from "./webgl-ring";

export function drawNeonPulse({ ctx, W, H, cx, cy, freq, config, t }: RendererArgs) {
  const shaderCanvas = renderNeonPulse({
    W, H, t, freq,
    color1: config.waveColor1,
    color2: config.waveColor2,
    accent: config.accentColor,
  });

  if (shaderCanvas) {
    // Composite the WebGL output onto our 2D canvas
    ctx.drawImage(shaderCanvas as CanvasImageSource, 0, 0, W, H);
  } else {
    // Fallback: draw a simple ring if WebGL fails
    drawNeonRing({ ctx, W, H, cx, cy, freq, config, t });
  }
}

// ─── Dispatcher ──────────────────────────────────────────────────────

const RENDERERS: Record<string, (args: RendererArgs) => void> = {
  "radial-waveform": drawRadialWaveform,
  "linear-bars": drawLinearBars,
  "particle-storm": drawParticleStorm,
  "neon-ring": drawNeonRing,
  "minimal-wave": drawMinimalWave,
  "skyline": drawSkyline,
  "sphere-3d": drawSphere3D,
  "3d-sphere": drawSphere3D,
  "crossing-bolts": drawCrossingBolts,
  "glitter-storm": drawGlitterStorm,
  "forest-lights": drawForestLights,
  "magma-flow": drawMagmaFlow,
  "neon-tunnel": drawNeonTunnel,
  "neon-pulse": drawNeonPulse,
};

export function renderPreset(presetId: string | null | undefined, args: RendererArgs) {
  const renderer = RENDERERS[presetId || "radial-waveform"] || drawRadialWaveform;
  renderer(args);
}

// ─── Procedural frequency data (when no audio) ─────────────────────

export function generateProceduralFreq(t: number, bins: number = 128): number[] {
  const data: number[] = [];
  for (let i = 0; i < bins; i++) {
    const n = i / bins;
    const f1 = Math.sin(n * Math.PI * 8 + t * 2.5) * 0.5 + 0.5;
    const f2 = Math.sin(n * Math.PI * 3.7 + t * 1.8) * 0.3 + 0.3;
    const f3 = Math.sin(n * Math.PI * 12 + t * 4.2) * 0.2 + 0.2;
    const beat = Math.pow(Math.sin(t * 3.5) * 0.5 + 0.5, 3) * 0.35;
    const v = Math.max(0, Math.min(1, (f1 + f2 + f3 + beat) / 2));
    data.push(v);
  }
  return data;
}
