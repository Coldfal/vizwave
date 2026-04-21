"use client";

import { useRef, useState } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { Upload, Music, X, Loader2, GripVertical } from "lucide-react";
import { SUPPORTED_AUDIO_FORMATS, MAX_AUDIO_SIZE } from "@/lib/constants";
import { toast } from "sonner";
import type { AudioTrack } from "@/lib/types";

function formatTime(seconds: number) {
  if (!isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function probeDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio(url);
    const done = (v: number) => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("error", onErr);
      resolve(v);
    };
    const onMeta = () => done(a.duration);
    const onErr = () => done(0);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("error", onErr);
  });
}

export function AudioPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const audioTracks = useEditorStore((s) => s.audioTracks);
  const audioDuration = useEditorStore((s) => s.audioDuration);
  const addAudioTracks = useEditorStore((s) => s.addAudioTracks);
  const removeAudioTrack = useEditorStore((s) => s.removeAudioTrack);
  const setAudioTracks = useEditorStore((s) => s.setAudioTracks);
  const [uploading, setUploading] = useState(0);
  const dragIndex = useRef<number | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    // Pre-validate
    const rejected: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      if (!SUPPORTED_AUDIO_FORMATS.includes(file.type)) {
        rejected.push(`${file.name} (unsupported format)`);
        continue;
      }
      if (file.size > MAX_AUDIO_SIZE) {
        rejected.push(`${file.name} (over 300MB)`);
        continue;
      }
      accepted.push(file);
    }
    if (rejected.length > 0) {
      toast.error(`Skipped: ${rejected.join(", ")}`);
    }
    if (accepted.length === 0) return;

    setUploading(accepted.length);
    const uploaded: AudioTrack[] = [];
    try {
      for (const file of accepted) {
        const blobUrl = URL.createObjectURL(file);
        const duration = await probeDuration(blobUrl);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "audio");
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));
        URL.revokeObjectURL(blobUrl);
        if (!res.ok || !data.url) {
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }
        uploaded.push({ url: data.url, name: file.name, duration });
      }
      if (uploaded.length > 0) {
        addAudioTracks(uploaded);
        toast.success(
          uploaded.length === 1
            ? `Added "${uploaded[0].name}"`
            : `Added ${uploaded.length} tracks`,
        );
      }
    } finally {
      setUploading(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function clearAll() {
    setAudioTracks([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDragStart(i: number) {
    dragIndex.current = i;
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function onDrop(i: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === i) return;
    const next = [...audioTracks];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    setAudioTracks(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Audio</h3>
        {audioTracks.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {audioTracks.length} track{audioTracks.length > 1 ? "s" : ""} · {formatTime(audioDuration)} total
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {audioTracks.length === 0 ? (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading > 0}
          className="flex w-full flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border/50 p-8 transition-colors hover:border-primary/50 hover:bg-muted/30 disabled:opacity-50"
        >
          {uploading > 0 ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
          <div className="text-center">
            <p className="text-sm font-medium">
              {uploading > 0 ? `Uploading ${uploading}…` : "Upload audio files"}
            </p>
            <p className="text-xs text-muted-foreground">
              MP3, WAV, FLAC, OGG · up to 300MB each · select multiple to build a playlist
            </p>
          </div>
        </button>
      ) : (
        <div className="space-y-1.5">
          {audioTracks.map((track, i) => (
            <div
              key={`${track.url}-${i}`}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={onDragOver}
              onDrop={() => onDrop(i)}
              className="group flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 p-2"
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/60 active:cursor-grabbing" />
              <span className="w-5 shrink-0 text-center text-[10px] font-mono text-muted-foreground/80">
                {i + 1}
              </span>
              <Music className="h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{track.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatTime(track.duration)}
                </p>
              </div>
              <button
                onClick={() => removeAudioTrack(i)}
                className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                aria-label="Remove track"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => inputRef.current?.click()}
          disabled={uploading > 0}
        >
          {uploading > 0 ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Uploading {uploading}…
            </>
          ) : audioTracks.length === 0 ? (
            "Choose Files"
          ) : (
            "Add More"
          )}
        </Button>
        {audioTracks.length > 0 && (
          <Button
            variant="ghost"
            onClick={clearAll}
            disabled={uploading > 0}
          >
            Clear All
          </Button>
        )}
      </div>
    </div>
  );
}
