"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Music, Play, Trash2, Loader2 } from "lucide-react";
import type { Project } from "@/lib/db/schema";
import { useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  rendering: "bg-yellow-500/20 text-yellow-400",
  done: "bg-green-500/20 text-green-400",
  failed: "bg-destructive/20 text-destructive",
};

export function ProjectGrid({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function createProject() {
    setCreating(true);
    try {
      const res = await fetch("/api/projects", { method: "POST" });
      const data = await res.json();
      if (data.id) {
        router.push(`/editor/${data.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  async function deleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this project?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {/* Create new project card */}
      <Card
        className="group cursor-pointer border-dashed border-border/50 transition-colors hover:border-primary/50 hover:bg-card/80"
        onClick={createProject}
      >
        <CardContent className="flex h-48 flex-col items-center justify-center gap-3">
          {creating ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                Create New Video
              </span>
            </>
          )}
        </CardContent>
      </Card>

      {/* Existing projects */}
      {projects.map((project) => {
        const config = JSON.parse(project.config || "{}");
        return (
          <Card
            key={project.id}
            className="group cursor-pointer border-border/30 transition-all hover:border-border/60 hover:shadow-lg hover:shadow-primary/5"
            onClick={() => router.push(`/editor/${project.id}`)}
          >
            <CardContent className="relative flex h-48 flex-col justify-between p-4">
              {/* Preview placeholder */}
              <div
                className="absolute inset-0 rounded-[inherit] opacity-30"
                style={{ backgroundColor: config.backgroundColor || "#0f0f1a" }}
              />
              <div className="relative z-10 flex items-start justify-between">
                <Badge
                  variant="secondary"
                  className={STATUS_COLORS[project.status] || ""}
                >
                  {project.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => deleteProject(project.id, e)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-muted-foreground" />
                  <h3 className="truncate text-sm font-medium">
                    {project.name}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {config.artistName || "No artist"} —{" "}
                  {config.trackName || "No track"}
                </p>
                {project.status === "done" && project.outputUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-7 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(project.outputUrl!, "_blank");
                    }}
                  >
                    <Play className="mr-1 h-3 w-3" />
                    Watch
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {projects.length === 0 && (
        <div className="col-span-full py-12 text-center text-muted-foreground sm:col-start-2">
          <Music className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p>No videos yet. Create your first one!</p>
        </div>
      )}
    </div>
  );
}
