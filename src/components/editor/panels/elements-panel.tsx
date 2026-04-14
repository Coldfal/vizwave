"use client";

import { useEditorStore } from "@/stores/editor-store";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ElementsPanel() {
  const config = useEditorStore((s) => s.config);
  const updateConfig = useEditorStore((s) => s.updateConfig);

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold">Elements & Effects</h3>

      {/* Particles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Particles</Label>
          <Switch
            checked={config.particles}
            onCheckedChange={(v) => updateConfig({ particles: v })}
          />
        </div>
        {config.particles && (
          <>
            <div className="space-y-2">
              <Label className="text-xs">
                Density: {config.particleDensity}
              </Label>
              <Slider
                value={[config.particleDensity]}
                onValueChange={(v) => updateConfig({ particleDensity: Array.isArray(v) ? v[0] : v })}
                min={10}
                max={200}
                step={5}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Particle Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.particleColor}
                  onChange={(e) =>
                    updateConfig({ particleColor: e.target.value })
                  }
                  className="h-8 w-8 cursor-pointer rounded border border-border/50 bg-transparent"
                />
                <Input
                  value={config.particleColor}
                  onChange={(e) =>
                    updateConfig({ particleColor: e.target.value })
                  }
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Backdrop effects */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Backdrop
        </h4>

        <div className="space-y-2">
          <Label className="text-xs">Reflection</Label>
          <Select
            value={config.reflection}
            onValueChange={(v) =>
              v && updateConfig({
                reflection: v as "none" | "2-way" | "4-way",
              })
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="2-way">2-Way</SelectItem>
              <SelectItem value="4-way">4-Way</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs">Filter</Label>
          <Switch
            checked={config.backgroundFilter}
            onCheckedChange={(v) => updateConfig({ backgroundFilter: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Drift</Label>
          <Switch
            checked={config.backgroundDrift}
            onCheckedChange={(v) => updateConfig({ backgroundDrift: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Rumble</Label>
          <Switch
            checked={config.backgroundRumble}
            onCheckedChange={(v) => updateConfig({ backgroundRumble: v })}
          />
        </div>
      </div>

      {/* Beat effects */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Beat Effects
        </h4>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Screen Shake</Label>
          <Switch
            checked={config.beatShake}
            onCheckedChange={(v) => updateConfig({ beatShake: v })}
          />
        </div>
        {config.beatShake && (
          <div className="space-y-2">
            <Label className="text-xs">
              Shake Intensity: {config.beatShakeIntensity.toFixed(1)}
            </Label>
            <Slider
              value={[config.beatShakeIntensity]}
              onValueChange={(v) => updateConfig({ beatShakeIntensity: Array.isArray(v) ? v[0] : v })}
              min={0.1}
              max={1.5}
              step={0.1}
            />
          </div>
        )}
        <div className="flex items-center justify-between">
          <Label className="text-xs">Beat Zoom</Label>
          <Switch
            checked={config.beatZoom}
            onCheckedChange={(v) => updateConfig({ beatZoom: v })}
          />
        </div>
        {config.beatZoom && (
          <div className="space-y-2">
            <Label className="text-xs">
              Zoom Intensity: {config.beatZoomIntensity.toFixed(1)}
            </Label>
            <Slider
              value={[config.beatZoomIntensity]}
              onValueChange={(v) => updateConfig({ beatZoomIntensity: Array.isArray(v) ? v[0] : v })}
              min={0.1}
              max={1.5}
              step={0.1}
            />
          </div>
        )}
      </div>

      {/* Visualizer tuning */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Visualizer
        </h4>
        <div className="space-y-2">
          <Label className="text-xs">
            Reactivity: {config.reactivity.toFixed(1)}
          </Label>
          <Slider
            value={[config.reactivity]}
            onValueChange={(v) => updateConfig({ reactivity: Array.isArray(v) ? v[0] : v })}
            min={0.1}
            max={3}
            step={0.1}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">
            Smoothing: {config.waveformSmoothing.toFixed(1)}
          </Label>
          <Slider
            value={[config.waveformSmoothing]}
            onValueChange={(v) => updateConfig({ waveformSmoothing: Array.isArray(v) ? v[0] : v })}
            min={0}
            max={1}
            step={0.05}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">
            Scale: {config.waveformScale.toFixed(1)}
          </Label>
          <Slider
            value={[config.waveformScale]}
            onValueChange={(v) => updateConfig({ waveformScale: Array.isArray(v) ? v[0] : v })}
            min={0.3}
            max={2}
            step={0.1}
          />
        </div>
      </div>
    </div>
  );
}
