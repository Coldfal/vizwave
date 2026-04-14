/** Infinite Descent — Julia set fractal with continuous audio-driven zoom */

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

// Cosine palette for smooth fractal coloring
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

  // Continuous zoom — bass drives speed
  float zoomSpeed = 0.3 + u_bass * 0.5;
  float zoom = exp(-mod(u_time * zoomSpeed, 8.0)); // cycles to avoid precision loss
  zoom = max(zoom, 0.0001);

  // Rotation driven by mids
  float rot = u_time * 0.15 * (1.0 + u_mid);
  float cs = cos(rot), sn = sin(rot);
  uv = mat2(cs, -sn, sn, cs) * uv;

  // Scale UV by zoom
  uv *= zoom;

  // Center offset for interesting region
  uv += vec2(-0.5, 0.0);

  // Julia set constant — subtly morphed by audio
  vec2 c = vec2(
    -0.7269 + sin(u_time * 0.3) * 0.02 * u_energy,
    0.1889 + cos(u_time * 0.25) * 0.02 * u_energy
  );

  // Iteration count: base 40 + treble adds up to 40 more
  int maxIter = 40 + int(u_treble * 40.0);
  // Cap at 80 for performance
  if (maxIter > 80) maxIter = 80;

  // Julia iteration: z = z^2 + c
  vec2 z = uv;
  float iter = 0.0;
  float escaped = 0.0;

  for (int i = 0; i < 80; i++) {
    if (i >= maxIter) break;

    // z = z^2 + c
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;

    if (dot(z, z) > 4.0) {
      escaped = 1.0;
      // Smooth iteration count
      iter = float(i) - log2(log2(dot(z, z))) + 4.0;
      break;
    }
    iter = float(i);
  }

  vec3 col = vec3(0.0);

  if (escaped > 0.5) {
    // Normalize iteration count
    float t = iter / float(maxIter);

    // Cosine palette coloring
    vec3 palA = vec3(0.5);
    vec3 palB = vec3(0.5);
    vec3 palC = vec3(1.0);
    vec3 palD = vec3(0.0, 0.1, 0.2);

    vec3 fractalColor = palette(t * 3.0 + u_time * 0.1, palA, palB, palC, palD);

    // Mix fractal palette with user colors
    float colorMix = sin(t * 6.28318 + u_time * 0.5) * 0.5 + 0.5;
    vec3 userGradient = mix(u_color1, u_color2, colorMix);

    col = mix(fractalColor, userGradient, 0.4 + u_energy * 0.2);

    // Brightness based on how quickly it escaped
    float brightness = 1.0 - t;
    brightness = pow(brightness, 0.5);
    col *= brightness;

    // Edge glow — points near the set boundary glow with accent
    float edgeGlow = exp(-t * 8.0) * 0.6;
    col += u_accent * edgeGlow;
  } else {
    // Inside the set — deep color with subtle pulsing
    float interior = 0.02 + u_bass * 0.03;
    col = u_color1 * interior;

    // Interior detail — orbit trap coloring
    float trap = length(z);
    trap = 1.0 / (1.0 + trap);
    col += u_accent * trap * 0.15 * u_energy;
  }

  // Bass-reactive brightness boost
  col *= 0.8 + u_bass * 0.5;

  // Vignette
  vec2 vuv = gl_FragCoord.xy / u_resolution - 0.5;
  float vig = 1.0 - dot(vuv, vuv) * 2.0;
  col *= smoothstep(0.0, 0.5, vig);

  float alpha = clamp(max(col.r, max(col.g, col.b)) * 2.0, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;
