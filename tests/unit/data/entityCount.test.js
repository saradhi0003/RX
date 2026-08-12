import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server";
import { createEntity } from "@/lib/entityFactory";

const BASE = "https://bwjfglerixssibenkjse.supabase.co/rest/v1";

/**
 * `count()` exists because metrics were being read off `(await list()).length`,
 * and every list call is capped — so the number silently reported the cap
 * instead of the truth (Dashboard showed 50 companies against a real 2360).
 * These assert the two things that made that bug possible: that a count is
 * NOT bounded by the list limit, and that it asks Postgres for a count rather
 * than fetching rows.
 */
describe("entityFactory.count", () => {
  it("returns the full count even when it far exceeds any page limit", async () => {
    server.use(
      http.head(`${BASE}/companies`, () =>
        new HttpResponse(null, {
          status: 200,
          // PostgREST reports an exact count in Content-Range: <range>/<total>
          headers: { "content-range": "*/2360" },
        })
      )
    );
    const Company = createEntity("companies");
    await expect(Company.count()).resolves.toBe(2360);
  });

  it("requests a head-only exact count, transferring no rows", async () => {
    let sawHeadRequest = false;
    let prefer = "";
    server.use(
      http.head(`${BASE}/jobs`, ({ request }) => {
        // head:true makes supabase-js issue a HEAD, and count:"exact" sets Prefer.
        sawHeadRequest = request.method === "HEAD";
        prefer = request.headers.get("prefer") || "";
        return new HttpResponse(null, { status: 200, headers: { "content-range": "*/276" } });
      })
    );
    const Job = createEntity("jobs");
    await expect(Job.count()).resolves.toBe(276);
    expect(sawHeadRequest, "should issue a HEAD, not fetch rows").toBe(true);
    expect(prefer).toMatch(/count=exact/);
  });

  it("applies filters, so a status-scoped metric counts only matching rows", async () => {
    let url = "";
    server.use(
      http.head(`${BASE}/jobs`, ({ request }) => {
        url = request.url;
        return new HttpResponse(null, { status: 200, headers: { "content-range": "*/0" } });
      })
    );
    const Job = createEntity("jobs");
    await expect(Job.count({ status: "open" })).resolves.toBe(0);
    expect(url).toContain("status=eq.open");
  });
});
