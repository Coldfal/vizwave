import { create } from "zustand";
import type { AudioTrack, ProjectConfig } from "@/lib/types";
import { DEFAULT_PROJECT_CONFIG } from "@/lib/types";
import type { Project } from "@/lib/db/schema";

interface EditorState {
  // Project data
  project: Project | null;
  config: ProjectConfig;
  isDirty: boolean;

  // Audio
  audioFile: File | null;
  audioTracks: AudioTrack[];
  currentTrackIndex: number;
  /** URL of the currently-playing track (derived from audioTracks[currentTrackIndex]). */
  audioUrl: string | null;
  /** Combined duration across all tracks. */
  audioDuration: number;
  isPlaying: boolean;
  /** Time elapsed within the current track. */
  currentTime: number;
  seekTo: number | null; // set to a time to trigger a seek (within current track)

  // UI state
  activePanel: string;
  previewQuality: "240p" | "360p" | "480p" | "720p";

  // Actions
  setProject: (project: Project) => void;
  updateConfig: (partial: Partial<ProjectConfig>) => void;
  setAudioFile: (file: File | null, url: string | null) => void;
  setAudioTracks: (tracks: AudioTrack[]) => void;
  addAudioTracks: (tracks: AudioTrack[]) => void;
  removeAudioTrack: (index: number) => void;
  setCurrentTrackIndex: (i: number) => void;
  setAudioDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setActivePanel: (panel: string) => void;
  setPreviewQuality: (quality: EditorState["previewQuality"]) => void;
  resetDirty: () => void;
}

function parseTracks(project: Project): AudioTrack[] {
  if (project.audioTracks) {
    try {
      const arr = JSON.parse(project.audioTracks) as AudioTrack[];
      if (Array.isArray(arr)) return arr;
    } catch {
      /* fall through */
    }
  }
  // Legacy single-track projects: synthesise a one-entry list.
  if (project.audioUrl) {
    return [{
      url: project.audioUrl,
      name: project.audioUrl.split("/").pop() || "Track",
      duration: project.audioDuration || 0,
    }];
  }
  return [];
}

function totalDuration(tracks: AudioTrack[]): number {
  return tracks.reduce((s, t) => s + (t.duration || 0), 0);
}

export const useEditorStore = create<EditorState>((set) => ({
  project: null,
  config: DEFAULT_PROJECT_CONFIG,
  isDirty: false,

  audioFile: null,
  audioTracks: [],
  currentTrackIndex: 0,
  audioUrl: null,
  audioDuration: 0,
  isPlaying: false,
  currentTime: 0,
  seekTo: null,

  activePanel: "preset",
  previewQuality: "480p",

  setProject: (project) => {
    const tracks = parseTracks(project);
    return set({
      project,
      config: project.config
        ? { ...DEFAULT_PROJECT_CONFIG, ...JSON.parse(project.config) }
        : DEFAULT_PROJECT_CONFIG,
      audioTracks: tracks,
      currentTrackIndex: 0,
      audioUrl: tracks[0]?.url ?? null,
      audioDuration: totalDuration(tracks),
      currentTime: 0,
      isDirty: false,
    });
  },

  updateConfig: (partial) =>
    set((state) => ({
      config: { ...state.config, ...partial },
      isDirty: true,
    })),

  // Legacy single-file path — replaces the whole list with one track.
  setAudioFile: (file, url) =>
    set((state) => {
      const tracks: AudioTrack[] = url
        ? [{ url, name: file?.name ?? url.split("/").pop() ?? "Track", duration: 0 }]
        : [];
      return {
        audioFile: file,
        audioTracks: tracks,
        currentTrackIndex: 0,
        audioUrl: tracks[0]?.url ?? null,
        audioDuration: totalDuration(tracks),
        currentTime: 0,
        isDirty: true,
        project: state.project
          ? { ...state.project, audioUrl: tracks[0]?.url ?? null, audioDuration: 0 }
          : state.project,
      };
    }),

  setAudioTracks: (tracks) =>
    set((state) => ({
      audioTracks: tracks,
      currentTrackIndex: 0,
      audioUrl: tracks[0]?.url ?? null,
      audioDuration: totalDuration(tracks),
      currentTime: 0,
      isDirty: true,
      project: state.project
        ? {
            ...state.project,
            audioUrl: tracks[0]?.url ?? null,
            audioDuration: totalDuration(tracks),
            audioTracks: JSON.stringify(tracks),
          }
        : state.project,
    })),

  addAudioTracks: (newTracks) =>
    set((state) => {
      const tracks = [...state.audioTracks, ...newTracks];
      return {
        audioTracks: tracks,
        audioUrl: tracks[0]?.url ?? null,
        audioDuration: totalDuration(tracks),
        isDirty: true,
        project: state.project
          ? {
              ...state.project,
              audioUrl: tracks[0]?.url ?? null,
              audioDuration: totalDuration(tracks),
              audioTracks: JSON.stringify(tracks),
            }
          : state.project,
      };
    }),

  removeAudioTrack: (index) =>
    set((state) => {
      const tracks = state.audioTracks.filter((_, i) => i !== index);
      const currentTrackIndex = Math.max(
        0,
        Math.min(state.currentTrackIndex, tracks.length - 1),
      );
      return {
        audioTracks: tracks,
        currentTrackIndex,
        audioUrl: tracks[currentTrackIndex]?.url ?? null,
        audioDuration: totalDuration(tracks),
        currentTime: 0,
        isPlaying: false,
        isDirty: true,
        project: state.project
          ? {
              ...state.project,
              audioUrl: tracks[0]?.url ?? null,
              audioDuration: totalDuration(tracks),
              audioTracks: JSON.stringify(tracks),
            }
          : state.project,
      };
    }),

  setCurrentTrackIndex: (i) =>
    set((state) => ({
      currentTrackIndex: Math.max(0, Math.min(i, state.audioTracks.length - 1)),
      audioUrl: state.audioTracks[i]?.url ?? null,
      currentTime: 0,
    })),

  setAudioDuration: (duration) =>
    set((state) => {
      // This is called by preview-canvas when the <audio> element reports its
      // metadata duration. If we haven't yet recorded a duration for the
      // currently-playing track, patch it in so totals converge.
      const tracks = [...state.audioTracks];
      const cur = tracks[state.currentTrackIndex];
      if (cur && (!cur.duration || cur.duration === 0)) {
        tracks[state.currentTrackIndex] = { ...cur, duration };
        return {
          audioTracks: tracks,
          audioDuration: totalDuration(tracks),
          isDirty: true,
          project: state.project
            ? {
                ...state.project,
                audioDuration: totalDuration(tracks),
                audioTracks: JSON.stringify(tracks),
              }
            : state.project,
        };
      }
      return {};
    }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setPreviewQuality: (quality) => set({ previewQuality: quality }),
  resetDirty: () => set({ isDirty: false }),
}));
