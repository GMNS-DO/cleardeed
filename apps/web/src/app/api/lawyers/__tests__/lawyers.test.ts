/**
 * Tests for GET /api/lawyers — public list of panel advocates.
 */
import { describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listLawyers: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  listLawyers: mocks.listLawyers,
}));

import { GET } from "../route";

describe("GET /api/lawyers", () => {
  it("returns 200 with panel advocates only", async () => {
    const panel = [
      {
        id: "l1",
        name: "Adv. A",
        firm: "A & Co",
        email: "a@a.in",
        phone: "9876543210",
        license_number: "KA/123/2000",
        photo_url: null,
        is_panel: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    mocks.listLawyers.mockResolvedValueOnce(panel);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(panel);
    expect(mocks.listLawyers).toHaveBeenCalledWith({ panelOnly: true });
  });

  it("returns 500 when the DB call throws", async () => {
    mocks.listLawyers.mockRejectedValueOnce(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Failed/i);
  });
});