import { buttonVariants } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { HeroCanvas } from "@/components/landing/hero-canvas";
import { ArrowRight, Check } from "lucide-react";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-hidden">
        {/* ─── HERO ─── */}
        <section className="relative min-h-[85vh] flex items-center">
          {/* Animated visualizer background */}
          <HeroCanvas />

          <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
            {/* Copy — left side */}
            <div className="max-w-xl py-20 lg:py-0">
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.5rem]">
                Turn your music into a killer video
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                VizWave makes it fast and easy to create custom music
                visualizers. Upload a track, pick a style, customize everything,
                and export — all in your browser.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/auth/signin"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "gap-2 px-6 text-base"
                  )}
                >
                  Create a Video
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                >
                  See pricing
                </Link>
              </div>
              <p className="mt-4 text-xs text-muted-foreground/70">
                Free to try. No credit card. No download.
              </p>
            </div>

            {/* Editor preview — right side */}
            <div className="relative hidden lg:block">
              <div className="relative rounded-xl border border-white/[0.06] bg-[#111118] shadow-2xl shadow-primary/10 overflow-hidden">
                {/* Fake editor chrome */}
                <div className="flex h-9 items-center gap-2 border-b border-white/[0.06] bg-[#0c0c12] px-3">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                    <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                    <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  </div>
                  <span className="ml-2 text-[10px] text-white/30">
                    VizWave Editor
                  </span>
                </div>
                {/* Mock editor layout */}
                <div className="flex h-[380px]">
                  {/* Sidebar */}
                  <div className="w-14 shrink-0 border-r border-white/[0.06] bg-[#0e0e16] flex flex-col items-center gap-2 py-3">
                    {["Pr", "Au", "Bg", "Tx", "Co", "El"].map((l, i) => (
                      <div
                        key={l}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-md text-[10px] font-medium",
                          i === 0
                            ? "bg-primary/20 text-primary"
                            : "text-white/30"
                        )}
                      >
                        {l}
                      </div>
                    ))}
                  </div>
                  {/* Panel */}
                  <div className="w-44 shrink-0 border-r border-white/[0.06] bg-[#111118]/80 p-3 space-y-3">
                    <div className="text-[10px] font-semibold text-white/60">
                      Preset
                    </div>
                    {[
                      "Radial Waveform",
                      "Neon Ring",
                      "Particle Storm",
                      "3D Sphere",
                    ].map((name, i) => (
                      <div
                        key={name}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px]",
                          i === 0
                            ? "bg-primary/15 text-primary"
                            : "text-white/40"
                        )}
                      >
                        <div
                          className={cn(
                            "h-6 w-8 rounded-sm",
                            i === 0
                              ? "bg-gradient-to-br from-primary/40 to-accent/40"
                              : "bg-white/5"
                          )}
                        />
                        {name}
                      </div>
                    ))}
                    <div className="mt-2 space-y-2">
                      <div className="text-[10px] text-white/30">Wave Color</div>
                      <div className="flex gap-1.5">
                        {["#a855f7", "#ec4899", "#3b82f6", "#22c55e", "#f59e0b"].map((c) => (
                          <div
                            key={c}
                            className="h-4 w-4 rounded-full border border-white/10"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Canvas area */}
                  <div className="flex-1 flex items-center justify-center bg-[#080810] relative">
                    {/* Simulated visualizer preview */}
                    <div className="relative">
                      <div className="h-36 w-36 rounded-full border border-white/10 flex items-center justify-center">
                        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                          <div className="text-white/60 text-lg">|||</div>
                        </div>
                      </div>
                      {/* Fake bars around the circle */}
                      {Array.from({ length: 36 }).map((_, i) => {
                        const angle = (i / 36) * 360;
                        const h = 8 + Math.sin(i * 0.8) * 12 + Math.cos(i * 1.3) * 8;
                        return (
                          <div
                            key={i}
                            className="absolute left-1/2 top-1/2"
                            style={{
                              transform: `rotate(${angle}deg) translateY(-80px)`,
                              transformOrigin: "0 0",
                            }}
                          >
                            <div
                              className="w-[2px] rounded-full"
                              style={{
                                height: `${h}px`,
                                background:
                                  i < 18
                                    ? "rgba(168,85,247,0.5)"
                                    : "rgba(236,72,153,0.5)",
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {/* Text overlay */}
                    <div className="absolute bottom-8 text-center w-full">
                      <div className="text-xs font-bold text-white/80">
                        ARTIST NAME
                      </div>
                      <div className="text-[10px] text-white/40">Track Name</div>
                    </div>
                  </div>
                </div>
                {/* Playback bar */}
                <div className="flex items-center gap-3 border-t border-white/[0.06] bg-[#0c0c12] px-3 py-2">
                  <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                    <div className="ml-0.5 border-l-[5px] border-y-[3px] border-y-transparent border-l-primary/60" />
                  </div>
                  <span className="text-[10px] text-white/30 tabular-nums">
                    0:00
                  </span>
                  <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-primary/40 rounded-full" />
                  </div>
                  <span className="text-[10px] text-white/30 tabular-nums">
                    3:24
                  </span>
                </div>
              </div>
              {/* Shadow glow behind editor */}
              <div className="absolute -inset-4 -z-10 rounded-2xl bg-primary/[0.04] blur-2xl" />
            </div>
          </div>
        </section>

        {/* ─── FEATURE SECTIONS ─── */}
        <section className="border-t border-white/[0.04] bg-[#0a0a10]">
          {/* Easy to use */}
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center">
            <div className="order-2 lg:order-1">
              {/* Mini editor screenshot mock */}
              <div className="rounded-lg border border-white/[0.06] bg-[#111118] p-1 shadow-xl">
                <div className="flex h-6 items-center gap-1.5 px-2">
                  <div className="h-2 w-2 rounded-full bg-red-500/50" />
                  <div className="h-2 w-2 rounded-full bg-yellow-500/50" />
                  <div className="h-2 w-2 rounded-full bg-green-500/50" />
                </div>
                <div className="mt-1 aspect-video rounded bg-[#080810] flex items-center justify-center relative overflow-hidden">
                  {/* Fake city skyline silhouette */}
                  <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-[#111] to-transparent" />
                  <div className="relative text-center">
                    <div className="h-20 w-20 mx-auto rounded-full border border-primary/30 bg-primary/5 flex items-center justify-center mb-3">
                      <div className="text-primary/50 text-2xl">~</div>
                    </div>
                    <div className="text-[11px] font-bold text-white/70">
                      ARTIST NAME
                    </div>
                    <div className="text-[9px] text-white/30">TRACK NAME</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl font-bold leading-tight">
                Easy to use online editor
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                <strong className="text-foreground">No download needed.</strong>{" "}
                Jump into the browser-based editor and start customizing right
                away. The live video preview updates in real time and moves with
                your music.
              </p>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                <strong className="text-foreground">
                  It only takes a few minutes
                </strong>{" "}
                to make a video. Use simple controls or dive deeper with
                advanced customization — colors, effects, text, backdrop, and
                more.
              </p>
              <Link
                href="/auth/signin"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "mt-6 gap-2"
                )}
              >
                Try the editor
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Presets */}
          <div className="mx-auto max-w-6xl px-6 pb-24">
            <div className="text-center">
              <h2 className="text-3xl font-bold">12+ visualizer presets</h2>
              <p className="mt-3 text-muted-foreground">
                From classic radial waveforms to 3D WebGL particle systems.
                Pick one, tweak the colors, and make it yours.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { name: "Radial", gradient: "from-violet-600/30 to-purple-900/30" },
                { name: "Neon Ring", gradient: "from-cyan-500/30 to-blue-900/30" },
                { name: "Bars", gradient: "from-emerald-500/30 to-teal-900/30" },
                { name: "Particles", gradient: "from-pink-500/30 to-rose-900/30" },
                { name: "3D Sphere", gradient: "from-amber-500/30 to-orange-900/30" },
                { name: "Tunnel", gradient: "from-indigo-500/30 to-violet-900/30" },
              ].map((preset) => (
                <div
                  key={preset.name}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-white/[0.06] bg-[#111118] transition-all hover:border-white/[0.12] hover:shadow-lg"
                >
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-60 transition-opacity group-hover:opacity-100",
                      preset.gradient
                    )}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-12 w-12 rounded-full border border-white/10" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <span className="text-[11px] font-medium text-white/80">
                      {preset.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div className="border-t border-white/[0.04] py-24">
            <div className="mx-auto max-w-4xl px-6">
              <h2 className="text-center text-3xl font-bold">How it works</h2>
              <div className="mt-16 grid gap-12 md:grid-cols-3">
                {[
                  {
                    step: "01",
                    title: "Upload your track",
                    desc: "Drop in an MP3, WAV, FLAC, or OGG file. We analyze the audio to drive the visuals.",
                  },
                  {
                    step: "02",
                    title: "Customize the look",
                    desc: "Pick a preset, adjust colors, add your logo and artist name. Preview in real-time.",
                  },
                  {
                    step: "03",
                    title: "Export & share",
                    desc: "Hit export. We render it in the cloud at up to 4K 60fps. Download and upload anywhere.",
                  },
                ].map(({ step, title, desc }) => (
                  <div key={step}>
                    <div className="text-4xl font-bold text-primary/30">
                      {step}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pricing tease */}
          <div className="border-t border-white/[0.04] py-24">
            <div className="mx-auto max-w-3xl px-6 text-center">
              <h2 className="text-3xl font-bold">
                Start free, upgrade when you need to
              </h2>
              <p className="mt-3 text-muted-foreground">
                3 free exports per month. No watermark on Pro at just $7.99/mo.
              </p>
              <div className="mt-8 inline-flex flex-col items-start gap-3 text-left text-sm text-muted-foreground">
                {[
                  "3 free exports every month",
                  "720p @ 30fps on the free plan",
                  "1080p @ 60fps, no watermark on Pro",
                  "4K, batch export, lyrics on Enterprise",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-8 flex items-center justify-center gap-4">
                <Link
                  href="/auth/signin"
                  className={cn(buttonVariants({ size: "lg" }), "gap-2 px-6")}
                >
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/pricing"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" })
                  )}
                >
                  Compare plans
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer className="border-t border-white/[0.04] bg-[#08080e] py-10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
            <span className="text-sm text-muted-foreground/60">
              VizWave
            </span>
            <div className="flex gap-6 text-sm text-muted-foreground/60">
              <Link href="/pricing" className="hover:text-foreground">
                Pricing
              </Link>
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
