/**
 * Dashboard auth helper.
 *
 * Mirrors the /admin pattern: routes fail closed when ADMIN_VIEW_TOKEN is
 * unset. The same token is reused for /dashboard and /admin.
 */
export function isDashboardAuthorized(providedToken: string | null | undefined): boolean {
  const expectedToken = process.env.ADMIN_VIEW_TOKEN;
  if (!expectedToken) return false;
  if (!providedToken) return false;
  // Constant-time compare; both should be the same length in practice.
  if (providedToken.length !== expectedToken.length) return false;
  let mismatch = 0;
  for (let i = 0; i < providedToken.length; i++) {
    mismatch |= providedToken.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }
  return mismatch === 0;
}
