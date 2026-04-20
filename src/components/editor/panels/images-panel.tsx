"use client";

import { useRef } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Image as ImageIcon, Film, X } from "lucide-react";
import { SUPPORTED_IMAGE_FORMATS, MAX_IMAGE_SIZE } from "@/lib/constants";
import { toast } from "sonner";

const SUPPORTED_VIDEO_FORMATS = ["video/mp4", "video/webm"];
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

export function ImagesPanel() {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);
  const config = useEditorStore((s) => s.config);
  const updateConfig = useEditorStore((s) => s.updateConfig);
  const project = useEditorStore((s) => s.project);

  function handleImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "background" | "overlay"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === "background" && config.backgroundType === "video") {
      if (!SUPPORTED_VIDEO_FORMATS.includes(file.type)) {
        toast.error("Unsupported video format. Use MP4 or WebM.");
        return;
      }
      if (file.size > MAX_VIDEO_SIZE) {
        toast.error("Video too large. Maximum 100MB.");
        return;
      }
    } else {
      if (!SUPPORTED_IMAGE_FORMATS.includes(file.type)) {
        toast.error("Unsupported image format. Use JPEG, PNG, or WebP.");
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error("Image too large. Maximum 10MB.");
        return;
      }
    }

    const field = type === "logo" ? "logoUrl" : type === "overlay" ? "overlayUrl" : "backgroundUrl";

    // Show immediate preview with blob URL
    const blobUrl = URL.createObjectURL(file);
    useEditorStore.setState((s) => ({
      project: s.project ? { ...s.project, [field]: blobUrl } : null,
    }));

    // Upload to server for persistence
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    fetch("/api/upload", { method: "POST", body: formData })
      .then((r) => r.json())
      .then((data) => {
        if (data.url) {
          useEditorStore.setState((s) => ({
            project: s.project ? { ...s.project, [field]: data.url } : null,
            isDirty: true,
          }));
        }
      })
      .catch(() => {
        // Keep blob URL for this session
        useEditorStore.setState({ isDirty: true });
      });
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold">Images</h3>

      {/* Logo */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Center Logo</Label>
          <Switch
            checked={config.logoEnabled}
            onCheckedChange={(v) => updateConfig({ logoEnabled: v })}
          />
        </div>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleImageUpload(e, "logo")}
        />
        {config.logoEnabled && (
          <>
            {project?.logoUrl ? (
              <div className="relative">
                <img
                  src={project.logoUrl}
                  alt="Logo"
                  className="h-20 w-20 rounded-lg border border-border/50 object-cover"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-destructive/80"
                  onClick={() =>
                    useEditorStore.setState((s) => ({
                      project: s.project ? { ...s.project, logoUrl: null } : null,
                      isDirty: true,
                    }))
                  }
                >
                  <X className="h-3 w-3 text-white" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => logoInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Logo
              </Button>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Logo Scale</Label>
              <Slider
                value={[config.logoScale]}
                onValueChange={(v) => updateConfig({ logoScale: Array.isArray(v) ? v[0] : v })}
                min={0.3}
                max={2}
                step={0.1}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Border Radius</Label>
              <Slider
                value={[config.logoBorderRadius]}
                onValueChange={(v) => updateConfig({ logoBorderRadius: Array.isArray(v) ? v[0] : v })}
                min={0}
                max={100}
                step={1}
              />
            </div>
          </>
        )}
      </div>

      {/* Background */}
      <div className="space-y-3">
        <Label>Background</Label>

        <div className="space-y-2">
          <Label className="text-xs">Type</Label>
          <Select
            value={config.backgroundType}
            onValueChange={(v) => {
              if (v) {
                updateConfig({ backgroundType: v as "image" | "video" });
                // Clear background when switching type
                useEditorStore.setState((s) => ({
                  project: s.project ? { ...s.project, backgroundUrl: null } : null,
                  isDirty: true,
                }));
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="video">Video (loops)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <input
          ref={bgInputRef}
          type="file"
          accept={config.backgroundType === "video" ? "video/mp4,video/webm" : "image/*"}
          className="hidden"
          onChange={(e) => handleImageUpload(e, "background")}
        />
        {project?.backgroundUrl ? (
          <div className="relative">
            {config.backgroundType === "video" ? (
              <video
                src={project.backgroundUrl}
                className="h-20 w-full rounded-lg border border-border/50 object-cover"
                muted
                loop
                autoPlay
                playsInline
              />
            ) : (
              <img
                src={project.backgroundUrl}
                alt="Background"
                className="h-20 w-full rounded-lg border border-border/50 object-cover"
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-destructive/80"
              onClick={() =>
                useEditorStore.setState((s) => ({
                  project: s.project
                    ? { ...s.project, backgroundUrl: null }
                    : null,
                }))
              }
            >
              <X className="h-3 w-3 text-white" />
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => bgInputRef.current?.click()}
          >
            {config.backgroundType === "video" ? (
              <Film className="mr-2 h-4 w-4" />
            ) : (
              <ImageIcon className="mr-2 h-4 w-4" />
            )}
            Upload {config.backgroundType === "video" ? "Video" : "Background"}
          </Button>
        )}

        <div className="space-y-2">
          <Label className="text-xs">Background Blur</Label>
          <Slider
            value={[config.backgroundBlur]}
            onValueChange={(v) => updateConfig({ backgroundBlur: Array.isArray(v) ? v[0] : v })}
            min={0}
            max={20}
            step={1}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Background Darken</Label>
          <Slider
            value={[config.backgroundDarken]}
            onValueChange={(v) => updateConfig({ backgroundDarken: Array.isArray(v) ? v[0] : v })}
            min={0}
            max={1}
            step={0.05}
          />
        </div>
      </div>

      {/* Corner Overlay */}
      <div className="space-y-3">
        <Label>Corner Overlay</Label>
        <p className="text-xs text-muted-foreground">
          Add a logo, subscribe CTA, or watermark on top of the video.
        </p>

        <input
          ref={overlayInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleImageUpload(e, "overlay")}
        />
        {project?.overlayUrl ? (
          <div className="relative">
            <img
              src={project.overlayUrl}
              alt="Overlay"
              className="h-16 w-16 rounded-lg border border-border/50 object-contain bg-black/50"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-destructive/80"
              onClick={() => {
                useEditorStore.setState((s) => ({
                  project: s.project ? { ...s.project, overlayUrl: null } : null,
                  isDirty: true,
                }));
                updateConfig({ overlayEnabled: false });
              }}
            >
              <X className="h-3 w-3 text-white" />
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              overlayInputRef.current?.click();
              updateConfig({ overlayEnabled: true });
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Overlay
          </Button>
        )}

        {project?.overlayUrl && (
          <>
            <div className="space-y-2">
              <Label className="text-xs">Position</Label>
              <Select
                value={config.overlayPosition}
                onValueChange={(v) => v && updateConfig({ overlayPosition: v as typeof config.overlayPosition })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top-left">Top Left</SelectItem>
                  <SelectItem value="top-right">Top Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Scale</Label>
              <Slider
                value={[config.overlayScale]}
                onValueChange={(v) => updateConfig({ overlayScale: Array.isArray(v) ? v[0] : v })}
                min={0.2}
                max={3}
                step={0.05}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Opacity</Label>
              <Slider
                value={[config.overlayOpacity]}
                onValueChange={(v) => updateConfig({ overlayOpacity: Array.isArray(v) ? v[0] : v })}
                min={0.1}
                max={1}
                step={0.05}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Offset X</Label>
              <Slider
                value={[config.overlayOffsetX]}
                onValueChange={(v) => updateConfig({ overlayOffsetX: Array.isArray(v) ? v[0] : v })}
                min={-50}
                max={50}
                step={1}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Offset Y</Label>
              <Slider
                value={[config.overlayOffsetY]}
                onValueChange={(v) => updateConfig({ overlayOffsetY: Array.isArray(v) ? v[0] : v })}
                min={-50}
                max={50}
                step={1}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
