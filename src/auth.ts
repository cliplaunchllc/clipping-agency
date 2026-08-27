import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const THIRTY_DAYS = 30 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: THIRTY_DAYS },
  jwt: { maxAge: THIRTY_DAYS },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: THIRTY_DAYS,
      },
    },
  },
  trustHost: true,
  providers: [
    Credentials({
      id: "credentials",
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
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clientId: user.clientId ?? null,
          status: user.status,
        } as any;
      },
    }),
    Credentials({
      id: "device-token",
      credentials: { token: {} },
      async authorize(credentials) {
        if (!credentials?.token) return null;
        const deviceSession = await prisma.session.findUnique({
          where: { sessionToken: credentials.token as string },
          include: { user: true },
        });
        if (!deviceSession || deviceSession.expires < new Date()) return null;
        const user = deviceSession.user;
        // Extend device token expiry on use
        await prisma.session.update({
          where: { sessionToken: credentials.token as string },
          data: { expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clientId: user.clientId ?? null,
          status: user.status,
        } as any;
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
        session.user.name = (token.name as string) ?? session.user.name;
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
