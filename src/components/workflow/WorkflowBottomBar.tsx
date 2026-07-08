import { Clipboard, Download, Play, RotateCcw, Sparkles, StepForward } from "lucide-react";
import { clsx } from "clsx";
import type { RuntimeRunMode } from "@/lib/ai/types";

export function WorkflowBottomBar({
  busy,
  modeLabel,
  runtimeRunMode,
  hasFinalOutput,
  onRunModeChange,
  onRunOnce,
  onRunFull,
  onRunFromSelected,
  onReset,
  onExport,
  onCopy,
}: {
  busy: boolean;
  modeLabel: string;
  runtimeRunMode: RuntimeRunMode;
  hasFinalOutput: boolean;
  onRunModeChange: (mode: RuntimeRunMode) => void;
  onRunOnce: () => void;
  onRunFull: () => void;
  onRunFromSelected: () => void;
  onReset: () => void;
  onExport: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="fixed bottom-5 left-1/2 z-30 flex w-fit -translate-x-1/2 flex-nowrap items-center justify-center gap-1.5 rounded-[28px] border border-white/80 bg-white/95 p-1.5 shadow-[0_24px_70px_rgba(79,70,229,0.18)] backdrop-blur">
      <button
        type="button"
        disabled={busy}
        onClick={onRunOnce}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-violet-200 hover:text-violet-700 disabled:opacity-50"
      >
        <StepForward className="h-4 w-4" />
        Run selected
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onRunFull}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-2xl bg-violet-600 px-4 text-xs font-black text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-700 disabled:opacity-50"
      >
        <Play className="h-4 w-4" />
        Run full workflow
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onRunFromSelected}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 transition hover:border-violet-200 hover:text-violet-700 disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        From selected
      </button>
      <div className="inline-flex h-10 shrink-0 items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
        {(["demo", "live"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            disabled={busy}
            onClick={() => onRunModeChange(mode)}
            className={clsx(
              "h-8 rounded-xl px-2.5 text-[11px] font-black uppercase transition",
              runtimeRunMode === mode
                ? mode === "demo"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-emerald-600 text-white shadow-sm"
                : "text-slate-500 hover:bg-white hover:text-violet-700"
            )}
          >
            {mode === "demo" ? "Demo" : "Live"}
          </button>
        ))}
        <span
          className={clsx(
            "ml-0.5 pr-1.5 text-[10px] font-black uppercase",
          runtimeRunMode === "demo" ? "text-amber-700" : "text-emerald-700"
          )}
        >
          {modeLabel}
        </span>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-red-200 hover:text-red-600"
      >
        <RotateCcw className="h-4 w-4" />
        Reset
      </button>
      <button
        type="button"
        onClick={onExport}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-violet-200 hover:text-violet-700"
      >
        <Download className="h-4 w-4" />
        Export JSON
      </button>
      <button
        type="button"
        disabled={!hasFinalOutput}
        onClick={onCopy}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-violet-200 hover:text-violet-700 disabled:opacity-45"
      >
        <Clipboard className="h-4 w-4" />
        Copy final
      </button>
    </div>
  );
}
