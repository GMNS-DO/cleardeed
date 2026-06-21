/**
 * ClearDeed — Next.js middleware.
 *
 * Runs on every non-static request. Two responsibilities:
 *   1. Refresh Supabase Auth session so Server Components see fresh tokens.
 *   2. Redirect unauthenticated users to /login for protected routes.
 *
 * Protected routes (require auth):
 *   - /dashboard      — buyer's own report history
 *   - /checkout/*     — pre-payment form (forces login BEFORE paywall)
 *
 * Public routes (no auth required):
 *   - /               — landing page
 *   - /login          — phone-OTP entry
 *   - /report/[id]    — token URL still works (CLD-DEMO* bypass + ?token= HMAC)
 *   - /api/leads, /api/checkout, /api/payment/success, /api/webhook/razorpay
 *     — payment infrastructure must work even if session is broken
 *   - /privacy, /terms, /admin (token-gated)
 *
 * Token URLs (/report/[id]?token=...) are explicitly NOT gated because
 * buyers may legitimately share the link with their lawyer or family
 * member, who does not have a ClearDeed account.
 */
import { type NextRequest } from "next/server";
import { updateSession, buildLoginRedirect } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Always refresh the session (no-op for public routes).
  const { response, user } = await updateSession(request);

  const { pathname, search } = request.nextUrl;

  // Auth gate: redirect to /login if not authenticated.
  // The login page itself is public (handled by matcher exclusion below).
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/checkout");
  if (isProtected && !user) {
    return buildLoginRedirect(request);
  }

  // /api routes that depend on auth (e.g. /api/preview) gate inside the route
  // via getUser() — middleware stays out of those to keep this file small.

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, fonts, data, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json|woff2?)$).*)",
  ],
};