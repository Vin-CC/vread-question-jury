import { Clipboard, Download, FileText, Play, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import type { SampleDocument } from "@/lib/workflow/samples";
import type {
  GeneratedQuestion,
  TextSegment,
  WorkflowData,
  WorkflowStepKey,
  WorkflowStepState,
} from "@/lib/workflow/types";
import { ScoreBar, StatusBadge } from "@/components/status";

function JsonPreview({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[300px] overflow-auto rounded-[8px] border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-300">
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}

export function WorkflowSidebar({
  samples,
  selectedSampleId,
  selectedStep,
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
  onReset,
  onSegmentChange,
  onQuestionChange,
}: {
  samples: SampleDocument[];
  selectedSampleId: string;
  selectedStep: WorkflowStepState;
  data: WorkflowData;
  selectedSegmentIndex: number;
  selectedQuestionId?: string;
  busy: boolean;
  sourceLabel: "Live OpenRouter" | "Demo fallback";
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
  onReset: () => void;
  onSegmentChange: (index: number) => void;
  onQuestionChange: (id: string) => void;
}) {
  const segments = data.segments ?? [];
  const questions = data.generatedQuestions ?? [];
  const latestJury = data.strictJuryResult ?? data.fastJuryResult;
  const final = data.finalApprovedQuestion;

  return (
    <aside className="flex h-full flex-col gap-4 overflow-auto rounded-[8px] border border-slate-800 bg-slate-950/95 p-4 text-slate-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Workflow Control</h2>
          <p className="text-xs text-slate-400">Upload, run, inspect, export.</p>
        </div>
        <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200">
          {sourceLabel}
        </span>
      </div>

      <div className="grid gap-2">
        <label className="text-xs font-bold uppercase text-slate-400">Sample document</label>
        <select
          value={selectedSampleId}
          onChange={(event) => onSampleChange(event.target.value)}
          className="h-10 rounded-[8px] border border-slate-700 bg-slate-900 px-3 text-sm text-white"
        >
          {samples.map((sample) => (
            <option key={sample.id} value={sample.id}>
              {sample.title}
            </option>
          ))}
        </select>
        <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-dashed border-slate-600 bg-slate-900 text-sm font-semibold text-slate-200 hover:border-cyan-400">
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
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onRunFull}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-cyan-500 px-3 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          Run full
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRunFromSelected}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white hover:bg-slate-800"
        >
          <Sparkles className="h-4 w-4" />
          From node
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRunFastJury}
          className="h-10 rounded-[8px] border border-blue-500/40 bg-blue-500/10 text-sm font-bold text-blue-200"
        >
          Fast Jury
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRunStrictJury}
          className="h-10 rounded-[8px] border border-violet-500/40 bg-violet-500/10 text-sm font-bold text-violet-200"
        >
          Strict Jury
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRewrite}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-amber-500/40 bg-amber-500/10 text-sm font-bold text-amber-200"
        >
          <Wand2 className="h-4 w-4" />
          Rewrite
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-slate-700 bg-slate-900 text-sm font-bold text-white"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </div>

      {segments.length > 0 && (
        <div className="grid gap-2">
          <label className="text-xs font-bold uppercase text-slate-400">Selected segment</label>
          <select
            value={selectedSegmentIndex}
            onChange={(event) => onSegmentChange(Number(event.target.value))}
            className="h-10 rounded-[8px] border border-slate-700 bg-slate-900 px-3 text-sm text-white"
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
        <div className="grid gap-2">
          <label className="text-xs font-bold uppercase text-slate-400">Candidate question</label>
          <select
            value={selectedQuestionId}
            onChange={(event) => onQuestionChange(event.target.value)}
            className="h-10 rounded-[8px] border border-slate-700 bg-slate-900 px-3 text-sm text-white"
          >
            {questions.map((question: GeneratedQuestion) => (
              <option key={question.id} value={question.id}>
                {question.question}
              </option>
            ))}
          </select>
        </div>
      )}

      {latestJury && (
        <div className="rounded-[8px] border border-slate-800 bg-slate-900/80 p-3">
          <div className="mb-3 flex items-center justify-between">
            <StatusBadge decision={latestJury.finalDecision} compact />
            <span className="text-xs text-slate-400">{latestJury.source === "fallback" ? "Demo fallback" : "Live"}</span>
          </div>
          <div className="mb-2 flex items-center gap-3">
            <span className="text-3xl font-bold text-white">{latestJury.globalScore}</span>
            <ScoreBar score={latestJury.globalScore} />
          </div>
          <p className="text-sm text-slate-300">{latestJury.summary}</p>
        </div>
      )}

      {final && (
        <div className="rounded-[8px] border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="mb-2 text-xs font-bold uppercase text-emerald-200">Final approved output</div>
          <div className="text-sm font-bold text-white">{final.question}</div>
          <div className="mt-1 text-sm text-emerald-100">Answer: {final.answer}</div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onCopy}
              className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-emerald-400/40 px-3 text-xs font-bold text-emerald-100"
              type="button"
            >
              <Clipboard className="h-3.5 w-3.5" />
              Copy JSON
            </button>
            <button
              onClick={onExport}
              className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-emerald-400/40 px-3 text-xs font-bold text-emerald-100"
              type="button"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>
      )}

      <div className="mt-auto">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{selectedStep.label}</h3>
          <span className="text-xs uppercase text-slate-500">{selectedStep.status}</span>
        </div>
        <p className="mb-3 text-xs text-slate-400">{selectedStep.summary}</p>
        {selectedStep.error && (
          <div className="mb-3 rounded-[8px] border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {selectedStep.error}
          </div>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => onRunStep(selectedStep.key)}
          className="mb-3 h-9 w-full rounded-[8px] border border-slate-700 bg-slate-900 text-xs font-bold text-white"
        >
          Run selected step
        </button>
        <JsonPreview value={selectedStep.output ?? selectedStep.input ?? data.document?.metadata} />
      </div>
    </aside>
  );
}
