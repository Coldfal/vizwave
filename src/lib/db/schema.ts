import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Auth.js tables
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").unique().notNull(),
  emailVerified: integer("email_verified", { mode: "timestamp" }),
  name: text("name"),
  image: text("image"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  subscriptionTier: text("subscription_tier", { enum: ["free", "pro", "enterprise"] }).default("free").notNull(),
  subscriptionStatus: text("subscription_status", { enum: ["none", "active", "past_due", "canceled"] }).default("none").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  exportsThisMonth: integer("exports_this_month").default(0).notNull(),
  exportsResetAt: integer("exports_reset_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

export const verificationTokens = sqliteTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

// App tables
export const presets = sqliteTable("presets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  category: text("category", { enum: ["waveform", "particles", "3d", "minimal", "retro"] }).notNull(),
  tier: text("tier", { enum: ["free", "pro", "enterprise"] }).default("free").notNull(),
  componentName: text("component_name").notNull(),
  defaultConfig: text("default_config").notNull(), // JSON string
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  presetId: text("preset_id"), // slug-based, no FK — presets are code-defined for now
  audioUrl: text("audio_url"),
  audioDuration: real("audio_duration"),
  audioWaveform: text("audio_waveform"), // JSON: pre-computed amplitude/frequency/beat data
  logoUrl: text("logo_url"),
  backgroundUrl: text("background_url"),
  config: text("config").notNull(), // JSON: full editor state
  status: text("status", { enum: ["draft", "rendering", "done", "failed"] }).default("draft").notNull(),
  renderJobId: text("render_job_id"),
  outputUrl: text("output_url"),
  outputSize: integer("output_size"),
  resolution: text("resolution").default("1080p").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const renderJobs = sqliteTable("render_jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["queued", "processing", "encoding", "uploading", "done", "failed"] }).default("queued").notNull(),
  progress: integer("progress").default(0).notNull(),
  errorMessage: text("error_message"),
  workerId: text("worker_id"),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  renderTimeMs: integer("render_time_ms"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// TypeScript types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Preset = typeof presets.$inferSelect;
export type RenderJob = typeof renderJobs.$inferSelect;
