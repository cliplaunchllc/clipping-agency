import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth(function middleware(req: NextRequest & { auth: { user?: { role?: string } } | null }) {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  // If not logged in and trying to access protected routes, send to login
  if (!role) {
    if (pathname.startsWith("/agency") || pathname.startsWith("/clipper") || pathname.startsWith("/client")) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // Role-based route protection
  if (pathname.startsWith("/agency") && role !== "agency") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/clipper") && role !== "clipper") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/client") && role !== "client") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/agency/:path*", "/clipper/:path*", "/client/:path*"],
};
