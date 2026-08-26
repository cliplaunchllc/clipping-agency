import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const proxy = auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const isLoggedIn = !!session?.user;
  const role = session?.user?.role;

  // Public routes
  if (nextUrl.pathname === "/login") {
    if (isLoggedIn) {
      const redirectMap: Record<string, string> = {
        agency: "/agency",
        clipper: "/clipper",
        client: "/client",
      };
      return NextResponse.redirect(new URL(redirectMap[role!] || "/login", nextUrl));
    }
    return NextResponse.next();
  }

  // Protected routes
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Role guards
  if (nextUrl.pathname.startsWith("/agency") && role !== "agency") {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }
  if (nextUrl.pathname.startsWith("/clipper") && role !== "clipper") {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }
  if (nextUrl.pathname.startsWith("/client") && role !== "client") {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Pending clippers can only access the pending page
  const status = (session as any)?.user?.status;
  if (role === "clipper" && status === "pending" && nextUrl.pathname !== "/clipper/pending") {
    return NextResponse.redirect(new URL("/clipper/pending", nextUrl));
  }
  // Active clippers can't access the pending page
  if (role === "clipper" && status !== "pending" && nextUrl.pathname === "/clipper/pending") {
    return NextResponse.redirect(new URL("/clipper", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
