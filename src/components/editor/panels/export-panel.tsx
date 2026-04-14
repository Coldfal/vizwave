"use client";

import { useState } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

export function ExportPanel() {
  const project = useEditorStore((s) => s.project);
  const audioUrl = useEditorStore((s) => s.audioUrl);
  const [exporting, setExporting] = useState(false);
  const [resolution, setResolution] = useState("1080p");

  async function handleExport() {
    if (!project) return;
    if (!audioUrl) {
      toast.error("Upload an audio file first.");
      return;
    }

    setExporting(true);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          resolution,
        }),
      });

      if (!res.ok) {
        let msg = "Export failed";
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch {
          // response wasn't JSON
        }
        toast.error(msg);
        return;
      }

      const data = await res.json();
      toast.success("Export started! Redirecting to render page...");
      window.location.href = `/render/${data.jobId}`;
    } catch (err) {
      toast.error("Export service is not available yet. Coming soon!");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Export</h3>

      <div className="space-y-2">
        <Label>Resolution</Label>
        <Select value={resolution} onValueChange={(v) => v && setResolution(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="720p">
              720p (1280x720)
              <Badge variant="secondary" className="ml-2 text-[9px]">
                Free
              </Badge>
            </SelectItem>
            <SelectItem value="1080p">
              1080p (1920x1080)
              <Badge variant="secondary" className="ml-2 text-[9px]">
                Pro
              </Badge>
            </SelectItem>
            <SelectItem value="2160p">
              4K (3840x2160)
              <Badge variant="secondary" className="ml-2 text-[9px]">
                Enterprise
              </Badge>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border/30 bg-muted/20 p-3 text-xs text-muted-foreground">
        <p>Your video will be rendered in the cloud and ready for download.</p>
        <p className="mt-1">Typical render time: 2-10 minutes.</p>
      </div>

      <Button
        className="w-full"
        onClick={handleExport}
        disabled={exporting || !audioUrl}
      >
        {exporting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Export Video
      </Button>
    </div>
  );
}
