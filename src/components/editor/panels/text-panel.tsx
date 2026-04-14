"use client";

import { useEditorStore } from "@/stores/editor-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TextPanel() {
  const config = useEditorStore((s) => s.config);
  const updateConfig = useEditorStore((s) => s.updateConfig);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Text</h3>

      <div className="space-y-2">
        <Label htmlFor="artistName">Artist Name</Label>
        <Input
          id="artistName"
          value={config.artistName}
          onChange={(e) => updateConfig({ artistName: e.target.value })}
          placeholder="Artist Name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="trackName">Track Name</Label>
        <Input
          id="trackName"
          value={config.trackName}
          onChange={(e) => updateConfig({ trackName: e.target.value })}
          placeholder="Track Name"
        />
      </div>

      <div className="space-y-2">
        <Label>Text Position</Label>
        <Select
          value={config.textPosition}
          onValueChange={(v) =>
            v && updateConfig({ textPosition: v as "top" | "bottom" | "center" })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="top">Top</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="bottom">Bottom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Font Size: {config.fontSize}px</Label>
        <Slider
          value={[config.fontSize]}
          onValueChange={(v) => updateConfig({ fontSize: Array.isArray(v) ? v[0] : v })}
          min={12}
          max={72}
          step={1}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="textColor">Text Color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            id="textColor"
            value={config.textColor}
            onChange={(e) => updateConfig({ textColor: e.target.value })}
            className="h-8 w-8 cursor-pointer rounded border border-border/50 bg-transparent"
          />
          <Input
            value={config.textColor}
            onChange={(e) => updateConfig({ textColor: e.target.value })}
            className="font-mono text-xs"
          />
        </div>
      </div>
    </div>
  );
}
