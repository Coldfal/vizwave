/** Sonic Spiral — galaxy-like logarithmic spiral arms reacting to audio */

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

float hash(float n) { return fract(sin(n) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(dot(i, vec2(127.1, 311.7)));
  float b = hash(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7)));
  float c = hash(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7)));
  float d = hash(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7)));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

  float dist = length(uv);
  float angle = atan(uv.y, uv.x);

  // Bass drives rotation speed
  float rotSpeed = 0.3 + u_bass * 0.8;
  float rot = u_time * rotSpeed;

  vec3 col = vec3(0.0);

  // 4 logarithmic spiral arms
  float numArms = 4.0;
  for (int arm = 0; arm < 4; arm++) {
    float armOffset = float(arm) * 6.28318 / numArms;

    // Logarithmic spiral: angle = a * ln(r) + offset
    float spiralTightness = 3.0 + u_mid * 2.0;
    float spiralAngle = angle - log(max(dist, 0.001)) * spiralTightness - rot + armOffset;

    // Wrap to [-PI, PI]
    spiralAngle = mod(spiralAngle + 3.14159, 6.28318) - 3.14159;

    // Arm width controlled by mids
    float armWidth = 0.3 + u_mid * 0.4;
    float armBrightness = exp(-spiralAngle * spiralAngle / (armWidth * armWidth));

    // Radial falloff (dimmer at edges)
    float radialFade = exp(-dist * dist * 1.5);

    // Fine detail from treble — secondary spiral ripple
    float detail = sin(angle * 12.0 - log(max(dist, 0.001)) * 8.0 - u_time * 3.0) * 0.5 + 0.5;
    detail = mix(0.7, 1.0, detail * u_treble);

    // Color: alternate arms between color1 and color2
    float armF = float(arm);
    float isEven = step(0.5, mod(armF, 2.0));
    vec3 armColor = mix(u_color1, u_color2, isEven);

    // Comet-trail glow along arm edges
    float edgeGlow = exp(-abs(spiralAngle) * 3.0 / armWidth) * 0.3;

    float intensity = (armBrightness + edgeGlow) * radialFade * detail;
    intensity *= 0.5 + u_energy * 0.5;

    col += armColor * intensity;
  }

  // Bright core glow with accent
  float coreGlow = exp(-dist * dist * 40.0);
  col += u_accent * coreGlow * (0.6 + u_bass * 0.8);

  // Secondary core ring
  float coreRing = exp(-pow(dist - 0.05, 2.0) * 400.0) * 0.4;
  col += u_accent * coreRing * u_energy;

  // Star particles between arms
  if (u_treble > 0.1) {
    for (int i = 0; i < 30; i++) {
      float fi = float(i);
      float starAngle = hash(fi * 7.3) * 6.28318 + u_time * 0.2 * (hash(fi * 3.1) - 0.5);
      float starDist = hash(fi * 11.7) * 0.45 + 0.02;
      vec2 starPos = vec2(cos(starAngle), sin(starAngle)) * starDist;
      float d = length(uv - starPos);
      float sparkle = pow(sin(u_time * 4.0 + fi * 2.7) * 0.5 + 0.5, 6.0);
      float star = exp(-d * d * 15000.0) * sparkle * u_treble;
      col += mix(vec3(1.0), u_accent, 0.3) * star;
    }
  }

  // Vignette
  float vig = 1.0 - dist * dist * 2.0;
  col *= max(vig, 0.0);

  float alpha = clamp(max(col.r, max(col.g, col.b)) * 2.0, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;
