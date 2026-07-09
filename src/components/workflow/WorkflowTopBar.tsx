import { ArrowLeft, CircleHelp, Download, Loader2, SlidersHorizontal } from "lucide-react";
import { aiProviderDisplayName } from "@/lib/ai/display";
import type { AiProviderName } from "@/lib/ai/types";

export function WorkflowTopBar({
  provider,
  modeLabel,
  model,
  busy,
  aiStatusError,
  onExport,
}: {
  provider?: AiProviderName;
  modeLabel: string;
  model?: string;
  busy: boolean;
  aiStatusError?: string | null;
  onExport: () => void;
}) {
  return (
    <header className="sticky top-4 z-30 mx-auto flex w-[min(1480px,calc(100vw-104px))] items-center justify-between gap-4 rounded-[28px] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_18px_50px_rgba(79,70,229,0.12)] backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-violet-200 hover:text-violet-700"
          title="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-black tracking-[0.18em] text-slate-950">
              VREAD QUESTION JURY
            </h1>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-violet-50 hover:text-violet-700"
              title="Workflow settings"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
          <div className="truncate text-xs font-medium text-slate-500">
            Document processing · AI jury · integrity checks · VREAD export
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 md:block">
          Provider: {aiProviderDisplayName(provider)}
        </div>
        <div className="hidden max-w-[260px] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 xl:block">
          <span className="text-slate-700">Model</span> {model ?? "not selected"}
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black uppercase text-violet-700">
          {modeLabel}
        </div>
        {busy && (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black uppercase text-blue-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Running
          </div>
        )}
        <button
          type="button"
          onClick={onExport}
          className="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
        <button
          type="button"
          title={aiStatusError || "Help"}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:border-violet-200 hover:text-violet-700"
        >
          <CircleHelp className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
