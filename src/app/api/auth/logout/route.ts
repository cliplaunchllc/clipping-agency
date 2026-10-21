import { type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const headers = new Headers({ Location: "/login?out=1" });

  // Known NextAuth cookie names (v4 + v5)
  const known = [
    "authjs.session-token",
    "authjs.csrf-token",
    "authjs.callback-url",
    "__Secure-authjs.session-token",
    "__Secure-authjs.callback-url",
    "__Host-authjs.csrf-token",
    "next-auth.session-token",
    "next-auth.csrf-token",
    "next-auth.callback-url",
    "__Secure-next-auth.session-token",
    "__Secure-next-auth.callback-url",
    "__Host-next-auth.csrf-token",
  ];

  // Also dynamically clear every cookie actually present in the request
  const allNames = new Set(known);
  for (const c of req.cookies.getAll()) allNames.add(c.name);

  for (const name of allNames) {
    const secure = name.startsWith("__Secure-") || name.startsWith("__Host-");
    headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`
    );
  }

  return new Response(null, { status: 302, headers });
}
