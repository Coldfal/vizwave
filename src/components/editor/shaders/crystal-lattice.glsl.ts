/** Crystal Lattice — hexagonal grid with audio-driven wave propagation */

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

// Hexagonal distance field
vec4 hexCoord(vec2 uv) {
  vec2 r = vec2(1.0, 1.732);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 gv;
  if (dot(a, a) < dot(b, b)) {
    gv = a;
  } else {
    gv = b;
  }
  // Hex distance
  float d = max(abs(gv.x), abs(gv.y * 0.5773 + abs(gv.x) * 0.5));
  // Cell ID
  vec2 id = uv - gv;
  return vec4(gv, id);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

  // Bass drives grid scale
  float gridScale = 6.0 + u_bass * 4.0;
  vec2 scaledUV = uv * gridScale;

  vec3 col = vec3(0.0);

  // Chromatic aberration offsets (treble-driven)
  float chromOffset = u_treble * 0.015;

  // Sample hex grid for R, G, B channels with offset
  for (int ch = 0; ch < 3; ch++) {
    float offset = (float(ch) - 1.0) * chromOffset;
    vec2 chUV = scaledUV + vec2(offset, offset * 0.5);

    vec4 hex = hexCoord(chUV);
    vec2 gv = hex.xy;
    vec2 id = hex.zw;

    // Distance from cell center
    float cellDist = length(gv);

    // Distance of this cell from world center (for wave propagation)
    float worldDist = length(id / gridScale);

    // Wave propagation from center — mids control speed
    float waveSpeed = 2.0 + u_mid * 4.0;
    float wave = sin(worldDist * 8.0 - u_time * waveSpeed) * 0.5 + 0.5;

    // Cell pulse intensity
    float cellHash = hash(id);
    float pulse = wave * (0.3 + u_energy * 0.7);
    pulse += cellHash * 0.1; // per-cell variation

    // Hex edge (neon cell outline)
    float hexDist = max(abs(gv.x), abs(gv.y * 0.5773 + abs(gv.x) * 0.5));
    float hexSize = 0.48;
    float edge = smoothstep(hexSize, hexSize - 0.03, hexDist);
    float outline = smoothstep(hexSize - 0.03, hexSize - 0.06, hexDist);
    float border = edge - outline;

    // Cell fill (bright pulsing)
    float fill = (1.0 - edge) * 0.0; // no fill by default
    fill = outline * pulse * 0.5;

    // Neon border glow
    float borderGlow = border * (0.5 + pulse * 0.5);

    float value = borderGlow + fill;

    // Assign to channel
    if (ch == 0) col.r += value;
    else if (ch == 1) col.g += value;
    else col.b += value;
  }

  // Recombine — without chromatic aberration the channels align
  // When treble is low, channels overlap → white/colored edges
  // When treble is high, channels separate → RGB fringing

  // Apply user colors to the luminance
  float lum = dot(col, vec3(0.333));
  vec4 hex = hexCoord(scaledUV);
  float worldDist = length(hex.zw / gridScale);

  // Color mapping based on distance from center
  vec3 baseColor = mix(u_color2, u_color1, smoothstep(0.0, 0.5, worldDist));

  // Mix between chromatic colored output and user-colored output
  float chromMix = u_treble * 0.6; // more treble = more chromatic
  vec3 userColored = baseColor * lum * 2.5;
  vec3 chromColored = col * 1.5;
  col = mix(userColored, chromColored, chromMix);

  // Accent glow at center
  float centerGlow = exp(-worldDist * worldDist * 8.0) * 0.3;
  col += u_accent * centerGlow * (1.0 + u_bass);

  // Pulsing accent highlight on active cells
  float wave2 = sin(worldDist * 8.0 - u_time * (2.0 + u_mid * 4.0)) * 0.5 + 0.5;
  float highlight = wave2 * smoothstep(0.4, 0.0, worldDist);
  col += u_accent * highlight * 0.15 * u_energy;

  // Vignette
  float vig = 1.0 - dot(uv * 1.2, uv * 1.2);
  col *= smoothstep(0.0, 0.5, vig);

  float alpha = clamp(max(col.r, max(col.g, col.b)) * 2.0, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;
