import React, { createContext, useContext, useMemo } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useColumnResize } from "@/hooks/useColumnResize";

/**
 * Sortable + resizable behavior for the shadcn `<Table>` without forking it.
 *
 * Wrap a table in `<DataTableProvider tableId="…" sort={useTableSort(...)}>` and
 * swap each `<TableHead>` for `<SortableHead columnKey="field">`. Column widths
 * are owned by `useColumnResize` (persisted to localStorage under `tableId`);
 * the same hook powers raw `<table>` pages, so both header styles resize
 * identically. `tableId` must be stable and unique per screen — it's the storage
 * key for the user's saved column widths.
 */

const DataTableContext = createContext(null);

/**
 * @param {object} props
 * @param {string} props.tableId  stable key for persisting column widths
 * @param {{ sortKey: string|null, sortOrder: "asc"|"desc",
 *           requestSort: (key: string) => void }} [props.sort]
 *        result of `useTableSort`; omit for a resize-only table
 * @param {React.ReactNode} props.children
 */
export function DataTableProvider({ tableId, sort, children }) {
  const { widthFor, ResizeHandle } = useColumnResize(tableId);

  const value = useMemo(
    () => ({
      widthFor,
      ResizeHandle,
      sortKey: sort?.sortKey ?? null,
      sortOrder: sort?.sortOrder ?? "desc",
      requestSort: sort?.requestSort,
    }),
    [widthFor, ResizeHandle, sort?.sortKey, sort?.sortOrder, sort?.requestSort]
  );

  return (
    <DataTableContext.Provider value={value}>
      {children}
    </DataTableContext.Provider>
  );
}

/**
 * A `<TableHead>` that sorts on click and can be drag-resized from its right
 * edge. Must be used inside a `<DataTableProvider>`.
 *
 * @param {object} props
 * @param {string} props.columnKey        field key — used for sort + width storage
 * @param {boolean} [props.sortable=true]  set false for action/checkbox columns
 * @param {boolean} [props.resizable=true]
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children header label
 */
export function SortableHead({
  columnKey,
  sortable = true,
  resizable = true,
  className,
  children,
  ...props
}) {
  const ctx = useContext(DataTableContext);

  const canSort = sortable && !!columnKey && !!ctx?.requestSort;
  const isActive = canSort && ctx.sortKey === columnKey;
  const width = ctx?.widthFor?.(columnKey);
  const ResizeHandle = ctx?.ResizeHandle;

  return (
    <TableHead
      className={cn(
        "group relative select-none",
        canSort && "cursor-pointer",
        className
      )}
      style={width ? { width, minWidth: width } : undefined}
      onClick={canSort ? () => ctx.requestSort(columnKey) : undefined}
      aria-sort={
        isActive ? (ctx.sortOrder === "asc" ? "ascending" : "descending") : undefined
      }
      {...props}
    >
      <div className="flex items-center gap-1 pr-1.5">
        <span className="truncate">{children}</span>
        {canSort &&
          (isActive ? (
            ctx.sortOrder === "asc" ? (
              <ChevronUp className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            )
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-40" />
          ))}
      </div>
      {resizable && columnKey && ResizeHandle && <ResizeHandle colKey={columnKey} />}
    </TableHead>
  );
}
