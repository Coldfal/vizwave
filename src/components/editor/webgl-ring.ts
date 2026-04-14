/**
 * Neon Pulse shader preset — now uses the shared WebGL engine.
 *
 * The GLSL source lives in `shaders/neon-pulse.glsl.ts`.
 * This file keeps the same public API so nothing else needs to change.
 */

import { renderShader, type ShaderParams } from "./webgl-shaders";
import { FRAG } from "./shaders/neon-pulse.glsl";

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
  return renderShader("neon-pulse", FRAG, params);
}
