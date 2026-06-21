
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Trash2, Loader2 } from "lucide-react";

export default function DeleteConfirmModal({
  open,
  title = "Delete",
  message = "Are you sure you want to delete this record? This action cannot be undone.",
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  loading = false
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onCancel?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <Card className="w-full max-w-md relative" onClick={(e)=>e.stopPropagation()}>
        <Button aria-label="Close" variant="ghost" size="icon" onClick={onCancel} className="absolute top-2 right-2 text-red-600 hover:text-red-700">
          <X className="w-5 h-5" />
        </Button>
        <CardHeader className="flex items-center justify-between pr-12">
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-slate-700">{message}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={onConfirm} disabled={loading} className="gap-2 bg-red-600 hover:bg-red-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
