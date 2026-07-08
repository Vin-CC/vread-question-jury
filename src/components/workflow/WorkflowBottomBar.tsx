import { Clipboard, Download, Play, RotateCcw, Sparkles, StepForward } from "lucide-react";
import { clsx } from "clsx";

export function WorkflowBottomBar({
  busy,
  modeLabel,
  hasFinalOutput,
  onRunOnce,
  onRunFull,
  onRunFromSelected,
  onReset,
  onExport,
  onCopy,
}: {
  busy: boolean;
  modeLabel: string;
  hasFinalOutput: boolean;
  onRunOnce: () => void;
  onRunFull: () => void;
  onRunFromSelected: () => void;
  onReset: () => void;
  onExport: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="fixed bottom-5 left-[calc(50%+36px)] z-30 flex max-w-[calc(100vw-104px)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-[28px] border border-white/80 bg-white/95 p-2 shadow-[0_24px_70px_rgba(79,70,229,0.18)] backdrop-blur">
      <button
        type="button"
        disabled={busy}
        onClick={onRunOnce}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-violet-200 hover:text-violet-700 disabled:opacity-50"
      >
        <StepForward className="h-4 w-4" />
        Run once
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onRunFull}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-black text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-700 disabled:opacity-50"
      >
        <Play className="h-4 w-4" />
        Run full workflow
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onRunFromSelected}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 transition hover:border-violet-200 hover:text-violet-700 disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        From selected
      </button>
      <div
        className={clsx(
          "inline-flex h-11 shrink-0 items-center rounded-2xl border px-4 text-xs font-black uppercase",
          modeLabel === "Fallback"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        )}
      >
        {modeLabel}
      </div>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:border-red-200 hover:text-red-600"
      >
        <RotateCcw className="h-4 w-4" />
        Reset
      </button>
      <button
        type="button"
        onClick={onExport}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-violet-200 hover:text-violet-700"
      >
        <Download className="h-4 w-4" />
        Export JSON
      </button>
      <button
        type="button"
        disabled={!hasFinalOutput}
        onClick={onCopy}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-violet-200 hover:text-violet-700 disabled:opacity-45"
      >
        <Clipboard className="h-4 w-4" />
        Copy final
      </button>
    </div>
  );
}
