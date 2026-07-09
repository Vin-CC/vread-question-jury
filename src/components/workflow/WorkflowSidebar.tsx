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
import { aiModelDisplayName, aiProviderDisplayName, offlineReasonDisplay, runtimeModeDisplayName } from "@/lib/ai/display";
import type {
  GeneratedQuestion,
  InspectionAnchor,
  NodeInspectionMode,
  TextSegment,
  WorkflowData,
  WorkflowLog,
  WorkflowStepKey,
  WorkflowStepState,
} from "@/lib/workflow/types";

type InspectorTab = NodeInspectionMode;

const tabs: Array<{ key: InspectorTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "input", label: "Input" },
  { key: "output", label: "Output" },
  { key: "final", label: "Final" },
  { key: "logs", label: "Logs" },
];

function usageLabel(usage?: NonNullable<WorkflowLog["ai"]>["usage"]) {
  if (!usage) return undefined;
  return [
    usage.promptTokens !== undefined ? `in ${usage.promptTokens}` : undefined,
    usage.completionTokens !== undefined ? `out ${usage.completionTokens}` : undefined,
    usage.totalTokens !== undefined ? `total ${usage.totalTokens}` : undefined,
  ]
    .filter(Boolean)
    .join(" / ");
}

function LogsTab({ logs }: { logs: WorkflowLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
        No workflow events yet.
      </div>
    );
  }

  return (
    <div className="max-h-[520px] space-y-2 overflow-auto pr-1 font-mono text-xs">
      {logs.map((log) => {
        const usage = usageLabel(log.ai?.usage);
        return (
          <div key={log.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="flex gap-3">
              <span className="text-slate-400">{log.timestamp}</span>
              <span
                className={clsx(
                  "font-black",
                  log.level === "success" && "text-emerald-600",
                  log.level === "error" && "text-red-600",
                  log.level === "info" && "text-blue-600"
                )}
              >
                {log.level.toUpperCase()}
              </span>
              <span className="text-slate-700">{log.message}</span>
            </div>
            {log.ai && (
              <div className="mt-1 flex flex-wrap gap-2 pl-[92px] text-[11px] text-slate-500">
                {log.ai.requestedRunMode && <span>requested {runtimeModeDisplayName(log.ai.requestedRunMode)}</span>}
                <span>actualProvider {aiProviderDisplayName(log.ai.provider)}</span>
                <span>model {aiModelDisplayName(log.ai.model)}</span>
                <span>latency {log.ai.latencyMs}ms</span>
                {usage && <span>tokens {usage}</span>}
                {log.ai.fallbackReason && <span>offline {offlineReasonDisplay(log.ai.fallbackReason)}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function WorkflowSidebar({
  selectedStep,
  inspectionMode,
  data,
  logs,
  selectedSegmentIndex,
  selectedQuestionId,
  busy,
  sourceLabel,
  selectedModel,
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
  selectedStep: WorkflowStepState;
  inspectionMode: NodeInspectionMode;
  data: WorkflowData;
  logs: WorkflowLog[];
  selectedSegmentIndex: number;
  selectedQuestionId?: string;
  busy: boolean;
  sourceLabel: string;
  selectedModel?: string;
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

  const overviewValue = {
    key: selectedStep.key,
    label: selectedStep.label,
    status: selectedStep.status,
    summary: selectedStep.summary,
    provider: sourceLabel,
    model: aiModelDisplayName(selectedModel),
    runSummary,
    startedAt: selectedStep.startedAt,
    completedAt: selectedStep.completedAt,
    error: selectedStep.error,
  };

  const inspectorValue =
    inspectionMode === "input"
      ? selectedStep.input
      : inspectionMode === "output"
        ? selectedStep.output
        : overviewValue;

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">Inspector</div>
            <h2 className="mt-1 text-lg font-black text-slate-950">{selectedStep.label}</h2>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{selectedStep.summary}</p>
          </div>
          <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-black uppercase text-violet-700">
            {sourceLabel}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const available =
              tab.key === "overview" ||
              tab.key === "final" ||
              tab.key === "logs" ||
              (tab.key === "input" ? hasInput : hasOutput);
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onInspectionModeChange(tab.key)}
                className={clsx(
                  "h-9 rounded-2xl border px-3 text-xs font-black transition",
                  inspectionMode === tab.key && "border-violet-300 bg-violet-600 text-white shadow-lg shadow-violet-600/20",
                  inspectionMode !== tab.key && available && "border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-200",
                  inspectionMode !== tab.key && !available && "border-slate-100 bg-slate-50 text-slate-400"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {inspectionMode === "final" ? (
          <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Final output</div>
            {!final ? (
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-white/70 p-4 text-sm font-semibold text-emerald-700">
                Run Integrity, VREAD Export, and Final Output to populate this tab.
              </div>
            ) : (
              <div>
                <div className="text-base font-black text-slate-950">{final.question}</div>
                <div className="mt-2 rounded-2xl bg-white p-3 text-sm text-emerald-800">
                  <span className="font-black">Answer:</span> {final.answer}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl bg-white p-3">
                    <div className="text-xs font-bold uppercase text-slate-400">Jury score</div>
                    <div className="text-xl font-black text-slate-950">{final.jury?.globalScore ?? "Pending"}</div>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <div className="text-xs font-bold uppercase text-slate-400">Integrity</div>
                    <div className="text-xl font-black uppercase text-slate-950">{final.integrity?.status ?? integrity?.status ?? "pending"}</div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 text-xs font-black uppercase text-slate-500">Source excerpt</div>
                  <div className="max-h-[180px] overflow-auto rounded-2xl bg-white p-3 text-sm leading-relaxed text-slate-700">
                    {final.sourceExcerpt}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={onCopy} className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white text-xs font-black text-emerald-700" type="button">
                    <Clipboard className="h-3.5 w-3.5" />
                    Copy JSON
                  </button>
                  <button onClick={onExport} className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white text-xs font-black text-emerald-700" type="button">
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </button>
                </div>
                {exportBundle && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button onClick={onExportVreadJson} className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-white text-xs font-black text-cyan-700" type="button">
                      <Database className="h-3.5 w-3.5" />
                      VREAD
                    </button>
                    <button onClick={onCopySqlPreview} className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white text-xs font-black text-amber-700" type="button">
                      <Clipboard className="h-3.5 w-3.5" />
                      SQL
                    </button>
                    <button onClick={onCopyVreadJson} className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-white text-xs font-black text-cyan-700" type="button">
                      <Clipboard className="h-3.5 w-3.5" />
                      Copy VREAD JSON
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        ) : inspectionMode === "logs" ? (
          <LogsTab logs={logs} />
        ) : (
          <DataViewer
            value={inspectorValue}
            error={inspectionMode === "overview" ? selectedStep.error : undefined}
            emptyMessage={`No ${inspectionMode} data has been captured for this module yet.`}
          />
        )}

        <section className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
            <FileText className="h-4 w-4 text-violet-600" />
            Document source
          </div>
          <p className="mb-3 text-xs font-semibold leading-5 text-slate-500">
            {data.document?.metadata
              ? "Uploaded document ready for extraction and LLM steps."
              : "Upload a PDF or EPUB to start the workflow."}
          </p>
          {data.document?.metadata && (
            <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-600">
              <div className="font-black text-slate-900">{data.document.metadata.name}</div>
              <div className="mt-1 flex flex-wrap gap-2">
                <span>{data.document.metadata.kind.toUpperCase()}</span>
                {data.document.metadata.wordCount !== undefined && (
                  <span>{data.document.metadata.wordCount.toLocaleString()} words</span>
                )}
                {data.document.metadata.size !== undefined && (
                  <span>{Math.round(data.document.metadata.size / 1024).toLocaleString()} KB</span>
                )}
              </div>
            </div>
          )}
          <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-200 bg-white text-sm font-black text-violet-700 transition hover:border-violet-400 hover:bg-violet-50">
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
          <button type="button" disabled={busy} onClick={() => onRunStep(selectedStep.key)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-black text-white transition hover:bg-violet-700 disabled:opacity-50">
            <Play className="h-4 w-4" />
            Run selected
          </button>
          <button type="button" disabled={busy} onClick={onRunFull} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-violet-600 text-sm font-black text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 disabled:opacity-50">
            <Play className="h-4 w-4" />
            Run full
          </button>
          <button type="button" disabled={busy} onClick={onRunFromSelected} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:border-violet-200 hover:text-violet-700">
            <Sparkles className="h-4 w-4" />
            From step
          </button>
          <button type="button" onClick={onReset} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700">
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button type="button" disabled={busy} onClick={onRunFastJury} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 text-sm font-black text-blue-700">
            <Gavel className="h-4 w-4" />
            Fast Jury
          </button>
          <button type="button" disabled={busy} onClick={onRunStrictJury} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-purple-200 bg-purple-50 text-sm font-black text-purple-700">
            <Gavel className="h-4 w-4" />
            Strict Jury
          </button>
          <button type="button" disabled={busy} onClick={onRewrite} className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 text-sm font-black text-orange-700">
            <Wand2 className="h-4 w-4" />
            Rewrite
          </button>
        </section>

        {latestJury && inspectionMode !== "final" && (
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
      </div>
    </aside>
  );
}
