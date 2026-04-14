"use client";

import { useRef } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack } from "lucide-react";

export function PlaybackControls() {
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const currentTime = useEditorStore((s) => s.currentTime);
  const audioDuration = useEditorStore((s) => s.audioDuration);
  const audioUrl = useEditorStore((s) => s.audioUrl);
  const barRef = useRef<HTMLDivElement>(null);

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    if (!barRef.current || audioDuration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekTime = ratio * audioDuration;
    useEditorStore.setState({ currentTime: seekTime, seekTo: seekTime });
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
            useEditorStore.setState({ currentTime: 0, seekTo: 0 });
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
        <div
          ref={barRef}
          className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-muted"
          onClick={seek}
          onMouseDown={(e) => {
            seek(e);
            const onMove = (ev: MouseEvent) => {
              if (!barRef.current || audioDuration <= 0) return;
              const rect = barRef.current.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
              const seekTime = ratio * audioDuration;
              useEditorStore.setState({ currentTime: seekTime, seekTo: seekTime });
            };
            const onUp = () => {
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary shadow-sm"
            style={{ left: `${progress}%`, marginLeft: "-6px" }}
          />
        </div>
        <span className="w-10 text-xs tabular-nums text-muted-foreground">
          {formatTime(audioDuration)}
        </span>
      </div>
    </div>
  );
}
