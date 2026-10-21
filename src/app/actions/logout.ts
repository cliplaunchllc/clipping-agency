"use server";

import { cookies } from "next/headers";

export async function logoutAction() {
  try {
    const cookieStore = await cookies();
    const names = [
      // NextAuth v5 (authjs.* prefix)
      "authjs.session-token",
      "__Secure-authjs.session-token",
      "authjs.csrf-token",
      "__Host-authjs.csrf-token",
      "authjs.callback-url",
      "__Secure-authjs.callback-url",
      // NextAuth v4 fallback
      "next-auth.session-token",
      "__Secure-next-auth.session-token",
      "next-auth.csrf-token",
      "__Host-next-auth.csrf-token",
      "next-auth.callback-url",
      "__Secure-next-auth.callback-url",
    ];
    for (const name of names) {
      try { cookieStore.delete(name); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}
