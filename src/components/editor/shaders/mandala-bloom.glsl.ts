/** Mandala Bloom — 8-fold kaleidoscopic mandala with FBM noise */

export const FRAG = `
precision highp float;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform vec3  u_color1;
uniform vec3  u_color2;
uniform vec3  u_accent;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float val = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  // Base 4 octaves + treble adds detail
  int octaves = 4 + int(u_treble * 2.0);
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    val += amp * noise(p * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return val;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

  float dist = length(uv);
  float angle = atan(uv.y, uv.x);

  // 8-fold symmetry: fold angle into 1/16th wedge, then mirror
  float folds = 8.0;
  float wedge = 6.28318 / (folds * 2.0); // 1/16th
  float foldedAngle = mod(angle, wedge * 2.0);
  if (foldedAngle > wedge) {
    foldedAngle = wedge * 2.0 - foldedAngle; // mirror
  }

  // Mids rotate the pattern
  float rotation = u_time * 0.2 + u_mid * 0.5;
  foldedAngle += rotation;

  // Reconstruct UV in folded space
  vec2 foldUV = vec2(cos(foldedAngle), sin(foldedAngle)) * dist;

  // FBM sampling in reflected space
  float scale = 3.0 + u_energy * 2.0;
  float n1 = fbm(foldUV * scale + u_time * 0.3);
  float n2 = fbm(foldUV * scale * 1.7 - u_time * 0.2 + 5.0);

  // Bass drives central bloom radius
  float bloomRadius = 0.15 + u_bass * 0.2;
  float bloom = smoothstep(bloomRadius + 0.1, bloomRadius - 0.05, dist);

  // Pattern intensity
  float pattern = n1 * 0.6 + n2 * 0.4;
  pattern = smoothstep(0.2, 0.8, pattern);

  // Petal-like radial structures
  float petals = sin(foldedAngle * 3.0 + dist * 8.0 - u_time * 1.5) * 0.5 + 0.5;
  petals *= smoothstep(0.5, 0.1, dist);

  // Ring accents
  float ring1 = exp(-pow(dist - 0.2 - u_bass * 0.05, 2.0) * 200.0);
  float ring2 = exp(-pow(dist - 0.35 - u_energy * 0.03, 2.0) * 150.0);

  // Color mapping: radial gradient color1 → color2
  vec3 baseColor = mix(u_color1, u_color2, dist * 2.0);

  vec3 col = vec3(0.0);

  // Main mandala pattern
  col += baseColor * pattern * (0.4 + u_energy * 0.6);

  // Bloom center
  col += u_accent * bloom * 0.5 * (1.0 + u_bass);

  // Petal overlay
  col += mix(u_color1, u_accent, 0.5) * petals * 0.3;

  // Ring highlights
  col += u_color1 * ring1 * 0.6;
  col += u_color2 * ring2 * 0.4;

  // Dot grid along rings (treble sparkle)
  float dotAngle = mod(angle + rotation, 6.28318 / 16.0);
  float dotMask = smoothstep(0.04, 0.0, abs(dotAngle - 6.28318 / 32.0));
  float dotRing = exp(-pow(dist - 0.28, 2.0) * 500.0);
  col += u_accent * dotMask * dotRing * u_treble * 0.8;

  // Outer fade
  float fade = smoothstep(0.55, 0.2, dist);
  col *= fade;

  // Vignette
  float vig = 1.0 - dot(uv * 1.3, uv * 1.3);
  col *= smoothstep(0.0, 0.4, vig);

  float alpha = clamp(max(col.r, max(col.g, col.b)) * 2.0, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;
