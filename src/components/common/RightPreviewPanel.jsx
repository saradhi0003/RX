import React from "react";
import { X, Sparkles } from "lucide-react";

export default function RightPreviewPanel({ open, title = "", onClose, children, className = "" }) {
  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-[100] pointer-events-auto">
      <div
        className={`absolute right-0 top-0 h-full w-full sm:w-[420px] md:w-[440px] lg:w-[460px] bg-white border-l border-slate-200 shadow-2xl transition-transform duration-200 ease-out ${open ? "translate-x-0" : "translate-x-full"} ${className}`}
      >
        {/* Brand accent strip */}
        <div
          style={{
            height: 3,
            background: "linear-gradient(90deg,#9333EA 0%,#2563EB 100%)",
          }}
        />

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#FAF5FF 0%,#EFF6FF 100%)" }}
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#9333EA" }} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[.08em]" style={{ color: "#9333EA" }}>
                Record
              </div>
              <h3 className="font-semibold text-slate-900 text-sm truncate -mt-0.5">
                {title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors flex-shrink-0"
            aria-label="Close preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className="overflow-auto px-5 py-4"
          style={{ height: "calc(100% - 3px - 56px)", background: "#FFFFFF" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
