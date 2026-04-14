"use client";

import { useRef } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { Upload, Music, X } from "lucide-react";
import { SUPPORTED_AUDIO_FORMATS, MAX_AUDIO_SIZE } from "@/lib/constants";
import { toast } from "sonner";

export function AudioPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const audioUrl = useEditorStore((s) => s.audioUrl);
  const audioDuration = useEditorStore((s) => s.audioDuration);
  const setAudioFile = useEditorStore((s) => s.setAudioFile);
  const setAudioDuration = useEditorStore((s) => s.setAudioDuration);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!SUPPORTED_AUDIO_FORMATS.includes(file.type)) {
      toast.error("Unsupported audio format. Use MP3, WAV, FLAC, or OGG.");
      return;
    }

    if (file.size > MAX_AUDIO_SIZE) {
      toast.error("Audio file too large. Maximum 50MB.");
      return;
    }

    // Use blob URL for playback, upload to server for persistence
    const blobUrl = URL.createObjectURL(file);
    setAudioFile(file, blobUrl);

    // Upload audio file to server
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "audio");
    fetch("/api/upload", { method: "POST", body: formData })
      .then((r) => r.json())
      .then((data) => {
        if (data.url) {
          // Replace blob URL with persisted URL
          setAudioFile(file, data.url);
          useEditorStore.setState((s) => ({
            project: s.project ? { ...s.project, audioUrl: data.url } : null,
            isDirty: true,
          }));
        }
      })
      .catch(() => {
        // Fallback: keep blob URL for this session
        useEditorStore.setState((s) => ({
          project: s.project ? { ...s.project, audioUrl: blobUrl } : null,
          isDirty: true,
        }));
      });

    // Get duration
    const audio = new Audio(blobUrl);
    audio.addEventListener("loadedmetadata", () => {
      setAudioDuration(audio.duration);
      useEditorStore.setState((s) => ({
        project: s.project ? { ...s.project, audioDuration: audio.duration } : null,
      }));
    });
  }

  function clearAudio() {
    setAudioFile(null, null);
    setAudioDuration(0);
    useEditorStore.setState((s) => ({
      project: s.project ? { ...s.project, audioUrl: null, audioDuration: 0 } : null,
      isDirty: true,
    }));
    if (inputRef.current) inputRef.current.value = "";
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Audio</h3>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {!audioUrl ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border/50 p-8 transition-colors hover:border-primary/50 hover:bg-muted/30"
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">Upload audio file</p>
            <p className="text-xs text-muted-foreground">
              MP3, WAV, FLAC, OGG — up to 50MB
            </p>
          </div>
        </button>
      ) : (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Audio loaded</p>
                <p className="text-xs text-muted-foreground">
                  Duration: {formatTime(audioDuration)}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearAudio}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <Button
        variant="outline"
        className="w-full"
        onClick={() => inputRef.current?.click()}
        disabled={!audioUrl}
      >
        Replace Audio
      </Button>
    </div>
  );
}
