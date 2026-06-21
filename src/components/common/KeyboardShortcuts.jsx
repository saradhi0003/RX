import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function KeyboardShortcuts({ open, onClose }) {
  const shortcuts = [
    { category: "Navigation", items: [
      { keys: ["⌘", "K"], description: "Open command palette" },
      { keys: ["G", "D"], description: "Go to Dashboard" },
      { keys: ["G", "C"], description: "Go to Candidates" },
      { keys: ["G", "J"], description: "Go to Jobs" },
      { keys: ["G", "A"], description: "Go to Applications" },
    ]},
    { category: "Actions", items: [
      { keys: ["C"], description: "Create new (context-aware)" },
      { keys: ["E"], description: "Edit selected" },
      { keys: ["⌘", "S"], description: "Save" },
      { keys: ["Esc"], description: "Close/Cancel" },
    ]},
    { category: "Selection", items: [
      { keys: ["⌘", "A"], description: "Select all" },
      { keys: ["↑", "↓"], description: "Navigate items" },
      { keys: ["Enter"], description: "Open/Select" },
    ]},
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 max-h-[70vh] overflow-y-auto">
          {shortcuts.map((section, i) => (
            <div key={i}>
              <h3 className="font-semibold text-sm text-slate-700 mb-3">{section.category}</h3>
              <div className="space-y-2">
                {section.items.map((item, j) => (
                  <div key={j} className="flex items-center justify-between py-2 px-3 rounded hover:bg-slate-50">
                    <span className="text-sm text-slate-700">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, k) => (
                        <div key={k}>
                          <kbd className="px-2 py-1 text-xs bg-slate-100 border border-slate-300 rounded">
                            {key}
                          </kbd>
                          {k < item.keys.length - 1 && <span className="text-slate-400 text-xs mx-1">+</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-500 pt-4 border-t">
          Press <kbd className="px-2 py-1 bg-slate-100 rounded">?</kbd> to toggle this help
        </div>
      </DialogContent>
    </Dialog>
  );
}