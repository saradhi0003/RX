import React from "react";

export function emitEntityChanged(entity) {
  try {
    window.dispatchEvent(new CustomEvent("entity:changed", { detail: { entity } }));
    window.dispatchEvent(new CustomEvent(`entity:${entity}:changed`));
  } catch {
    /* CustomEvent may be unavailable in non-browser contexts */
  }
}

export function requestEntityRefresh(entity) {
  try {
    window.dispatchEvent(new CustomEvent("entity:refresh", { detail: { entity } }));
    window.dispatchEvent(new CustomEvent(`entity:${entity}:refresh`));
  } catch {
    /* CustomEvent may be unavailable in non-browser contexts */
  }
}

export function useEntityAutoRefresh(entity, reloadFn) {
  React.useEffect(() => {
    const h1 = (e) => {
      if (!e?.detail?.entity || e.detail.entity === entity) reloadFn?.();
    };
    const h2 = () => reloadFn?.();
    window.addEventListener("entity:refresh", h1);
    window.addEventListener(`entity:${entity}:refresh`, h2);
    window.addEventListener("entity:changed", h1);
    window.addEventListener(`entity:${entity}:changed`, h2);
    return () => {
      window.removeEventListener("entity:refresh", h1);
      window.removeEventListener(`entity:${entity}:refresh`, h2);
      window.removeEventListener("entity:changed", h1);
      window.removeEventListener(`entity:${entity}:changed`, h2);
    };
  }, [entity, reloadFn]);
  return () => requestEntityRefresh(entity);
}
