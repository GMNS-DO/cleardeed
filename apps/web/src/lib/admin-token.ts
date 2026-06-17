/**
 * Admin token guard — checks the request for the founder admin
 * token via the `x-cleardeed-admin-token` header or `Authorization:
 * Bearer <token>`. Used by V2 endpoints (e.g. /certified-copy) that
 * should be founder-only.
 *
 * Returns true if the token matches, OR if no token is configured
 * (concierge launch phase). Returns false if a token is configured
 * and the request doesn't supply a matching value.
 */

import type { NextRequest } from "next/server";

export function assertAdminToken(req: NextRequest): boolean {
  const expected = process.env.REPORT_CREATE_TOKEN ?? process.env.ADMIN_VIEW_TOKEN;
  if (!expected || expected === "") {
    // Concierge launch phase: no token configured, allow.
    return true;
  }

  const authorization = req.headers.get("authorization") ?? "";
  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const headerToken = req.headers.get("x-cleardeed-admin-token");
  const provided = bearerToken ?? headerToken ?? "";

  return provided.length > 0 && provided === expected;
}
