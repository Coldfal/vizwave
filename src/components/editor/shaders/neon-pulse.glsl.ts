/** Neon Pulse — extracted from webgl-ring.ts for use with shared engine */

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

float ring(vec2 uv, float radius, float thickness) {
  float d = abs(length(uv) - radius);
  return smoothstep(thickness, 0.0, d);
}

float glow(vec2 uv, float radius, float spread) {
  float d = abs(length(uv) - radius);
  return exp(-d * d * spread);
}

float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

  // Ring geometry
  float baseRadius = 0.18 + u_bass * 0.14;
  baseRadius += sin(u_time * 2.0) * 0.008;

  float angle = atan(uv.y, uv.x);
  float warp = sin(angle * 6.0 + u_time * 3.0) * u_mid * 0.04
             + sin(angle * 13.0 - u_time * 5.0) * u_treble * 0.02;
  float dist = length(uv);
  float ringDist = abs(dist - baseRadius - warp);

  // Neon core
  float thickness = 0.004 + u_energy * 0.003;
  float core = smoothstep(thickness, 0.0, ringDist);

  // Inner glow
  float innerGlow = exp(-ringDist * ringDist * (200.0 - u_bass * 120.0));

  // Outer glow
  float outerGlow = exp(-ringDist * ringDist * (40.0 - u_bass * 25.0));

  // Second ring (treble)
  float r2 = baseRadius * 0.65 + u_treble * 0.05;
  float warp2 = sin(angle * 8.0 - u_time * 4.0) * u_treble * 0.03;
  float ringDist2 = abs(dist - r2 - warp2);
  float ring2 = exp(-ringDist2 * ringDist2 * 300.0) * 0.5;
  float ring2Glow = exp(-ringDist2 * ringDist2 * 60.0) * 0.3;

  // Third ring (bass)
  float r3 = baseRadius * 1.35 + u_bass * 0.06;
  float ringDist3 = abs(dist - r3);
  float ring3 = exp(-ringDist3 * ringDist3 * 400.0) * 0.3 * u_bass;
  float ring3Glow = exp(-ringDist3 * ringDist3 * 50.0) * 0.15 * u_bass;

  // Radial rays
  float rays = 0.0;
  if (u_bass > 0.3) {
    float rayAngle = mod(angle + u_time * 0.5, 6.28318 / 16.0) - 3.14159 / 16.0;
    float rayMask = smoothstep(0.03, 0.0, abs(rayAngle));
    float rayFade = smoothstep(baseRadius + 0.15, baseRadius, dist);
    float rayStart = smoothstep(baseRadius - 0.02, baseRadius + 0.02, dist);
    rays = rayMask * rayFade * rayStart * (u_bass - 0.3) * 1.5;
  }

  // Particles
  float particles = 0.0;
  for (int i = 0; i < 24; i++) {
    float a = float(i) * 6.28318 / 24.0 + u_time * 0.3;
    float pr = baseRadius + sin(u_time * 3.0 + float(i) * 1.7) * 0.02 * u_energy;
    vec2 pp = vec2(cos(a), sin(a)) * pr;
    float pd = length(uv - pp);
    float sparkle = pow(sin(u_time * 5.0 + float(i) * 2.3) * 0.5 + 0.5, 4.0);
    particles += exp(-pd * pd * 8000.0) * sparkle * u_energy;
  }

  // Compose
  vec3 col = vec3(0.0);
  col += vec3(1.0) * core * 0.9;
  col += u_color1 * innerGlow * 0.7;
  col += u_color2 * outerGlow * 0.35;
  col += u_accent * (ring2 + ring2Glow);
  col += u_color2 * (ring3 + ring3Glow);
  col += u_color1 * rays;
  col += mix(vec3(1.0), u_accent, 0.5) * particles;

  float centerFill = smoothstep(baseRadius * 0.9, 0.0, dist) * 0.04 * (1.0 + u_bass);
  col += u_color1 * centerFill;

  float vig = 1.0 - dot(uv * 1.2, uv * 1.2);
  col *= smoothstep(0.0, 0.5, vig);

  float alpha = clamp(max(col.r, max(col.g, col.b)) * 2.0, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;
