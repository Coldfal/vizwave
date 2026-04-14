import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPaths = ["/dashboard", "/editor", "/render"];
const authPaths = ["/auth/signin", "/auth/verify"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // For now, just handle redirects. Auth.js session check happens in pages/API routes.
  // Full proxy-level auth checking requires reading the session cookie here.

  // Let protected and auth routes through — individual pages handle auth via `auth()` call
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/editor/:path*", "/render/:path*", "/auth/:path*"],
};
