// Layer 2: Data Layer. Exercises createEntity() against a mocked Supabase REST
// endpoint (MSW) and verifies the Base44-compat normalization (created_at alias).
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server.js";
import { createEntity } from "@/lib/entityFactory";

const SUPABASE = "https://bwjfglerixssibenkjse.supabase.co";
const Candidate = createEntity("candidates");

describe("entityFactory (Data Layer)", () => {
  it("list() returns rows with a created_date alias for created_at", async () => {
    server.use(
      http.get(`${SUPABASE}/rest/v1/candidates`, () =>
        HttpResponse.json([{ id: "c1", full_name: "Ada", created_at: "2026-01-01T00:00:00Z" }]),
      ),
    );
    const rows = await Candidate.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].full_name).toBe("Ada");
    // Base44-compat: created_date mirrors created_at
    expect(rows[0].created_date).toBe("2026-01-01T00:00:00Z");
  });

  it("list() returns [] when the table is empty", async () => {
    server.use(http.get(`${SUPABASE}/rest/v1/candidates`, () => HttpResponse.json([])));
    expect(await Candidate.list()).toEqual([]);
  });

  it("throws when Supabase returns an error status", async () => {
    server.use(
      http.get(`${SUPABASE}/rest/v1/candidates`, () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    await expect(Candidate.list()).rejects.toBeTruthy();
  });
});
