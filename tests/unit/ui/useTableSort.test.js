// Layer 17 (UX/UI) + Layer 4 (BI) support: the client-side sort comparator that
// backs every sortable list table. Pure logic — no network, no DOM layout.
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTableSort } from "@/hooks/useTableSort";

const vals = (rows, key = "v") => rows.map((r) => r[key]);

describe("useTableSort", () => {
  it("leaves rows in source order until a sort key is set", () => {
    const data = [{ v: "b" }, { v: "a" }];
    const { result } = renderHook(() => useTableSort(data));
    expect(vals(result.current.sorted)).toEqual(["b", "a"]);
  });

  it("sorts strings case-insensitively and numeric-aware", () => {
    const data = [{ v: "item10" }, { v: "item2" }, { v: "Item1" }];
    const { result } = renderHook(() =>
      useTableSort(data, { defaultKey: "v", defaultOrder: "asc" })
    );
    expect(vals(result.current.sorted)).toEqual(["Item1", "item2", "item10"]);
  });

  it("sorts numbers ascending and descending", () => {
    const data = [{ v: 3 }, { v: 1 }, { v: 2 }];
    const asc = renderHook(() =>
      useTableSort(data, { defaultKey: "v", defaultOrder: "asc" })
    );
    expect(vals(asc.result.current.sorted)).toEqual([1, 2, 3]);
    const desc = renderHook(() =>
      useTableSort(data, { defaultKey: "v", defaultOrder: "desc" })
    );
    expect(vals(desc.result.current.sorted)).toEqual([3, 2, 1]);
  });

  it("sorts Date values chronologically", () => {
    const data = [
      { id: "c", v: new Date("2026-03-01") },
      { id: "a", v: new Date("2026-01-01") },
      { id: "b", v: new Date("2026-02-01") },
    ];
    const { result } = renderHook(() =>
      useTableSort(data, { defaultKey: "v", defaultOrder: "asc" })
    );
    expect(result.current.sorted.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("always sorts null/undefined last, in both directions", () => {
    const data = [{ v: "b" }, { v: null }, { v: "a" }];
    const asc = renderHook(() =>
      useTableSort(data, { defaultKey: "v", defaultOrder: "asc" })
    );
    expect(vals(asc.result.current.sorted)).toEqual(["a", "b", null]);
    const desc = renderHook(() =>
      useTableSort(data, { defaultKey: "v", defaultOrder: "desc" })
    );
    expect(vals(desc.result.current.sorted)).toEqual(["b", "a", null]);
  });

  it("requestSort selects a new column ascending, then flips it", () => {
    const data = [{ v: 2 }, { v: 1 }];
    const { result } = renderHook(() => useTableSort(data));

    act(() => result.current.requestSort("v"));
    expect(result.current.sortKey).toBe("v");
    expect(result.current.sortOrder).toBe("asc");
    expect(vals(result.current.sorted)).toEqual([1, 2]);

    act(() => result.current.requestSort("v"));
    expect(result.current.sortOrder).toBe("desc");
    expect(vals(result.current.sorted)).toEqual([2, 1]);
  });

  it("uses a supplied accessor for computed columns", () => {
    const data = [{ a: { b: 2 } }, { a: { b: 1 } }];
    const accessors = { score: (r) => r.a.b };
    const { result } = renderHook(() =>
      useTableSort(data, { defaultKey: "score", defaultOrder: "asc", accessors })
    );
    expect(result.current.sorted.map((r) => r.a.b)).toEqual([1, 2]);
  });
});
