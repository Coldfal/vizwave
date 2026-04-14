"use client";

import { useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack } from "lucide-react";

export function PlaybackControls() {
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const currentTime = useEditorStore((s) => s.currentTime);
  const audioDuration = useEditorStore((s) => s.audioDuration);
  const audioUrl = useEditorStore((s) => s.audioUrl);

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-4 border-t border-border/50 bg-card/30 px-4 py-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!audioUrl}
          onClick={() => {
            useEditorStore.setState({ currentTime: 0 });
          }}
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          disabled={!audioUrl}
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </Button>
      </div>

      <div className="flex flex-1 items-center gap-3">
        <span className="w-10 text-xs tabular-nums text-muted-foreground">
          {formatTime(currentTime)}
        </span>
        <div className="relative h-1.5 flex-1 rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="w-10 text-xs tabular-nums text-muted-foreground">
          {formatTime(audioDuration)}
        </span>
      </div>
    </div>
  );
}
