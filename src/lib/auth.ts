import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import Google from "next-auth/providers/google";
import { db } from "./db";
import { users } from "./db/schema";
import * as schema from "./db/schema";
import { eq } from "drizzle-orm";

const isDev = process.env.NODE_ENV === "development";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  session: { strategy: isDev ? "jwt" : "database" },
  providers: [
    // Dev-only: sign in with any email + any password
    ...(isDev
      ? [
          Credentials({
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
              const email = credentials?.email as string;
              if (!email) return null;

              // Find or create the user
              let [user] = await db
                .select()
                .from(users)
                .where(eq(users.email, email));

              if (!user) {
                [user] = await db
                  .insert(users)
                  .values({
                    email,
                    name: email.split("@")[0],
                    emailVerified: new Date(),
                  })
                  .returning();
              }

              return { id: user.id, email: user.email, name: user.name };
            },
          }),
        ]
      : []),
    Resend({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    }),
    ...(process.env.AUTH_GOOGLE_ID
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
    error: "/auth/error",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token, user }) {
      if (session.user) {
        // JWT mode (dev) uses token, database mode uses user
        session.user.id = (token?.id as string) || user?.id;
      }
      return session;
    },
  },
});
