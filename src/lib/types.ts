export interface CustomText {
  id: string;
  text: string;
  x: number; // 0-1 fraction of canvas width (center of text)
  y: number; // 0-1 fraction of canvas height (baseline)
  size: number; // px at 1920 width
  color: string;
  weight: "normal" | "bold" | "black";
  align: "left" | "center" | "right";
}

export interface ProjectConfig {
  // Visualizer
  waveformScale: number;
  waveformSmoothing: number;
  reactivity: number;
  spectrumFill: "filled" | "outline";

  // Linear layout (linear-bars, linear-dots)
  linearPosition: "center" | "bottom";
  linearRepeat: number; // 1-10, horizontal repetitions
  linearBarColor: string; // dedicated color for linear bars/dots (overrides waveColor1)
  linearYOffset: number; // -0.4 to 0.4, fraction of H — fine-tune vertical position
  linearWidth: number; // 0.3 to 1.0, fraction of W — how wide the bars span
  linearCenterTextSource: "none" | "custom" | "artist" | "track";
  linearCenterText: string; // used when source = "custom"
  linearCenterTextSize: number; // px at 1920 width
  linearCenterTextOffsetY: number; // -0.5 .. 0.5, fraction of maxBarH, negative = up

  // Custom draggable text overlays
  customTexts: CustomText[];

  // Colors
  waveColor1: string;
  waveColor2: string;
  backgroundColor: string;
  accentColor: string;

  // Text
  artistName: string;
  trackName: string;
  fontFamily: string;
  fontSize: number;
  textPosition: "top" | "bottom" | "center";
  textColor: string;

  // Backdrop
  backgroundFit: "cover" | "contain" | "fill";
  reflection: "none" | "2-way" | "4-way";
  backgroundRotate: number;
  backgroundFilter: boolean;
  backgroundDrift: boolean;
  backgroundRumble: boolean;
  backgroundBlur: number;
  backgroundDarken: number;

  // Elements
  particles: boolean;
  particleStyle: "floating" | "snow" | "fireflies" | "rain" | "stars" | "smoke";
  particleDensity: number;
  particleColor: string;

  // Logo
  logoEnabled: boolean; // show the center logo / glow / placeholder circle
  logoScale: number;
  logoBorderRadius: number;

  // Overlay (corner image/logo/CTA)
  overlayEnabled: boolean;
  overlayPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  overlayScale: number;
  overlayOpacity: number;
  overlayOffsetX: number; // -50 to 50, percentage of canvas width
  overlayOffsetY: number; // -50 to 50, percentage of canvas height

  // Background type
  backgroundType: "image" | "video";

  // Beat effects
  beatShake: boolean;
  beatZoom: boolean;
  beatShakeIntensity: number;
  beatZoomIntensity: number;
}

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  waveformScale: 1.0,
  waveformSmoothing: 0.7,
  reactivity: 1.0,
  spectrumFill: "filled",

  linearPosition: "center",
  linearRepeat: 1,
  linearBarColor: "#ff4444",
  linearYOffset: 0,
  linearWidth: 0.98,
  linearCenterTextSource: "none",
  linearCenterText: "",
  linearCenterTextSize: 140,
  linearCenterTextOffsetY: 0,

  customTexts: [],

  waveColor1: "#ffffff",
  waveColor2: "#a855f7",
  backgroundColor: "#0f0f1a",
  accentColor: "#ec4899",

  artistName: "Artist Name",
  trackName: "Track Name",
  fontFamily: "Geist",
  fontSize: 32,
  textPosition: "bottom",
  textColor: "#ffffff",

  backgroundFit: "cover",
  reflection: "none",
  backgroundRotate: 0,
  backgroundFilter: false,
  backgroundDrift: false,
  backgroundRumble: false,
  backgroundBlur: 20,
  backgroundDarken: 0.7,

  particles: true,
  particleStyle: "floating",
  particleDensity: 50,
  particleColor: "#ffffff",

  logoEnabled: true,
  logoScale: 1.0,
  logoBorderRadius: 50,

  overlayEnabled: false,
  overlayPosition: "bottom-right",
  overlayScale: 0.5,
  overlayOpacity: 0.8,
  overlayOffsetX: 0,
  overlayOffsetY: 0,

  backgroundType: "image",

  beatShake: true,
  beatZoom: true,
  beatShakeIntensity: 0.6,
  beatZoomIntensity: 0.5,
};

export interface AudioWaveformData {
  sampleRate: number;
  duration: number;
  fps: number;
  frameCount: number;
  amplitude: number[];    // 0-1 per frame
  bass: number[];         // 0-1 per frame (20-250Hz)
  mid: number[];          // 0-1 per frame (250-2kHz)
  treble: number[];       // 0-1 per frame (2-16kHz)
  beats: number[];        // frame indices of detected beats
  spectrum: number[][];   // per-frame: array of ~64 frequency bins, 0-1
}
