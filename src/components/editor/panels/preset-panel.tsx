"use client";

import { useEditorStore } from "@/stores/editor-store";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

type PresetMethod = "canvas2d" | "shader";

interface PresetEntry {
  id: string;
  name: string;
  category: string;
  tier: "free" | "pro";
  method: PresetMethod;
}

const SECTIONS: { method: PresetMethod; label: string; description: string }[] = [
  { method: "canvas2d", label: "Canvas 2D", description: "CPU-rendered presets" },
  { method: "shader", label: "GPU Shaders", description: "WebGL / GLSL powered" },
];

const PRESETS: PresetEntry[] = [
  // ── Canvas 2D ─────────────────────────────────────────
  { id: "radial-waveform", name: "Radial Waveform", category: "waveform", tier: "free", method: "canvas2d" },
  { id: "linear-bars", name: "Linear Bars", category: "waveform", tier: "free", method: "canvas2d" },
  { id: "particle-storm", name: "Particle Storm", category: "particles", tier: "free", method: "canvas2d" },
  { id: "neon-ring", name: "Neon Ring", category: "waveform", tier: "free", method: "canvas2d" },
  { id: "minimal-wave", name: "Minimal Wave", category: "minimal", tier: "free", method: "canvas2d" },
  { id: "skyline", name: "Skyline", category: "waveform", tier: "free", method: "canvas2d" },
  { id: "sphere-3d", name: "3D Sphere", category: "3d", tier: "pro", method: "canvas2d" },
  { id: "crossing-bolts", name: "Crossing Bolts", category: "particles", tier: "pro", method: "canvas2d" },
  { id: "glitter-storm", name: "Glitter Storm", category: "particles", tier: "pro", method: "canvas2d" },
  { id: "forest-lights", name: "Forest Lights", category: "particles", tier: "pro", method: "canvas2d" },
  { id: "magma-flow", name: "Magma Flow", category: "retro", tier: "pro", method: "canvas2d" },
  { id: "neon-tunnel", name: "Neon Tunnel", category: "3d", tier: "pro", method: "canvas2d" },
  { id: "trap-nation", name: "Trap Nation", category: "waveform", tier: "free", method: "canvas2d" },
  // ── GPU Shaders ───────────────────────────────────────
  { id: "neon-pulse", name: "Neon Pulse", category: "shader", tier: "free", method: "shader" },
  { id: "aurora-streams", name: "Aurora Streams", category: "shader", tier: "pro", method: "shader" },
  { id: "sonic-spiral", name: "Sonic Spiral", category: "shader", tier: "pro", method: "shader" },
  { id: "mandala-bloom", name: "Mandala Bloom", category: "shader", tier: "pro", method: "shader" },
  { id: "crystal-lattice", name: "Crystal Lattice", category: "shader", tier: "pro", method: "shader" },
  { id: "infinite-descent", name: "Infinite Descent", category: "shader", tier: "pro", method: "shader" },
];

const CATEGORY_COLORS: Record<string, string> = {
  waveform: "bg-blue-500/20 text-blue-400",
  particles: "bg-purple-500/20 text-purple-400",
  "3d": "bg-green-500/20 text-green-400",
  minimal: "bg-zinc-500/20 text-zinc-400",
  retro: "bg-orange-500/20 text-orange-400",
  shader: "bg-cyan-500/20 text-cyan-400",
};

const METHOD_COLORS: Record<PresetMethod, string> = {
  canvas2d: "border-blue-500/30",
  shader: "border-cyan-500/30",
};

function PresetIcon({ category }: { category: string }) {
  const icon =
    category === "3d" ? "3D"
    : category === "particles" ? "~"
    : category === "shader" ? "\u25C7"
    : "|||";
  return <span className="text-lg">{icon}</span>;
}

export function PresetPanel() {
  const project = useEditorStore((s) => s.project);
  const presetId = project?.presetId;

  async function selectPreset(id: string) {
    if (!project) return;
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presetId: id }),
    });
    useEditorStore.setState((s) => ({
      project: s.project ? { ...s.project, presetId: id } : null,
    }));
  }

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold">Presets</h3>

      {SECTIONS.map((section) => {
        const sectionPresets = PRESETS.filter((p) => p.method === section.method);
        return (
          <div key={section.method} className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </h4>
              <span className="text-[10px] text-muted-foreground/60">
                {section.description}
              </span>
            </div>
            <div className={cn("grid grid-cols-2 gap-2 rounded-lg border p-2", METHOD_COLORS[section.method])}>
              {sectionPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => selectPreset(preset.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-all",
                    presetId === preset.id
                      ? "border-primary bg-primary/10"
                      : "border-border/30 hover:border-border/60 hover:bg-muted/50"
                  )}
                >
                  <div className="flex h-16 w-full items-center justify-center rounded bg-gradient-to-br from-primary/20 to-accent/20">
                    <PresetIcon category={preset.category} />
                  </div>
                  <span className="text-xs font-medium">{preset.name}</span>
                  <Badge
                    variant="secondary"
                    className={cn("absolute right-1 top-1 text-[9px] px-1 py-0", CATEGORY_COLORS[preset.category])}
                  >
                    {preset.category}
                  </Badge>
                  {preset.tier === "pro" && (
                    <div className="absolute left-1 top-1">
                      <Lock className="h-3 w-3 text-yellow-500" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
