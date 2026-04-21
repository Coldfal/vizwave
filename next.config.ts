import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native-binary and node-heavy packages out of the bundler so
  // Turbopack doesn't choke on their dynamic `require()` calls.
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "@ffmpeg-installer/darwin-arm64",
    "@ffmpeg-installer/darwin-x64",
    "@ffmpeg-installer/linux-arm",
    "@ffmpeg-installer/linux-arm64",
    "@ffmpeg-installer/linux-ia32",
    "@ffmpeg-installer/linux-x64",
    "@ffmpeg-installer/win32-ia32",
    "@ffmpeg-installer/win32-x64",
    "@napi-rs/canvas",
    "fft.js",
  ],
};

export default nextConfig;
