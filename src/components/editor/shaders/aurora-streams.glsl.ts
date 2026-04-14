/** Aurora Streams — flowing aurora borealis ribbons reacting to audio */

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

// ── Noise helpers ──────────────────────────────────────────────────
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

float fbm(vec2 p, int octaves) {
  float val = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    val += amp * noise(p * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return val;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  vec3 col = vec3(0.0);

  // Flow speed driven by mids
  float flowSpeed = 0.3 + u_mid * 0.7;

  // 4 aurora curtains at different vertical positions
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float baseY = 0.35 + fi * 0.12;

    // Bass bunches / spreads layers
    baseY += (u_bass - 0.3) * 0.06 * (fi - 1.5);

    // FBM displacement
    float turbulence = 2.0 + u_treble * 4.0;
    float nx = p.x * 1.5 + u_time * flowSpeed * (0.8 + fi * 0.15);
    float ny = fi * 3.7 + u_time * 0.15;
    float displacement = fbm(vec2(nx, ny), 4 + int(u_treble * 2.0)) * 0.3;
    displacement += sin(p.x * 3.0 + u_time * flowSpeed + fi * 2.0) * 0.05 * (1.0 + u_bass);

    float curtainY = baseY + displacement;

    // Vertical falloff — soft ribbon shape
    float dist = abs(uv.y - curtainY);
    float width = 0.04 + u_energy * 0.03 + u_bass * 0.02;
    float ribbon = exp(-dist * dist / (width * width));

    // Brightness modulation along x
    float brightness = 0.5 + 0.5 * sin(p.x * 4.0 + u_time * 2.0 + fi * 1.5);
    brightness = 0.3 + brightness * 0.7;

    // Color gradient across layers: color1 → color2 → accent
    vec3 ribbonColor;
    if (i < 2) {
      ribbonColor = mix(u_color1, u_color2, fi / 2.0);
    } else {
      ribbonColor = mix(u_color2, u_accent, (fi - 2.0) / 2.0);
    }

    // Intensity scales with energy
    float intensity = (0.3 + u_energy * 0.7) * brightness;

    col += ribbonColor * ribbon * intensity * (0.6 + fi * 0.1);
  }

  // Vertical rays at low opacity (aurora pillars)
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float rayX = hash(vec2(fi * 7.3, 13.1));
    rayX = rayX * aspect;
    float drift = sin(u_time * 0.5 + fi * 2.0) * 0.1;
    float rayDist = abs(p.x - rayX - drift);
    float ray = exp(-rayDist * rayDist * 80.0);

    // Vertical fade — stronger in upper half
    float vertFade = smoothstep(0.1, 0.6, uv.y) * smoothstep(1.0, 0.7, uv.y);

    vec3 rayColor = mix(u_color1, u_accent, fi / 8.0);
    col += rayColor * ray * vertFade * 0.08 * (1.0 + u_bass * 2.0);
  }

  // Subtle shimmer (treble sparkle)
  float shimmer = noise(uv * 80.0 + u_time * 3.0);
  shimmer = pow(shimmer, 8.0) * u_treble * 0.3;
  col += vec3(shimmer) * u_accent;

  // Vignette
  vec2 vc = uv - 0.5;
  float vig = 1.0 - dot(vc, vc) * 1.5;
  col *= smoothstep(0.0, 0.5, vig);

  float alpha = clamp(max(col.r, max(col.g, col.b)) * 2.0, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;
