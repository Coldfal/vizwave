"use client";

import { useEditorStore } from "@/stores/editor-store";
import { cn } from "@/lib/utils";
import {
  Music,
  AudioWaveform,
  Image,
  Type,
  Palette,
  Sparkles,
  Download,
} from "lucide-react";
import { PresetPanel } from "./panels/preset-panel";
import { AudioPanel } from "./panels/audio-panel";
import { ImagesPanel } from "./panels/images-panel";
import { TextPanel } from "./panels/text-panel";
import { ColorsPanel } from "./panels/colors-panel";
import { ElementsPanel } from "./panels/elements-panel";
import { ExportPanel } from "./panels/export-panel";

const panels = [
  { id: "preset", label: "Preset", icon: Music },
  { id: "audio", label: "Audio", icon: AudioWaveform },
  { id: "images", label: "Images", icon: Image },
  { id: "text", label: "Text", icon: Type },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "elements", label: "Elements", icon: Sparkles },
  { id: "export", label: "Export", icon: Download },
] as const;

const panelComponents: Record<string, React.ComponentType> = {
  preset: PresetPanel,
  audio: AudioPanel,
  images: ImagesPanel,
  text: TextPanel,
  colors: ColorsPanel,
  elements: ElementsPanel,
  export: ExportPanel,
};

export function EditorSidebar() {
  const activePanel = useEditorStore((s) => s.activePanel);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
  const ActivePanelComponent = panelComponents[activePanel];

  return (
    <div className="flex h-full">
      {/* Icon tabs */}
      <div className="flex w-16 flex-col items-center gap-1 border-r border-border/50 bg-card/30 py-2">
        {panels.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActivePanel(id)}
            className={cn(
              "flex w-14 flex-col items-center gap-0.5 rounded-md p-2 text-xs transition-colors",
              activePanel === id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px]">{label}</span>
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="w-72 overflow-y-auto border-r border-border/50 bg-card/20 p-4">
        {ActivePanelComponent && <ActivePanelComponent />}
      </div>
    </div>
  );
}
