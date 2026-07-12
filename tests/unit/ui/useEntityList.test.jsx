// Layer 2 (Data) UX fix: entity list errors must surface, not blank the table.
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEntityList } from "@/hooks/useEntityList";
import EmptyState from "@/components/common/EmptyState";

describe("useEntityList", () => {
  it("loads data and clears loading", async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const { result } = renderHook(() => useEntityList(fetcher));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it("captures a thrown error and empties data", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("RLS denied"));
    const { result } = renderHook(() => useEntityList(fetcher));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("RLS denied");
    expect(result.current.data).toEqual([]);
  });

  it("reload() refetches and recovers from an error", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce([{ id: 1 }]);
    const { result } = renderHook(() => useEntityList(fetcher));

    await waitFor(() => expect(result.current.error).toBe("boom"));
    await act(() => result.current.reload());
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual([{ id: 1 }]);
  });

  it("normalizes a non-array result to []", async () => {
    const fetcher = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() => useEntityList(fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([]);
  });
});

describe("EmptyState", () => {
  it("renders the error variant with a retry action", async () => {
    const retry = vi.fn();
    render(<EmptyState error="Failed to load agents" action={{ label: "Retry", fn: retry }} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load agents");
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("renders the empty variant with title + description", () => {
    render(<EmptyState title="No agents yet" description="Create your first agent" />);
    expect(screen.getByText("No agents yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first agent")).toBeInTheDocument();
  });
});
