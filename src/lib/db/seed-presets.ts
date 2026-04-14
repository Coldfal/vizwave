import { db } from "./index";
import { presets } from "./schema";

const PRESETS = [
  { slug: "radial-waveform", name: "Radial Waveform", description: "Trap Nation–style concentric circle bars", category: "waveform" as const, tier: "free" as const, componentName: "RadialWaveform", sortOrder: 1 },
  { slug: "linear-bars", name: "Linear Bars", description: "Classic equalizer with glow effects", category: "waveform" as const, tier: "free" as const, componentName: "LinearBars", sortOrder: 2 },
  { slug: "particle-storm", name: "Particle Storm", description: "Audio-reactive particle field", category: "particles" as const, tier: "free" as const, componentName: "ParticleStorm", sortOrder: 3 },
  { slug: "neon-ring", name: "Neon Ring", description: "Circular neon waveform with glow", category: "waveform" as const, tier: "free" as const, componentName: "NeonRing", sortOrder: 4 },
  { slug: "minimal-wave", name: "Minimal Wave", description: "Clean oscilloscope line", category: "minimal" as const, tier: "free" as const, componentName: "MinimalWave", sortOrder: 5 },
  { slug: "skyline", name: "Skyline", description: "City silhouette with bouncing bars", category: "waveform" as const, tier: "free" as const, componentName: "Skyline", sortOrder: 6 },
  { slug: "3d-sphere", name: "3D Sphere", description: "Three.js sphere with vertex displacement", category: "3d" as const, tier: "pro" as const, componentName: "Sphere3D", sortOrder: 7 },
  { slug: "crossing-bolts", name: "Crossing Bolts", description: "Electric bolt patterns", category: "particles" as const, tier: "pro" as const, componentName: "CrossingBolts", sortOrder: 8 },
  { slug: "glitter-storm", name: "Glitter Storm", description: "Sparkle particles", category: "particles" as const, tier: "pro" as const, componentName: "GlitterStorm", sortOrder: 9 },
  { slug: "forest-lights", name: "Forest Lights", description: "Vertical light beams", category: "minimal" as const, tier: "pro" as const, componentName: "ForestLights", sortOrder: 10 },
  { slug: "magma-flow", name: "Magma Flow", description: "Fluid lava lamp effect", category: "retro" as const, tier: "pro" as const, componentName: "MagmaFlow", sortOrder: 11 },
  { slug: "neon-tunnel", name: "Neon Tunnel", description: "3D wireframe tunnel with depth", category: "3d" as const, tier: "pro" as const, componentName: "NeonTunnel", sortOrder: 12 },
];

async function seed() {
  console.log("Seeding presets...");

  for (const preset of PRESETS) {
    await db
      .insert(presets)
      .values({
        id: preset.slug, // use slug as ID for easy FK matching
        ...preset,
        defaultConfig: JSON.stringify({}),
      })
      .onConflictDoNothing();
  }

  console.log(`Seeded ${PRESETS.length} presets.`);
}

seed().catch(console.error);
