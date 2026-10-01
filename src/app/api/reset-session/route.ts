import { NextResponse } from "next/server";

const AUTH_COOKIES = [
  "__Host-authjs.csrf-token",
  "__Secure-authjs.session-token",
  "__Secure-authjs.callback-url",
  "authjs.csrf-token",
  "authjs.session-token",
  "authjs.callback-url",
];

export async function GET() {
  const response = NextResponse.redirect(
    new URL("/login", process.env.NEXTAUTH_URL ?? "https://postgres-production-cff78.up.railway.app")
  );

  for (const name of AUTH_COOKIES) {
    // Delete by setting Max-Age=0 — works for both __Host- and regular cookies
    response.cookies.set(name, "", {
      maxAge: 0,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
  }

  return response;
}
