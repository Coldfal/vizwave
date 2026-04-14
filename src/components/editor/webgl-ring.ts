/**
 * Offscreen WebGL renderer for the Neon Pulse shader preset.
 *
 * Creates a pulsing neon ring whose radius is mapped to low-frequency
 * audio data.  The result is drawn to an offscreen canvas that the
 * main 2D preview canvas composites via `drawImage()`.
 */

// ─── Shader sources ─────────────────────────────────────────────────

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_bass;       // 0-1  low-freq energy  (20-250 Hz)
uniform float u_mid;        // 0-1  mid-freq energy   (250-2 kHz)
uniform float u_treble;     // 0-1  high-freq energy  (2-16 kHz)
uniform float u_energy;     // 0-1  overall energy
uniform vec3  u_color1;     // primary neon colour
uniform vec3  u_color2;     // secondary neon colour
uniform vec3  u_accent;     // accent / highlight

// ── helpers ──────────────────────────────────────────────────────────

float ring(vec2 uv, float radius, float thickness) {
  float d = abs(length(uv) - radius);
  return smoothstep(thickness, 0.0, d);
}

float glow(vec2 uv, float radius, float spread) {
  float d = abs(length(uv) - radius);
  return exp(-d * d * spread);
}

// Simple pseudo-noise
float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

  // ── Ring geometry ────────────────────────────────────────────────
  // Base radius modulated by bass
  float baseRadius = 0.18 + u_bass * 0.14;
  // Subtle breathing
  baseRadius += sin(u_time * 2.0) * 0.008;

  // Ring distortion mapped to mid frequencies
  float angle = atan(uv.y, uv.x);
  float warp = sin(angle * 6.0 + u_time * 3.0) * u_mid * 0.04
             + sin(angle * 13.0 - u_time * 5.0) * u_treble * 0.02;
  float dist = length(uv);
  float ringDist = abs(dist - baseRadius - warp);

  // ── Neon core ────────────────────────────────────────────────────
  float thickness = 0.004 + u_energy * 0.003;
  float core = smoothstep(thickness, 0.0, ringDist);

  // ── Inner glow ───────────────────────────────────────────────────
  float innerGlow = exp(-ringDist * ringDist * (200.0 - u_bass * 120.0));

  // ── Outer glow (wider, softer) ───────────────────────────────────
  float outerGlow = exp(-ringDist * ringDist * (40.0 - u_bass * 25.0));

  // ── Second ring (reacts to treble) ───────────────────────────────
  float r2 = baseRadius * 0.65 + u_treble * 0.05;
  float warp2 = sin(angle * 8.0 - u_time * 4.0) * u_treble * 0.03;
  float ringDist2 = abs(dist - r2 - warp2);
  float ring2 = exp(-ringDist2 * ringDist2 * 300.0) * 0.5;
  float ring2Glow = exp(-ringDist2 * ringDist2 * 60.0) * 0.3;

  // ── Third ring (outer, bass) ─────────────────────────────────────
  float r3 = baseRadius * 1.35 + u_bass * 0.06;
  float ringDist3 = abs(dist - r3);
  float ring3 = exp(-ringDist3 * ringDist3 * 400.0) * 0.3 * u_bass;
  float ring3Glow = exp(-ringDist3 * ringDist3 * 50.0) * 0.15 * u_bass;

  // ── Radial rays (energy burst on beats) ──────────────────────────
  float rays = 0.0;
  if (u_bass > 0.3) {
    float rayAngle = mod(angle + u_time * 0.5, 6.28318 / 16.0) - 3.14159 / 16.0;
    float rayMask = smoothstep(0.03, 0.0, abs(rayAngle));
    float rayFade = smoothstep(baseRadius + 0.15, baseRadius, dist);
    float rayStart = smoothstep(baseRadius - 0.02, baseRadius + 0.02, dist);
    rays = rayMask * rayFade * rayStart * (u_bass - 0.3) * 1.5;
  }

  // ── Particles (sparkle dots along the ring) ──────────────────────
  float particles = 0.0;
  for (int i = 0; i < 24; i++) {
    float a = float(i) * 6.28318 / 24.0 + u_time * 0.3;
    float pr = baseRadius + sin(u_time * 3.0 + float(i) * 1.7) * 0.02 * u_energy;
    vec2 pp = vec2(cos(a), sin(a)) * pr;
    float pd = length(uv - pp);
    float sparkle = pow(sin(u_time * 5.0 + float(i) * 2.3) * 0.5 + 0.5, 4.0);
    particles += exp(-pd * pd * 8000.0) * sparkle * u_energy;
  }

  // ── Compose ──────────────────────────────────────────────────────
  vec3 col = vec3(0.0);

  // Main ring: core white, glow in primary colour
  col += vec3(1.0) * core * 0.9;
  col += u_color1 * innerGlow * 0.7;
  col += u_color2 * outerGlow * 0.35;

  // Second ring in accent
  col += u_accent * (ring2 + ring2Glow);

  // Third ring in secondary
  col += u_color2 * (ring3 + ring3Glow);

  // Rays in primary
  col += u_color1 * rays;

  // Particles in white/accent mix
  col += mix(vec3(1.0), u_accent, 0.5) * particles;

  // Center subtle fill
  float centerFill = smoothstep(baseRadius * 0.9, 0.0, dist) * 0.04 * (1.0 + u_bass);
  col += u_color1 * centerFill;

  // Vignette
  float vig = 1.0 - dot(uv * 1.2, uv * 1.2);
  col *= smoothstep(0.0, 0.5, vig);

  gl_FragColor = vec4(col, 1.0);
}
`;

// ─── WebGL state (persisted across frames) ──────────────────────────

let glCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | null = null;
let uniforms: Record<string, WebGLUniformLocation | null> = {};
let initWidth = 0;
let initHeight = 0;

function initGL(w: number, h: number): boolean {
  if (gl && initWidth === w && initHeight === h) return true;

  // Create offscreen canvas
  try {
    glCanvas = new OffscreenCanvas(w, h);
  } catch {
    // Fallback for browsers without OffscreenCanvas
    glCanvas = document.createElement("canvas");
    glCanvas.width = w;
    glCanvas.height = h;
  }

  gl = glCanvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: true,
  }) as WebGLRenderingContext | null;

  if (!gl) return false;

  // Compile shaders
  const vs = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vs, VERT);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error("Vertex shader error:", gl.getShaderInfoLog(vs));
    return false;
  }

  const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fs, FRAG);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error("Fragment shader error:", gl.getShaderInfoLog(fs));
    return false;
  }

  program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    return false;
  }

  gl.useProgram(program);

  // Full-screen quad
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // Cache uniform locations
  const names = [
    "u_resolution", "u_time", "u_bass", "u_mid", "u_treble",
    "u_energy", "u_color1", "u_color2", "u_accent",
  ];
  uniforms = {};
  for (const n of names) {
    uniforms[n] = gl.getUniformLocation(program, n);
  }

  gl.viewport(0, 0, w, h);
  initWidth = w;
  initHeight = h;
  return true;
}

// ─── Public render function ─────────────────────────────────────────

function hexToVec3(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [
    (parseInt(c.substring(0, 2), 16) || 128) / 255,
    (parseInt(c.substring(2, 4), 16) || 128) / 255,
    (parseInt(c.substring(4, 6), 16) || 128) / 255,
  ];
}

export interface NeonPulseParams {
  W: number;
  H: number;
  t: number;
  freq: number[];
  color1: string;  // hex
  color2: string;
  accent: string;
}

/**
 * Render the neon pulse shader and return the canvas to composite.
 * Returns null if WebGL is unavailable.
 */
export function renderNeonPulse(params: NeonPulseParams): OffscreenCanvas | HTMLCanvasElement | null {
  const { W, H, t, freq, color1, color2, accent } = params;

  if (!initGL(W, H)) return null;
  if (!gl || !program) return null;

  gl.useProgram(program);

  // Compute frequency bands
  const bassSlice = freq.slice(0, 15);
  const midSlice = freq.slice(15, 60);
  const trebleSlice = freq.slice(60, 120);
  const bass = bassSlice.reduce((s, v) => s + v, 0) / bassSlice.length;
  const mid = midSlice.reduce((s, v) => s + v, 0) / midSlice.length;
  const treble = trebleSlice.reduce((s, v) => s + v, 0) / Math.max(trebleSlice.length, 1);
  const energy = freq.reduce((s, v) => s + v, 0) / freq.length;

  // Set uniforms
  gl.uniform2f(uniforms.u_resolution, W, H);
  gl.uniform1f(uniforms.u_time, t);
  gl.uniform1f(uniforms.u_bass, bass);
  gl.uniform1f(uniforms.u_mid, mid);
  gl.uniform1f(uniforms.u_treble, treble);
  gl.uniform1f(uniforms.u_energy, energy);
  gl.uniform3fv(uniforms.u_color1, hexToVec3(color1));
  gl.uniform3fv(uniforms.u_color2, hexToVec3(color2));
  gl.uniform3fv(uniforms.u_accent, hexToVec3(accent));

  // Draw
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  return glCanvas;
}
