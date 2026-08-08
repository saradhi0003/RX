// Regression guard for the save failure.
//
// `candidates.full_name` is NOT NULL with no default and no DB trigger, while
// every form collects first_name/last_name. Postgres rejected each insert with
//   23502: null value in column "full_name" ... violates not-null constraint
// (reproduced against the live database), the create threw, and because the
// dialog only closes on success the user saw a form that silently refused to
// save. withFullName derives the column for every write path.
import { describe, it, expect } from "vitest";
import { withFullName } from "@/entities/normalizers";

describe("withFullName", () => {
  it("derives full_name from first + last — the case that was failing", () => {
    expect(withFullName({ first_name: "Ada", last_name: "Lovelace", email: "a@b.c" }))
      .toEqual({ first_name: "Ada", last_name: "Lovelace", full_name: "Ada Lovelace", email: "a@b.c" });
  });

  it("works with only one name part present", () => {
    expect(withFullName({ first_name: "Cher" }).full_name).toBe("Cher");
    expect(withFullName({ last_name: "Prince" }).full_name).toBe("Prince");
  });

  it("trims and collapses whitespace rather than writing ragged values", () => {
    expect(withFullName({ first_name: "  Ada  ", last_name: " Lovelace " }).full_name)
      .toBe("Ada Lovelace");
  });

  it("keeps an explicitly supplied full_name", () => {
    expect(withFullName({ full_name: "Grace Hopper", first_name: "Grace", last_name: "Hopper" }).full_name)
      .toBe("Grace Hopper");
  });

  it("back-fills first/last when only a whole name was given (AI parsers, imports)", () => {
    const out = withFullName({ full_name: "Grace Brewster Hopper" });
    expect(out.first_name).toBe("Grace");
    expect(out.last_name).toBe("Brewster Hopper");
  });

  it("leaves full_name untouched on a partial update carrying no name", () => {
    // A status-only edit must not blank a NOT NULL column.
    const out = withFullName({ status: "screening" });
    expect(out).not.toHaveProperty("full_name");
    expect(out).toEqual({ status: "screening" });
  });

  it("ignores blank name fields instead of writing an empty string", () => {
    const out = withFullName({ first_name: "   ", last_name: "" });
    expect(out).not.toHaveProperty("full_name");
  });
});
