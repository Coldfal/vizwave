"use client";

import { useEffect, useState } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Lock, Save, Trash2, Sparkles } from "lucide-react";
import type { ProjectConfig } from "@/lib/types";
import { DEFAULT_PROJECT_CONFIG } from "@/lib/types";

interface UserPreset {
  id: string;
  name: string;
  presetId: string;
  config: string; // JSON
  createdAt: string;
}

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
  { id: "linear-dots", name: "Linear Dots", category: "waveform", tier: "free", method: "canvas2d" },
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
  const config = useEditorStore((s) => s.config);
  const presetId = project?.presetId;

  const [savedPresets, setSavedPresets] = useState<UserPreset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [saveValue, setSaveValue] = useState("");

  useEffect(() => {
    fetch("/api/user-presets")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSavedPresets(Array.isArray(d) ? d : []))
      .finally(() => setLoadingPresets(false));
  }, []);

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

  async function saveCurrentAsPreset() {
    const name = saveValue.trim();
    if (!name || !project) return;
    const res = await fetch("/api/user-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        presetId: project.presetId,
        config,
      }),
    });
    if (res.ok) {
      const created: UserPreset = await res.json();
      setSavedPresets((p) => [created, ...p]);
      setSavingName(null);
      setSaveValue("");
    }
  }

  async function applyUserPreset(p: UserPreset) {
    if (!project) return;
    const parsed = JSON.parse(p.config) as Partial<ProjectConfig>;
    const merged: ProjectConfig = { ...DEFAULT_PROJECT_CONFIG, ...parsed };
    // Update config in store
    useEditorStore.setState((s) => ({
      config: merged,
      project: s.project ? { ...s.project, presetId: p.presetId } : null,
      isDirty: true,
    }));
    // Persist preset change server-side
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presetId: p.presetId, config: JSON.stringify(merged) }),
    });
  }

  async function deleteUserPreset(id: string) {
    await fetch(`/api/user-presets/${id}`, { method: "DELETE" });
    setSavedPresets((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold">Presets</h3>

      {/* My Presets — user-saved configurations */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              My Presets
            </h4>
            <Sparkles className="h-3 w-3 text-primary" />
          </div>
          {savingName === null ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => {
                setSavingName("new");
                setSaveValue("");
              }}
              disabled={!project}
            >
              <Save className="mr-1 h-3 w-3" />
              Save current
            </Button>
          ) : null}
        </div>
        {savingName !== null && (
          <div className="flex gap-1.5">
            <Input
              autoFocus
              value={saveValue}
              onChange={(e) => setSaveValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCurrentAsPreset();
                if (e.key === "Escape") setSavingName(null);
              }}
              placeholder="Preset name"
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              className="h-8"
              onClick={saveCurrentAsPreset}
              disabled={!saveValue.trim()}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => setSavingName(null)}
            >
              Cancel
            </Button>
          </div>
        )}
        {loadingPresets ? (
          <p className="text-[11px] text-muted-foreground">Loading…</p>
        ) : savedPresets.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No saved presets yet. Customize a look, then hit "Save current".
          </p>
        ) : (
          <div className="space-y-1">
            {savedPresets.map((p) => (
              <div
                key={p.id}
                className="group flex items-center gap-2 rounded-md border border-border/40 bg-muted/20 p-2 transition hover:border-border/80 hover:bg-muted/40"
              >
                <button
                  onClick={() => applyUserPreset(p)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-primary/30 to-accent/30 text-xs">
                    <Sparkles className="h-3 w-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{p.name}</div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {p.presetId}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => deleteUserPreset(p.id)}
                  className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                  aria-label="Delete preset"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
