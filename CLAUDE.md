# VizWave - Music Visualizer SaaS

## Project
Audio-reactive music visualizer video maker (Specterr.com competitor). Upload audio, customize visualizer, export MP4.

## Stack
- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Drizzle ORM + Turso (edge SQLite)
- Auth.js v5 (magic link via Resend + Google OAuth)
- Stripe (subscriptions, checkout, webhooks)
- Azure Blob Storage (audio/image uploads, rendered videos)
- Zustand (editor state) + TanStack Query (server state)

## Next.js 16 Notes
- `cookies()`, `headers()`, `params`, `searchParams` are all **async** — must `await`
- Route handler params: `{ params }: { params: Promise<{ id: string }> }`
- Middleware: use `proxy.ts` with `export default` (or keep middleware.ts)

## Key Paths
- Database schema: `src/lib/db/schema.ts`
- Auth config: `src/lib/auth.ts`
- Stripe config: `src/lib/stripe.ts`
- Editor state: `src/stores/editor-store.ts`
- Editor panels: `src/components/editor/panels/`
- API routes: `src/app/api/`

## Commands
- `npm run dev` — start dev server
- `npx drizzle-kit push` — push schema to Turso
- `npx drizzle-kit generate` — generate migration SQL
