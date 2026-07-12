// Layer 17 (UX/UI): the persisted column-width store shared by shadcn tables
// (via DataTableProvider) and raw grid pages (Companies/Tasks). Uses a unique
// tableId per test so the module-level store never leaks between cases.
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useColumnResize } from "@/hooks/useColumnResize";

const freshId = (p) => `${p}-${Math.random().toString(36).slice(2)}`;
const keyOf = (id) => `rx.tablewidths.${id}`;

describe("useColumnResize", () => {
  it("persists a width to localStorage and reflects it via widthFor", () => {
    const id = freshId("persist");
    const { result } = renderHook(() => useColumnResize(id));

    act(() => result.current.setWidth("name", 240));

    expect(JSON.parse(window.localStorage.getItem(keyOf(id)))).toEqual({ name: 240 });
    expect(result.current.widthFor("name")).toBe(240);
  });

  it("re-applies a previously saved width on mount", () => {
    const id = freshId("seed");
    window.localStorage.setItem(keyOf(id), JSON.stringify({ title: 180 }));

    const { result } = renderHook(() => useColumnResize(id));
    expect(result.current.widthFor("title")).toBe(180);
  });

  it("keeps independent widths per column without clobbering", () => {
    const id = freshId("multi");
    const { result } = renderHook(() => useColumnResize(id));

    act(() => result.current.setWidth("a", 100));
    act(() => result.current.setWidth("b", 200));

    expect(result.current.widthFor("a")).toBe(100);
    expect(result.current.widthFor("b")).toBe(200);
    expect(JSON.parse(window.localStorage.getItem(keyOf(id)))).toEqual({ a: 100, b: 200 });
  });
});
