import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

function getLoginUrl(req: NextRequest): string {
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}/login`;
}

function clearAndRedirectToLogin(req: NextRequest) {
  const res = NextResponse.redirect(getLoginUrl(req));
  const cookieOptions = { path: "/", maxAge: 0 };
  // NextAuth v4 names
  res.cookies.set("next-auth.session-token", "", cookieOptions);
  res.cookies.set("__Secure-next-auth.session-token", "", cookieOptions);
  res.cookies.set("next-auth.csrf-token", "", cookieOptions);
  res.cookies.set("__Host-next-auth.csrf-token", "", cookieOptions);
  res.cookies.set("next-auth.callback-url", "", cookieOptions);
  res.cookies.set("__Secure-next-auth.callback-url", "", cookieOptions);
  // NextAuth v5 names (authjs.* prefix)
  res.cookies.set("authjs.session-token", "", cookieOptions);
  res.cookies.set("__Secure-authjs.session-token", "", cookieOptions);
  res.cookies.set("authjs.csrf-token", "", cookieOptions);
  res.cookies.set("__Host-authjs.csrf-token", "", cookieOptions);
  res.cookies.set("authjs.callback-url", "", cookieOptions);
  res.cookies.set("__Secure-authjs.callback-url", "", cookieOptions);
  return res;
}

export const proxy = auth((req) => {
  try {
    const { nextUrl } = req;
    const session = req.auth;
    const isLoggedIn = !!session?.user;
    const role = session?.user?.role;

    // Public routes
    if (nextUrl.pathname.startsWith("/share/")) {
      return NextResponse.next();
    }

    if (nextUrl.pathname === "/signup") {
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

    // Protected routes — clear stale cookies and redirect for anyone not logged in
    if (!isLoggedIn) {
      return clearAndRedirectToLogin(req);
    }

  // Role guards
  if (nextUrl.pathname.startsWith("/agency") && role !== "agency") {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Team member route restrictions — block CRM and Team Payments
  const isTeamMember = (session as any)?.user?.isTeamMember === true;
  const TEAM_MEMBER_BLOCKED = ["/agency/crm", "/agency/team-payments", "/agency/lead-factory"];
  if (isTeamMember && TEAM_MEMBER_BLOCKED.some((p) => nextUrl.pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/agency", nextUrl));
  }
  // Redirect team members from client settings page to preview
  const clientDetailMatch = nextUrl.pathname.match(/^\/agency\/clients\/([^/]+)$/);
  if (isTeamMember && clientDetailMatch) {
    return NextResponse.redirect(new URL(`/agency/preview/client/${clientDetailMatch[1]}`, nextUrl));
  }
  if (nextUrl.pathname.startsWith("/clipper") && role !== "clipper") {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }
  if (nextUrl.pathname.startsWith("/client") && role !== "client") {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  const status = (session as any)?.user?.status;
  const mustChangePassword = (session as any)?.user?.mustChangePassword;

  // Agency team members with temp passwords must go to settings > security
  if (role === "agency" && mustChangePassword && nextUrl.pathname !== "/agency/settings") {
    return NextResponse.redirect(new URL("/agency/settings", nextUrl));
  }

  // Pending clippers can only access the pending page
  if (role === "clipper" && status === "pending" && nextUrl.pathname !== "/clipper/pending") {
    return NextResponse.redirect(new URL("/clipper/pending", nextUrl));
  }
  // Active clippers can't access the pending page
  if (role === "clipper" && status !== "pending" && nextUrl.pathname === "/clipper/pending") {
    return NextResponse.redirect(new URL("/clipper", nextUrl));
  }

  // Pending clients can only access the pending page and settings
  if (role === "client" && status === "pending" && nextUrl.pathname !== "/client/pending") {
    return NextResponse.redirect(new URL("/client/pending", nextUrl));
  }
  // Active clients can't access the pending page
  if (role === "client" && status !== "pending" && nextUrl.pathname === "/client/pending") {
    return NextResponse.redirect(new URL("/client", nextUrl));
  }

    return NextResponse.next();
  } catch {
    // JWT decode failure or any auth error — wipe cookies and send to login
    return clearAndRedirectToLogin(req);
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
