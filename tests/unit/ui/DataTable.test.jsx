// Layer 17 (UX/UI): SortableHead — the shadcn-table header that sorts on click
// and exposes a drag-to-resize grip. Renders inside a DataTableProvider.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DataTableProvider, SortableHead } from "@/components/common/DataTable";

function renderTable(sort) {
  return render(
    <DataTableProvider tableId="datatable-test" sort={sort}>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead columnKey="name">Name</SortableHead>
            <SortableHead columnKey="actions" sortable={false}>Actions</SortableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>a</TableCell>
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </DataTableProvider>
  );
}

describe("SortableHead", () => {
  beforeEach(() => window.localStorage.clear());

  it("calls requestSort with the column key when a sortable header is clicked", async () => {
    const requestSort = vi.fn();
    renderTable({ sortKey: null, sortOrder: "desc", requestSort });
    await userEvent.click(screen.getByText("Name"));
    expect(requestSort).toHaveBeenCalledWith("name");
  });

  it("does not sort a column marked sortable={false}", async () => {
    const requestSort = vi.fn();
    renderTable({ sortKey: null, sortOrder: "desc", requestSort });
    await userEvent.click(screen.getByText("Actions"));
    expect(requestSort).not.toHaveBeenCalled();
  });

  it("marks the active column with aria-sort", () => {
    renderTable({ sortKey: "name", sortOrder: "asc", requestSort: vi.fn() });
    expect(screen.getByText("Name").closest("th")).toHaveAttribute("aria-sort", "ascending");
  });

  it("renders a resize grip on each resizable column", () => {
    renderTable({ sortKey: null, sortOrder: "desc", requestSort: vi.fn() });
    // Both columns carry a columnKey and are resizable → two separators.
    expect(screen.getAllByRole("separator")).toHaveLength(2);
  });
});
