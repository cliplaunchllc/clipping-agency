import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60, // 30 days — makes it a persistent cookie, not session cookie
      },
    },
  },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return { id: user.id, email: user.email, name: user.name, role: user.role, clientId: user.clientId ?? null, status: user.status } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = user as any;
        token.role = u.role;
        token.id = u.id;
        token.name = u.name;
        token.clientId = u.clientId ?? null;
        token.status = u.status ?? "active";
      }
      // Re-fetch fresh profile whenever the session is explicitly updated
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, email: true, role: true, clientId: true, status: true },
        });
        if (fresh) {
          token.name = fresh.name;
          token.email = fresh.email;
          token.role = fresh.role;
          token.clientId = fresh.clientId ?? null;
          token.status = fresh.status ?? "active";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
        session.user.name = token.name as string ?? session.user.name;
        session.user.clientId = (token.clientId as string | null) ?? null;
        session.user.status = (token.status as string) ?? "active";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
