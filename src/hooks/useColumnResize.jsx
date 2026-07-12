import { useCallback } from "react";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

/**
 * Drag-to-resize column widths for any table — shadcn `<Table>` or a raw
 * `<table>` — persisted to localStorage per `tableId`.
 *
 * Widths live in a module-level store keyed by `tableId`, so every consumer of
 * the same table (the `DataTableProvider` for shadcn tables, or a page that
 * renders raw `<th>`s and calls this hook once) reads and writes the same
 * values. That's what keeps concurrent column edits from clobbering each other's
 * saved widths, and it's the single source of truth behind both header styles.
 *
 * Usage in a raw table (call once at page level, spread onto each `<th>`):
 *   const { widthFor, ResizeHandle } = useColumnResize("companies");
 *   <th className="relative group" style={{ width: widthFor("name") }}>
 *     Name <ResizeHandle colKey="name" />
 *   </th>
 */

const storageKey = (tableId) => `rx.tablewidths.${tableId}`;
const stores = new Map();

function getStore(tableId) {
  let store = stores.get(tableId);
  if (store) return store;

  let widths = {};
  try {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(storageKey(tableId))
        : null;
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") widths = parsed;
  } catch {
    /* corrupt/unavailable storage — start empty */
  }

  const listeners = new Set();
  store = {
    getSnapshot: () => widths,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    setWidth: (key, width) => {
      if (!key) return;
      widths = { ...widths, [key]: width };
      try {
        window.localStorage.setItem(storageKey(tableId), JSON.stringify(widths));
      } catch {
        /* private mode / quota — resizing still works for the session */
      }
      listeners.forEach((fn) => fn());
    },
  };
  stores.set(tableId, store);
  return store;
}

export function useColumnResize(tableId) {
  const store = getStore(tableId);
  const widths = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );

  const widthFor = useCallback((key) => widths[key], [widths]);

  const startResize = useCallback(
    (e, key) => {
      if (e.button !== 0) return; // left button only
      e.preventDefault();
      e.stopPropagation(); // don't let the drag toggle a sort
      // The handle sits inside the header cell — a shadcn <th> or a grid <div>;
      // its parent element is that cell in both cases.
      const cell = e.currentTarget.parentElement;
      const startX = e.clientX;
      const startWidth = cell?.offsetWidth ?? 0;

      const onMove = (ev) => {
        store.setWidth(key, Math.max(60, startWidth + (ev.clientX - startX)));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [store]
  );

  // Absolute-positioned grip for the right edge of a `relative` header cell.
  const ResizeHandle = useCallback(
    ({ colKey, className }) => (
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize column"
        onMouseDown={(e) => startResize(e, colKey)}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-primary/40 opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-60",
          className
        )}
      />
    ),
    [startResize]
  );

  return { widths, widthFor, setWidth: store.setWidth, ResizeHandle };
}
