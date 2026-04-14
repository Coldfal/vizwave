import { create } from "zustand";
import type { ProjectConfig } from "@/lib/types";
import { DEFAULT_PROJECT_CONFIG } from "@/lib/types";
import type { Project } from "@/lib/db/schema";

interface EditorState {
  // Project data
  project: Project | null;
  config: ProjectConfig;
  isDirty: boolean;

  // Audio
  audioFile: File | null;
  audioUrl: string | null;
  audioDuration: number;
  isPlaying: boolean;
  currentTime: number;
  seekTo: number | null; // set to a time to trigger a seek

  // UI state
  activePanel: string;
  previewQuality: "240p" | "360p" | "480p" | "720p";

  // Actions
  setProject: (project: Project) => void;
  updateConfig: (partial: Partial<ProjectConfig>) => void;
  setAudioFile: (file: File | null, url: string | null) => void;
  setAudioDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setActivePanel: (panel: string) => void;
  setPreviewQuality: (quality: EditorState["previewQuality"]) => void;
  resetDirty: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  project: null,
  config: DEFAULT_PROJECT_CONFIG,
  isDirty: false,

  audioFile: null,
  audioUrl: null,
  audioDuration: 0,
  isPlaying: false,
  currentTime: 0,
  seekTo: null,

  activePanel: "preset",
  previewQuality: "480p",

  setProject: (project) =>
    set({
      project,
      config: project.config
        ? { ...DEFAULT_PROJECT_CONFIG, ...JSON.parse(project.config) }
        : DEFAULT_PROJECT_CONFIG,
      audioUrl: project.audioUrl,
      audioDuration: project.audioDuration || 0,
      isDirty: false,
    }),

  updateConfig: (partial) =>
    set((state) => ({
      config: { ...state.config, ...partial },
      isDirty: true,
    })),

  setAudioFile: (file, url) => set({ audioFile: file, audioUrl: url }),
  setAudioDuration: (duration) => set({ audioDuration: duration }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setPreviewQuality: (quality) => set({ previewQuality: quality }),
  resetDirty: () => set({ isDirty: false }),
}));
