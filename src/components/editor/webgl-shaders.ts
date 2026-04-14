/**
 * Shared WebGL engine for all GLSL shader presets.
 *
 * Uses a SINGLE WebGL context + OffscreenCanvas. Shader programs are
 * compiled lazily on first use and cached by ID. All shaders share
 * the same vertex shader (fullscreen quad) and uniform interface.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface ShaderParams {
  W: number;
  H: number;
  t: number;
  freq: number[];
  color1: string; // hex
  color2: string;
  accent: string;
}

interface CachedProgram {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

// ─── Shared vertex shader ───────────────────────────────────────────

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// ─── Module-level state (single GL context) ─────────────────────────

let glCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
let gl: WebGLRenderingContext | null = null;
let vertShader: WebGLShader | null = null;
let quadBuffer: WebGLBuffer | null = null;
const programCache = new Map<string, CachedProgram>();
let currentProgramId: string | null = null;
let initWidth = 0;
let initHeight = 0;

// ─── Uniform names shared across all shaders ────────────────────────

const UNIFORM_NAMES = [
  "u_resolution", "u_time", "u_bass", "u_mid", "u_treble",
  "u_energy", "u_color1", "u_color2", "u_accent",
];

// ─── Helpers ────────────────────────────────────────────────────────

export function hexToVec3(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [
    (parseInt(c.substring(0, 2), 16) || 128) / 255,
    (parseInt(c.substring(2, 4), 16) || 128) / 255,
    (parseInt(c.substring(4, 6), 16) || 128) / 255,
  ];
}

// ─── GL initialisation ──────────────────────────────────────────────

function initGL(w: number, h: number): boolean {
  // Reuse existing context if same size
  if (gl && initWidth === w && initHeight === h) return true;

  // If size changed, resize the canvas but keep the context
  if (gl && glCanvas) {
    if (glCanvas instanceof HTMLCanvasElement) {
      glCanvas.width = w;
      glCanvas.height = h;
    } else {
      (glCanvas as OffscreenCanvas).width = w;
      (glCanvas as OffscreenCanvas).height = h;
    }
    gl.viewport(0, 0, w, h);
    initWidth = w;
    initHeight = h;
    return true;
  }

  // Create canvas
  try {
    glCanvas = new OffscreenCanvas(w, h);
  } catch {
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

  // Compile shared vertex shader once
  vertShader = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vertShader, VERT);
  gl.compileShader(vertShader);
  if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
    console.error("Shared vertex shader error:", gl.getShaderInfoLog(vertShader));
    gl = null;
    return false;
  }

  // Create fullscreen quad buffer once
  quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );

  gl.viewport(0, 0, w, h);
  initWidth = w;
  initHeight = h;

  // Clear program cache (new context = old programs invalid)
  programCache.clear();
  currentProgramId = null;

  return true;
}

// ─── Lazy program compilation ───────────────────────────────────────

function ensureProgram(id: string, fragSource: string): CachedProgram | null {
  const cached = programCache.get(id);
  if (cached) return cached;

  if (!gl || !vertShader) return null;

  const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fs, fragSource);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error(`Shader [${id}] fragment compile error:`, gl.getShaderInfoLog(fs));
    gl.deleteShader(fs);
    return null;
  }

  const program = gl.createProgram()!;
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(`Shader [${id}] link error:`, gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    gl.deleteShader(fs);
    return null;
  }

  // Cache uniform locations
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of UNIFORM_NAMES) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }

  const entry: CachedProgram = { program, uniforms };
  programCache.set(id, entry);
  return entry;
}

// ─── Public render function ─────────────────────────────────────────

export function renderShader(
  shaderId: string,
  fragSource: string,
  params: ShaderParams
): OffscreenCanvas | HTMLCanvasElement | null {
  const { W, H, t, freq, color1, color2, accent } = params;

  if (!initGL(W, H)) return null;
  if (!gl || !quadBuffer) return null;

  const entry = ensureProgram(shaderId, fragSource);
  if (!entry) return null;

  // Switch program if needed
  if (currentProgramId !== shaderId) {
    gl.useProgram(entry.program);

    // Re-bind quad vertex attrib (program switch can lose it)
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    const aPos = gl.getAttribLocation(entry.program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    currentProgramId = shaderId;
  }

  // Compute frequency bands
  const bassSlice = freq.slice(0, 15);
  const midSlice = freq.slice(15, 60);
  const trebleSlice = freq.slice(60, 120);
  const bass = bassSlice.reduce((s, v) => s + v, 0) / Math.max(bassSlice.length, 1);
  const mid = midSlice.reduce((s, v) => s + v, 0) / Math.max(midSlice.length, 1);
  const treble = trebleSlice.reduce((s, v) => s + v, 0) / Math.max(trebleSlice.length, 1);
  const energy = freq.reduce((s, v) => s + v, 0) / Math.max(freq.length, 1);

  // Set uniforms
  const u = entry.uniforms;
  gl.uniform2f(u.u_resolution, W, H);
  gl.uniform1f(u.u_time, t);
  gl.uniform1f(u.u_bass, bass);
  gl.uniform1f(u.u_mid, mid);
  gl.uniform1f(u.u_treble, treble);
  gl.uniform1f(u.u_energy, energy);
  gl.uniform3fv(u.u_color1, hexToVec3(color1));
  gl.uniform3fv(u.u_color2, hexToVec3(color2));
  gl.uniform3fv(u.u_accent, hexToVec3(accent));

  // Draw
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  return glCanvas;
}
