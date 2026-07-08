import {
  Clipboard,
  Database,
  Download,
  FileText,
  Gavel,
  Play,
  RotateCcw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { clsx } from "clsx";
import { DataViewer } from "@/components/workflow/DataViewer";
import { ScoreBar, StatusBadge } from "@/components/status";
import type { SampleDocument } from "@/lib/workflow/samples";
import type {
  GeneratedQuestion,
  InspectionAnchor,
  NodeInspectionMode,
  TextSegment,
  WorkflowData,
  WorkflowStepKey,
  WorkflowStepState,
} from "@/lib/workflow/types";

export function WorkflowSidebar({
  samples,
  selectedSampleId,
  selectedStep,
  inspectionMode,
  data,
  selectedSegmentIndex,
  selectedQuestionId,
  busy,
  sourceLabel,
  onSampleChange,
  onUpload,
  onRunFull,
  onRunStep,
  onRunFromSelected,
  onRunFastJury,
  onRunStrictJury,
  onRewrite,
  onCopy,
  onExport,
  onCopyVreadJson,
  onExportVreadJson,
  onCopySqlPreview,
  onReset,
  onSegmentChange,
  onQuestionChange,
  onInspectionModeChange,
}: {
  samples: SampleDocument[];
  selectedSampleId: string;
  selectedStep: WorkflowStepState;
  inspectionMode: NodeInspectionMode;
  data: WorkflowData;
  selectedSegmentIndex: number;
  selectedQuestionId?: string;
  busy: boolean;
  sourceLabel: string;
  onSampleChange: (id: string) => void;
  onUpload: (file: File) => void;
  onRunFull: () => void;
  onRunStep: (key: WorkflowStepKey) => void;
  onRunFromSelected: () => void;
  onRunFastJury: () => void;
  onRunStrictJury: () => void;
  onRewrite: () => void;
  onCopy: () => void;
  onExport: () => void;
  onCopyVreadJson: () => void;
  onExportVreadJson: () => void;
  onCopySqlPreview: () => void;
  onReset: () => void;
  onSegmentChange: (index: number) => void;
  onQuestionChange: (id: string) => void;
  onInspectionModeChange: (mode: NodeInspectionMode) => void;
  onOpenInspection: (mode: NodeInspectionMode, anchor?: InspectionAnchor) => void;
}) {
  const segments = data.segments ?? [];
  const questions = data.generatedQuestions ?? [];
  const latestJury = data.strictJuryResult ?? data.fastJuryResult;
  const final = data.finalApprovedQuestion;
  const integrity = data.integrityReport;
  const exportBundle = data.vreadExport;
  const runSummary = data.runSummary;
  const hasInput = selectedStep.input !== undefined;
  const hasOutput = selectedStep.output !== undefined;
  const inspectionValue =
    inspectionMode === "input"
      ? selectedStep.input
      : inspectionMode === "output"
        ? selectedStep.output
        : {
            key: selectedStep.key,
            label: selectedStep.label,
            status: selectedStep.status,
            summary: selectedStep.summary,
            startedAt: selectedStep.startedAt,
            completedAt: selectedStep.completedAt,
            error: selectedStep.error,
          };

  return (
    <aside className="flex h-full min-h-[620px] flex-col overflow-hidden rounded-[32px] border border-white bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
      <div className="border-b border-slate-100 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">Scenario</div>
            <h2 className="mt-1 text-xl font-black text-slate-950">Workflow panel</h2>
            <p className="mt-1 text-sm text-slate-500">Configure inputs, inspect modules, and export results.</p>
          </div>
          <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-black uppercase text-violet-700">
            {sourceLabel}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
            <FileText className="h-4 w-4 text-violet-600" />
            Document source
          </div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Sample document</label>
          <select
            value={selectedSampleId}
            onChange={(event) => onSampleChange(event.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          >
            {samples.map((sample) => (
              <option key={sample.id} value={sample.id}>
                {sample.title}
              </option>
            ))}
          </select>
          <label className="mt-3 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-200 bg-white text-sm font-black text-violet-700 transition hover:border-violet-400 hover:bg-violet-50">
            <FileText className="h-4 w-4" />
            Upload PDF / EPUB
            <input
              type="file"
              accept=".pdf,.epub,application/pdf,application/epub+zip"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file);
              }}
            />
          </label>
        </section>

        <section className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Selected module</div>
              <h3 className="text-lg font-black text-slate-950">{selectedStep.label}</h3>
            </div>
            <span
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-black uppercase",
                selectedStep.status === "success" && "bg-emerald-50 text-emerald-700",
                selectedStep.status === "running" && "bg-blue-50 text-blue-700",
                selectedStep.status === "error" && "bg-red-50 text-red-700",
                selectedStep.status === "idle" && "bg-slate-100 text-slate-500"
              )}
            >
              {selectedStep.status}
            </span>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {(["overview", "input", "output"] as const).map((mode) => {
              const available = mode === "overview" || (mode === "input" ? hasInput : hasOutput);
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onInspectionModeChange(mode)}
                  className={clsx(
                    "h-10 rounded-2xl border text-xs font-black capitalize transition",
                    inspectionMode === mode && "border-violet-300 bg-violet-600 text-white shadow-lg shadow-violet-600/20",
                    inspectionMode !== mode && available && "border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-200",
                    inspectionMode !== mode && !available && "border-slate-100 bg-slate-50 text-slate-400"
                  )}
                >
                  {mode === "overview" ? "Overview" : mode}
                </button>
              );
            })}
          </div>
          <DataViewer
            value={inspectionValue}
            error={selectedStep.error}
            emptyMessage={`No ${inspectionMode} data has been captured for this module yet.`}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => onRunStep(selectedStep.key)}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-black text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            Run selected module
          </button>
        </section>

        {(segments.length > 0 || questions.length > 0) && (
          <section className="mt-4 grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            {segments.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Selected segment</label>
                <select
                  value={selectedSegmentIndex}
                  onChange={(event) => onSegmentChange(Number(event.target.value))}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none"
                >
                  {segments.map((segment: TextSegment) => (
                    <option key={segment.index} value={segment.index}>
                      Segment {segment.index + 1} · {segment.wordCount} words
                    </option>
                  ))}
                </select>
              </div>
            )}

            {questions.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Candidate question</label>
                <select
                  value={selectedQuestionId}
                  onChange={(event) => onQuestionChange(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none"
                >
                  {questions.map((question: GeneratedQuestion) => (
                    <option key={question.id} value={question.id}>
                      {question.question}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>
        )}

        <section className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onRunFull}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-violet-600 text-sm font-black text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            Run full
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onRunFromSelected}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:border-violet-200 hover:text-violet-700"
          >
            <Sparkles className="h-4 w-4" />
            From step
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onRunFastJury}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 text-sm font-black text-blue-700"
          >
            <Gavel className="h-4 w-4" />
            Fast Jury
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onRunStrictJury}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-purple-200 bg-purple-50 text-sm font-black text-purple-700"
          >
            <Gavel className="h-4 w-4" />
            Strict Jury
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onRewrite}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 text-sm font-black text-orange-700"
          >
            <Wand2 className="h-4 w-4" />
            Rewrite
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </section>

        {latestJury && (
          <section className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-black text-slate-950">Jury result</div>
              <StatusBadge decision={latestJury.finalDecision} compact />
            </div>
            <div className="mb-2 flex items-center gap-3">
              <span className="text-4xl font-black text-slate-950">{latestJury.globalScore}</span>
              <ScoreBar score={latestJury.globalScore} />
            </div>
            <p className="text-sm leading-relaxed text-slate-600">{latestJury.summary}</p>
          </section>
        )}

        {integrity && (
          <section className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-black text-slate-950">Integrity checks</div>
              <span
                className={clsx(
                  "rounded-full px-3 py-1 text-xs font-black uppercase",
                  integrity.status === "pass" && "bg-emerald-50 text-emerald-700",
                  integrity.status === "warning" && "bg-amber-50 text-amber-700",
                  integrity.status === "fail" && "bg-red-50 text-red-700"
                )}
              >
                {integrity.status}
              </span>
            </div>
            <p className="text-sm text-slate-600">{integrity.summary}</p>
          </section>
        )}

        {runSummary && (
          <section className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="mb-3 text-sm font-black text-slate-950">Local run summary</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs font-bold uppercase text-slate-400">Steps</div>
                <div className="font-black text-slate-950">{runSummary.successfulSteps}/{runSummary.numberOfSteps}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs font-bold uppercase text-slate-400">Duration</div>
                <div className="font-black text-slate-950">
                  {runSummary.durationMs === undefined ? "Running" : `${(runSummary.durationMs / 1000).toFixed(1)}s`}
                </div>
              </div>
            </div>
          </section>
        )}

        {final && (
          <section className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Final output</div>
            <div className="text-sm font-black text-slate-950">{final.question}</div>
            <div className="mt-1 text-sm text-emerald-800">Answer: {final.answer}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={onCopy}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white text-xs font-black text-emerald-700"
                type="button"
              >
                <Clipboard className="h-3.5 w-3.5" />
                Copy JSON
              </button>
              <button
                onClick={onExport}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white text-xs font-black text-emerald-700"
                type="button"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
            </div>
            {exportBundle && (
              <div className="mt-2 grid gap-2">
                <button
                  onClick={onCopyVreadJson}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-white text-xs font-black text-cyan-700"
                  type="button"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  Copy VREAD JSON
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={onExportVreadJson}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-white text-xs font-black text-cyan-700"
                    type="button"
                  >
                    <Database className="h-3.5 w-3.5" />
                    Export VREAD
                  </button>
                  <button
                    onClick={onCopySqlPreview}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white text-xs font-black text-amber-700"
                    type="button"
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                    Copy SQL
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}
