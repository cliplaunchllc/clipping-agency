import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      clientId: string | null;
      status: string;
    } & DefaultSession["user"];
  }
}
