import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth((req: NextRequest & { auth: unknown }) => {
  // Public API routes that authenticate via their own mechanism — allow through.
  if (req.nextUrl.pathname.startsWith("/api/agency/crm/import")) {
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  // Run middleware on all routes except static files and Next.js internals.
  // /api/agency/crm/import is handled above and always allowed through.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
