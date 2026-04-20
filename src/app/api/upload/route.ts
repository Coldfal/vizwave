import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file type
  const allowedAudio = ["audio/mpeg", "audio/wav", "audio/flac", "audio/ogg", "audio/mp3"];
  const allowedImage = ["image/jpeg", "image/png", "image/webp"];
  const allowedVideo = ["video/mp4", "video/webm"];
  const allowed = [...allowedAudio, ...allowedImage, ...allowedVideo];

  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  // Size limits
  const maxSize = type === "audio" ? 300 * 1024 * 1024
    : allowedVideo.includes(file.type) ? 100 * 1024 * 1024
    : 10 * 1024 * 1024;

  if (file.size > maxSize) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  // Generate unique filename
  const ext = file.name.split(".").pop() || "bin";
  const filename = `${session.user.id}-${Date.now()}.${ext}`;
  const uploadDir = join(process.cwd(), "public", "uploads");

  await mkdir(uploadDir, { recursive: true });
  const filePath = join(uploadDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return NextResponse.json({ url: `/uploads/${filename}` });
}
