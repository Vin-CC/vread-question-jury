"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type {
  InspectionAnchor,
  NodeInspectionMode,
  WorkflowStepState,
} from "@/lib/workflow/types";
import { DataViewer } from "./DataViewer";

function resolvePosition(anchor?: InspectionAnchor) {
  if (typeof window === "undefined") return { left: 24, top: 24 };

  const width = 560;
  const height = 560;
  const margin = 16;
  const fallback = {
    x: window.innerWidth - width - margin,
    y: margin,
  };
  const base = anchor ?? fallback;

  return {
    left: Math.min(Math.max(margin, base.x), window.innerWidth - width - margin),
    top: Math.min(Math.max(margin, base.y - 24), window.innerHeight - height - margin),
  };
}

export function InspectionPopover({
  open,
  step,
  mode,
  anchor,
  fallbackValue,
  onClose,
  onModeChange,
}: {
  open: boolean;
  step: WorkflowStepState;
  mode: NodeInspectionMode;
  anchor?: InspectionAnchor;
  fallbackValue?: unknown;
  onClose: () => void;
  onModeChange: (mode: NodeInspectionMode) => void;
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const title =
    mode === "input"
      ? `Input · ${step.label}`
      : mode === "output"
        ? `Output · ${step.label}`
        : `Summary · ${step.label}`;
  const modeDescription =
    mode === "input"
      ? "Showing the data that entered this workflow step."
      : mode === "output"
        ? "Showing the data produced by this workflow step."
        : "Showing the best available summary for this step: output first, then input, then document metadata.";
  const value =
    mode === "input"
      ? step.input
      : mode === "output"
        ? step.output
        : step.output ?? step.input ?? fallbackValue;
  const emptyMessage =
    mode === "input"
      ? "No input available yet. Run the previous workflow step first."
      : mode === "output"
        ? "No output available yet. Run this workflow step first."
        : "No details available yet. Run this workflow step first.";
  const hasInput = step.input !== undefined;
  const hasOutput = step.output !== undefined;
  const position = resolvePosition(anchor);

  return createPortal(
    <div
      className="fixed z-50 flex max-h-[560px] w-[560px] max-w-[calc(100vw-32px)] flex-col rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.20)]"
      style={{ left: position.left, top: position.top }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">Floating module inspection</div>
          <h2 className="mt-1 text-lg font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{step.summary}</p>
          <p className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            {modeDescription}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-violet-700"
          aria-label="Close inspection popover"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-slate-100 p-4">
        <div className="grid max-w-md grid-cols-3 gap-2">
          {(["overview", "input", "output"] as const).map((tab) => {
            const available = tab === "overview" || (tab === "input" ? hasInput : hasOutput);
            const active = mode === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onModeChange(tab)}
                className={`h-9 rounded-[8px] border text-xs font-bold capitalize transition ${
                  active
                    ? "border-violet-300 bg-violet-600 text-white"
                    : available
                      ? "border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-200"
                      : "border-slate-100 bg-slate-50 text-slate-400"
                }`}
              >
                {tab === "overview" ? "Summary" : tab}
                {tab !== "overview" && (
                  <span
                    className={`ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                      available ? "bg-emerald-400" : "bg-slate-300"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <DataViewer
          value={value}
          emptyMessage={emptyMessage}
          error={mode === "overview" ? step.error : undefined}
        />
      </div>
    </div>,
    document.body
  );
}
