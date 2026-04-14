"use client";

import { useRef } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Upload, Image as ImageIcon, X } from "lucide-react";
import { SUPPORTED_IMAGE_FORMATS, MAX_IMAGE_SIZE } from "@/lib/constants";
import { toast } from "sonner";

export function ImagesPanel() {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const config = useEditorStore((s) => s.config);
  const updateConfig = useEditorStore((s) => s.updateConfig);
  const project = useEditorStore((s) => s.project);

  function handleImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "background"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!SUPPORTED_IMAGE_FORMATS.includes(file.type)) {
      toast.error("Unsupported image format. Use JPEG, PNG, or WebP.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Image too large. Maximum 10MB.");
      return;
    }

    // For now, create a local URL. In production, this uploads to Azure Blob.
    const url = URL.createObjectURL(file);
    if (type === "logo") {
      useEditorStore.setState((s) => ({
        project: s.project ? { ...s.project, logoUrl: url } : null,
      }));
    } else {
      useEditorStore.setState((s) => ({
        project: s.project ? { ...s.project, backgroundUrl: url } : null,
      }));
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold">Images</h3>

      {/* Logo */}
      <div className="space-y-3">
        <Label>Logo</Label>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleImageUpload(e, "logo")}
        />
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
            max={50}
            step={1}
          />
        </div>
      </div>

      {/* Background */}
      <div className="space-y-3">
        <Label>Background</Label>
        <input
          ref={bgInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleImageUpload(e, "background")}
        />
        {project?.backgroundUrl ? (
          <div className="relative">
            <img
              src={project.backgroundUrl}
              alt="Background"
              className="h-20 w-full rounded-lg border border-border/50 object-cover"
            />
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
            <ImageIcon className="mr-2 h-4 w-4" />
            Upload Background
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
    </div>
  );
}
