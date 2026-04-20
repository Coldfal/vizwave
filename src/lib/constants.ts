export const APP_NAME = "VizWave";
export const APP_DESCRIPTION = "Create stunning audio-reactive music visualizer videos for YouTube, Instagram, and TikTok.";

export const SUPPORTED_AUDIO_FORMATS = [
  "audio/mpeg",       // MP3
  "audio/wav",        // WAV
  "audio/x-wav",
  "audio/flac",       // FLAC
  "audio/ogg",        // OGG
  "audio/aac",        // AAC
  "audio/mp4",        // M4A
];

export const SUPPORTED_IMAGE_FORMATS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const MAX_AUDIO_SIZE = 300 * 1024 * 1024; // 300MB — enough for a 1hr track at any reasonable bitrate
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB

export const EXPORT_RESOLUTIONS = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "2160p": { width: 3840, height: 2160 },
} as const;

export const PRESET_CATEGORIES = [
  { value: "waveform", label: "Waveform" },
  { value: "particles", label: "Particles" },
  { value: "3d", label: "3D" },
  { value: "minimal", label: "Minimal" },
  { value: "retro", label: "Retro" },
] as const;
