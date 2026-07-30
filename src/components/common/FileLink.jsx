import { useState } from "react";
import { Loader2 } from "lucide-react";
import { resolveFileUrl } from "@/integrations/Core";
import { cn } from "@/lib/utils";

/**
 * Opens a stored file reference — a private-bucket storage path or an external
 * URL (see resolveFileUrl in src/integrations/Core.js).
 *
 * The bucket went private in migration 023, so a stored path is not directly
 * openable; it needs a signed URL. Signing happens on CLICK rather than on
 * render deliberately: a candidate list with 200 rows would otherwise fire 200
 * signing requests to produce links nobody clicks.
 *
 * @param {object} props
 * @param {string} props.value          stored path or absolute URL
 * @param {React.ReactNode} props.children  link text
 * @param {string} [props.className]
 */
export default function FileLink({ value, children, className, ...rest }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!value) return null;

  const open = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailed(false);

    // The tab must be opened synchronously inside the click handler — opening
    // it after the await is what popup blockers stop.
    const tab = window.open("", "_blank", "noopener,noreferrer");
    try {
      const url = await resolveFileUrl(value);
      if (!url) throw new Error("No file");
      if (tab) tab.location.href = url;
      else window.location.href = url; // popup blocked — navigate in place
    } catch {
      if (tab) tab.close();
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <a
      href="#"
      onClick={open}
      className={cn("inline-flex items-center gap-1.5", className)}
      title={failed ? "Could not open this file" : undefined}
      {...rest}
    >
      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {failed ? "Unavailable" : children}
    </a>
  );
}
