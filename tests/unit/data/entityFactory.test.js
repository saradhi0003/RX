// Layer 2: Data Layer. Exercises createEntity() against a mocked Supabase REST
// endpoint (MSW) and verifies the Base44-compat normalization (created_at alias).
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server.js";
import { createEntity } from "@/lib/entityFactory";
import { EmailAccount } from "@/entities/EmailAccount";

const SUPABASE = "https://bwjfglerixssibenkjse.supabase.co";
const Candidate = createEntity("candidates");

/** Records the `select=` PostgREST sent for the next request to `table`. */
function captureSelect(table, method = "get") {
  const seen = { select: null };
  server.use(
    http[method](`${SUPABASE}/rest/v1/${table}`, ({ request }) => {
      seen.select = new URL(request.url).searchParams.get("select");
      return HttpResponse.json([]);
    }),
  );
  return seen;
}

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

  it("defaults to selecting every column", async () => {
    const seen = captureSelect("candidates");
    await Candidate.list();
    expect(seen.select).toBe("*");
  });

  it("honours an explicit columns option on reads", async () => {
    const Narrow = createEntity("candidates", { columns: "id, full_name" });
    const seen = captureSelect("candidates");
    await Narrow.list();
    expect(seen.select).toBe("id,full_name");
  });
});

/**
 * Migration 032 revokes table-wide SELECT on email_accounts and grants only the
 * non-secret columns, so a `select=*` is rejected by Postgres outright — the
 * settings page would fail to load rather than merely hide the tokens. These
 * guard both halves: the select stays narrow, and the OAuth tokens stay out of
 * anything the browser asks for.
 */
describe("EmailAccount — OAuth tokens never reach the browser", () => {
  const SECRETS = ["access_token", "refresh_token"];

  it("list() asks only for granted columns", async () => {
    const seen = captureSelect("email_accounts");
    await EmailAccount.list();
    expect(seen.select).not.toBe("*");
    for (const secret of SECRETS) expect(seen.select).not.toContain(secret);
    expect(seen.select).toContain("email_address");
  });

  it("update() returns only granted columns", async () => {
    const seen = captureSelect("email_accounts", "patch");
    // The row shape is irrelevant here; .single() rejecting on an empty body is
    // expected — the assertion is about what was requested, not what came back.
    await EmailAccount.update("acc-1", { is_active: false }).catch(() => {});
    expect(seen.select).not.toBe("*");
    for (const secret of SECRETS) expect(seen.select).not.toContain(secret);
  });
});
