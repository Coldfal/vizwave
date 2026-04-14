"use client";

import { useEditorStore } from "@/stores/editor-store";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

const PRESETS = [
  { id: "radial-waveform", name: "Radial Waveform", category: "waveform", tier: "free" as const },
  { id: "linear-bars", name: "Linear Bars", category: "waveform", tier: "free" as const },
  { id: "particle-storm", name: "Particle Storm", category: "particles", tier: "free" as const },
  { id: "neon-ring", name: "Neon Ring", category: "waveform", tier: "free" as const },
  { id: "minimal-wave", name: "Minimal Wave", category: "minimal", tier: "free" as const },
  { id: "skyline", name: "Skyline", category: "waveform", tier: "free" as const },
  { id: "sphere-3d", name: "3D Sphere", category: "3d", tier: "pro" as const },
  { id: "crossing-bolts", name: "Crossing Bolts", category: "particles", tier: "pro" as const },
  { id: "glitter-storm", name: "Glitter Storm", category: "particles", tier: "pro" as const },
  { id: "forest-lights", name: "Forest Lights", category: "particles", tier: "pro" as const },
  { id: "magma-flow", name: "Magma Flow", category: "retro", tier: "pro" as const },
  { id: "neon-tunnel", name: "Neon Tunnel", category: "3d", tier: "pro" as const },
  { id: "neon-pulse", name: "Neon Pulse", category: "waveform", tier: "free" as const },
];

const CATEGORY_COLORS: Record<string, string> = {
  waveform: "bg-blue-500/20 text-blue-400",
  particles: "bg-purple-500/20 text-purple-400",
  "3d": "bg-green-500/20 text-green-400",
  minimal: "bg-zinc-500/20 text-zinc-400",
  retro: "bg-orange-500/20 text-orange-400",
};

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
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Presets</h3>
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((preset) => (
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
            {/* Preset thumbnail placeholder */}
            <div
              className="flex h-16 w-full items-center justify-center rounded bg-gradient-to-br from-primary/20 to-accent/20"
            >
              <span className="text-lg">
                {preset.category === "3d" ? "3D" : preset.category === "particles" ? "~" : "|||"}
              </span>
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
}
