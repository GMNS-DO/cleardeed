/**
 * Tests for /api/admin/lawyers — auth, CRUD.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "select", "insert", "update", "delete", "eq", "single", "maybeSingle"]) {
    chain[m] = vi.fn(() => chain);
  }
  // For single() — resolve with a row
  chain.then = (resolve: (v: unknown) => void) => {
    resolve({ data: { id: "l-row" }, error: null });
  };
  return {
    listLawyers: vi.fn(),
    getLawyer: vi.fn(),
    upsertLawyer: vi.fn(),
    deleteLawyer: vi.fn(),
    supabaseAdmin: vi.fn(() => chain),
    isDashboardAuthorized: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  listLawyers: mocks.listLawyers,
  getLawyer: mocks.getLawyer,
  upsertLawyer: mocks.upsertLawyer,
  deleteLawyer: mocks.deleteLawyer,
  supabaseAdmin: mocks.supabaseAdmin,
}));

vi.mock("@/lib/dashboard-auth", () => ({
  isDashboardAuthorized: mocks.isDashboardAuthorized,
}));

import { GET, POST } from "../route";
import { PUT, DELETE } from "../[id]/route";

describe("/api/admin/lawyers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain mocks
    for (const m of Object.values({
      from: mocks.supabaseAdmin().from,
      select: mocks.supabaseAdmin().select,
      insert: mocks.supabaseAdmin().insert,
      update: mocks.supabaseAdmin().update,
      delete: mocks.supabaseAdmin().delete,
      eq: mocks.supabaseAdmin().eq,
      single: mocks.supabaseAdmin().single,
      maybeSingle: mocks.supabaseAdmin().maybeSingle,
    })) {
      // noop reset marker
      m.mockClear?.();
    }
  });

  describe("GET", () => {
    it("returns 401 without a valid token", async () => {
      mocks.isDashboardAuthorized.mockReturnValueOnce(false);
      const req = new Request("http://test.local/api/admin/lawyers");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("returns lawyers when authorized", async () => {
      mocks.isDashboardAuthorized.mockReturnValueOnce(true);
      mocks.listLawyers.mockResolvedValueOnce([{ id: "l1", name: "Adv A" }]);
      const req = new Request("http://test.local/api/admin/lawyers", {
        headers: { "x-cleardeed-admin-token": "secret" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.lawyers).toEqual([{ id: "l1", name: "Adv A" }]);
    });
  });

  describe("POST", () => {
    it("returns 401 without token", async () => {
      mocks.isDashboardAuthorized.mockReturnValueOnce(false);
      const req = new Request("http://test.local/api/admin/lawyers", {
        method: "POST",
        body: JSON.stringify({ name: "X", email: "x@x.in" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 when required fields missing", async () => {
      mocks.isDashboardAuthorized.mockReturnValueOnce(true);
      const req = new Request("http://test.local/api/admin/lawyers", {
        method: "POST",
        headers: { "x-cleardeed-admin-token": "secret" },
        body: JSON.stringify({ firm: "Only firm, no name or email" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("creates a lawyer when authorized and body valid", async () => {
      mocks.isDashboardAuthorized.mockReturnValueOnce(true);
      mocks.upsertLawyer.mockResolvedValueOnce({
        id: "l1",
        name: "Adv A",
        firm: null,
        email: "a@a.in",
        phone: null,
        license_number: null,
        photo_url: null,
        is_panel: true,
        created_at: "2026-01-01T00:00:00Z",
      });
      const req = new Request("http://test.local/api/admin/lawyers", {
        method: "POST",
        headers: { "x-cleardeed-admin-token": "secret", "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Adv A", email: "a@a.in" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.lawyer.id).toBe("l1");
      expect(body.lawyer.name).toBe("Adv A");
    });
  });
});

describe("/api/admin/lawyers/[id]", () => {
  describe("PUT", () => {
    it("returns 401 without token", async () => {
      mocks.isDashboardAuthorized.mockReturnValueOnce(false);
      const req = new Request("http://test.local/api/admin/lawyers/l1", {
        method: "PUT",
        body: JSON.stringify({ name: "X" }),
      });
      const res = await PUT(req, { params: { id: "l1" } });
      expect(res.status).toBe(401);
    });

    it("updates the lawyer", async () => {
      mocks.isDashboardAuthorized.mockReturnValueOnce(true);
      mocks.getLawyer.mockResolvedValueOnce({
        id: "l1",
        name: "Old",
        firm: null,
        email: "old@old.in",
        phone: null,
        license_number: null,
        photo_url: null,
        is_panel: true,
        created_at: "2026-01-01T00:00:00Z",
      });
      mocks.upsertLawyer.mockResolvedValueOnce({ id: "l1", name: "Updated" });
      const req = new Request("http://test.local/api/admin/lawyers/l1", {
        method: "PUT",
        headers: { "x-cleardeed-admin-token": "secret", "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      });
      const res = await PUT(req, { params: { id: "l1" } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.lawyer.name).toBe("Updated");
    });
  });

  describe("DELETE", () => {
    it("returns 401 without token", async () => {
      mocks.isDashboardAuthorized.mockReturnValueOnce(false);
      const req = new Request("http://test.local/api/admin/lawyers/l1", {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: { id: "l1" } });
      expect(res.status).toBe(401);
    });

    it("deletes the lawyer and returns 204", async () => {
      mocks.isDashboardAuthorized.mockReturnValueOnce(true);
      mocks.getLawyer.mockResolvedValueOnce({ id: "l1", name: "Adv A" } as any);
      mocks.deleteLawyer.mockResolvedValueOnce(undefined);
      const req = new Request("http://test.local/api/admin/lawyers/l1", {
        method: "DELETE",
        headers: { "x-cleardeed-admin-token": "secret" },
      });
      const res = await DELETE(req, { params: { id: "l1" } });
      expect(res.status).toBe(204);
    });
  });
});