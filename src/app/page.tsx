"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Code2, Loader2, Network } from "lucide-react";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { WorkflowLogs } from "@/components/workflow/WorkflowLogs";
import { WorkflowSidebar } from "@/components/workflow/WorkflowSidebar";
import { StatusBadge, ScoreBar } from "@/components/status";
import type { JuryInput, JuryMode, JuryResult, RewriteResult } from "@/lib/jury/types";
import { createInitialSteps, workflowStepKeys } from "@/lib/workflow/nodeDefinitions";
import { sampleDocuments, sampleToWorkflowData } from "@/lib/workflow/samples";
import { cleanText } from "@/lib/workflow/runners/cleanText";
import { segmentText } from "@/lib/workflow/runners/segmentText";
import type {
  DocumentMetadata,
  GeneratedQuestion,
  TextSegment,
  WorkflowData,
  WorkflowLog,
  WorkflowStepKey,
  WorkflowStepState,
} from "@/lib/workflow/types";

const firstSample = sampleDocuments[0];

function nowTime() {
  return new Date().toLocaleTimeString();
}

function shortText(text: string, max = 420) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function sourceLabel(result?: { source?: "live" | "fallback" }) {
  return result?.source === "fallback" ? "Demo fallback" : "Live OpenRouter";
}

export default function Home() {
  const [steps, setSteps] = useState(createInitialSteps);
  const [data, setData] = useState<WorkflowData>(() => sampleToWorkflowData(firstSample));
  const dataRef = useRef<WorkflowData>(sampleToWorkflowData(firstSample));
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [selectedKey, setSelectedKey] = useState<WorkflowStepKey>("documentInput");
  const [selectedSampleId, setSelectedSampleId] = useState(firstSample.id);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(0);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const selectedStep = steps[selectedKey];
  const selectedQuestion = useMemo(
    () =>
      data.generatedQuestions?.find((question) => question.id === selectedQuestionId) ??
      data.generatedQuestions?.[0],
    [data.generatedQuestions, selectedQuestionId]
  );
  const latestJury = data.strictJuryResult ?? data.fastJuryResult;
  const appSourceLabel = sourceLabel(latestJury ?? selectedQuestion);

  const patchStep = (key: WorkflowStepKey, patch: Partial<WorkflowStepState>) => {
    setSteps((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...patch,
      },
    }));
  };

  const setWorkflowData = (next: WorkflowData | ((current: WorkflowData) => WorkflowData)) => {
    const value = typeof next === "function" ? next(dataRef.current) : next;
    dataRef.current = value;
    setData(value);
  };

  const log = (message: string, level: WorkflowLog["level"] = "info", step?: WorkflowStepKey) => {
    setLogs((items) => [
      {
        id: crypto.randomUUID(),
        timestamp: nowTime(),
        level,
        message,
        step,
      },
      ...items,
    ]);
  };

  const runGuarded = async <T,>(
    key: WorkflowStepKey,
    runner: () => Promise<{ output: T; summary: string; dataPatch?: Partial<WorkflowData> }>
  ) => {
    patchStep(key, { status: "running", startedAt: new Date().toISOString(), error: undefined });
    log(`Running ${steps[key].label}`, "info", key);
    try {
      const result = await runner();
      patchStep(key, {
        status: "success",
        completedAt: new Date().toISOString(),
        summary: result.summary,
        output: result.output,
      });
      if (result.dataPatch) {
        setWorkflowData((current) => ({ ...current, ...result.dataPatch }));
      }
      log(result.summary, "success", key);
      return result.output;
    } catch (error) {
      const message = error instanceof Error ? error.message : `${steps[key].label} failed.`;
      patchStep(key, { status: "error", error: message, completedAt: new Date().toISOString() });
      log(message, "error", key);
      throw error;
    }
  };

  const loadSample = (id: string) => {
    const sample = sampleDocuments.find((item) => item.id === id) ?? firstSample;
    setSelectedSampleId(sample.id);
    const sampleData = sampleToWorkflowData(sample);
    setWorkflowData(sampleData);
    setSteps({
      ...createInitialSteps(),
      documentInput: {
        ...createInitialSteps().documentInput,
        status: "success",
        summary: `Loaded ${sample.title}`,
        output: sampleData.document?.metadata,
      },
    });
    setSelectedSegmentIndex(0);
    setSelectedQuestionId(undefined);
    setGlobalError(null);
    log(`Loaded sample document: ${sample.title}`, "success", "documentInput");
  };

  const uploadFile = async (file: File) => {
    setBusy(true);
    setGlobalError(null);
    patchStep("documentInput", {
      status: "success",
      output: { name: file.name, kind: file.name.split(".").pop(), size: file.size },
      summary: `Uploaded ${file.name}`,
    });
    patchStep("textExtraction", { status: "running", error: undefined });
    log(`Uploading ${file.name}`, "info", "documentInput");

    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/document/extract", { method: "POST", body: form });
      const body = (await response.json()) as {
        text?: string;
        metadata?: DocumentMetadata;
        error?: string;
      };
      if (!response.ok || !body.text || !body.metadata) {
        throw new Error(body.error || "Document extraction failed.");
      }
      setWorkflowData({
        document: { metadata: body.metadata, rawText: body.text },
        extractedText: body.text,
      });
      patchStep("textExtraction", {
        status: "success",
        completedAt: new Date().toISOString(),
        summary: `Extracted ${body.metadata.wordCount ?? 0} words`,
        output: { metadata: body.metadata, preview: shortText(body.text) },
      });
      log(`Extracted text from ${file.name}`, "success", "textExtraction");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload extraction failed.";
      patchStep("textExtraction", { status: "error", error: message });
      setGlobalError(message);
      log(message, "error", "textExtraction");
    } finally {
      setBusy(false);
    }
  };

  const questionInput = (question: GeneratedQuestion, segment: TextSegment): JuryInput => ({
    excerpt: segment.analysisWindow.excerpt,
    question: question.question,
    answer: question.answer,
    exampleId: question.question.toLowerCase().includes("where is mara")
      ? "ambiguous-easy"
      : question.answer.toLowerCase().includes("orion")
        ? "bad-evidence"
        : "good",
  });

  const callJury = async (mode: JuryMode, question?: GeneratedQuestion, segment?: TextSegment) => {
    const current = dataRef.current;
    const juryQuestion = question ?? current.selectedQuestion ?? current.generatedQuestions?.[0];
    const jurySegment = segment ?? current.selectedSegment ?? current.segments?.[selectedSegmentIndex];
    if (!juryQuestion || !jurySegment) throw new Error("Generate and select a question before running jury.");
    const response = await fetch("/api/jury", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...questionInput(juryQuestion, jurySegment), mode }),
    });
    const body = (await response.json()) as {
      result?: JuryResult;
      error?: string;
      fallbackAvailable?: boolean;
    };
    if (!response.ok || !body.result) {
      if (body.fallbackAvailable) {
        const fallback = await fetch("/api/jury", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...questionInput(juryQuestion, jurySegment), mode, forceFallback: true }),
        });
        const fallbackBody = (await fallback.json()) as { result?: JuryResult; error?: string };
        if (fallback.ok && fallbackBody.result) {
          log(`Live ${mode} jury failed, used deterministic demo fallback.`, "error", mode === "fast" ? "fastJury" : "strictJury");
          return fallbackBody.result;
        }
      }
      throw new Error(body.error || `${mode} jury failed.`);
    }
    return body.result;
  };

  const runStep = async (key: WorkflowStepKey) => {
    if (busy) return;
    setBusy(true);
    setGlobalError(null);
    const currentData = dataRef.current;

    try {
      if (key === "documentInput") {
        await runGuarded("documentInput", async () => {
          const metadata = currentData.document?.metadata ?? sampleToWorkflowData(firstSample).document?.metadata;
          return {
            output: metadata,
            summary: `Document ready: ${metadata?.name ?? "sample"}`,
          };
        });
      }

      if (key === "textExtraction") {
        await runGuarded("textExtraction", async () => {
          const text = dataRef.current.extractedText ?? dataRef.current.document?.rawText;
          if (!text) throw new Error("Upload a document or choose a sample first.");
          return {
            output: { preview: shortText(text), wordCount: text.split(/\s+/).filter(Boolean).length },
            summary: `Text available with ${text.split(/\s+/).filter(Boolean).length} words`,
            dataPatch: { extractedText: text },
          };
        });
      }

      if (key === "cleaning") {
        await runGuarded("cleaning", async () => {
          if (!dataRef.current.extractedText) throw new Error("Run text extraction first.");
          const cleanedText = cleanText(dataRef.current.extractedText);
          return {
            output: { preview: shortText(cleanedText), characters: cleanedText.length },
            summary: `Cleaned text to ${cleanedText.length.toLocaleString()} characters`,
            dataPatch: { cleanedText },
          };
        });
      }

      if (key === "segmentation") {
        await runGuarded("segmentation", async () => {
          if (!dataRef.current.cleanedText) throw new Error("Run cleaning first.");
          const segments = segmentText(dataRef.current.cleanedText);
          if (segments.length === 0) throw new Error("No text segments were created.");
          setSelectedSegmentIndex(0);
          return {
            output: segments.map((segment) => ({
              index: segment.index,
              wordCount: segment.wordCount,
              excerpt: shortText(segment.analysisWindow.excerpt, 220),
            })),
            summary: `Created ${segments.length} segment${segments.length > 1 ? "s" : ""}`,
            dataPatch: { segments, selectedSegment: segments[0] },
          };
        });
      }

      if (key === "segmentSelection") {
        await runGuarded("segmentSelection", async () => {
          const segment = dataRef.current.segments?.[selectedSegmentIndex];
          if (!segment) throw new Error("Run segmentation first.");
          return {
            output: segment,
            summary: `Selected segment ${segment.index + 1} with ${segment.wordCount} words`,
            dataPatch: { selectedSegment: segment },
          };
        });
      }

      if (key === "questionGeneration") {
        await runGuarded("questionGeneration", async () => {
          const segment = dataRef.current.selectedSegment ?? dataRef.current.segments?.[selectedSegmentIndex];
          if (!segment) throw new Error("Select a segment first.");
          const response = await fetch("/api/questions/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ segment }),
          });
          let body = (await response.json()) as { questions?: GeneratedQuestion[]; error?: string };
          if (!response.ok || !body.questions) {
            const fallback = await fetch("/api/questions/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ segment, forceFallback: true }),
            });
            body = (await fallback.json()) as { questions?: GeneratedQuestion[]; error?: string };
            if (!fallback.ok || !body.questions) throw new Error(body.error || "Question generation failed.");
            log("Live question generation failed, used demo fallback.", "error", "questionGeneration");
          }
          setSelectedQuestionId(body.questions[0]?.id);
          return {
            output: body.questions,
            summary: `Generated ${body.questions.length} candidate question${body.questions.length > 1 ? "s" : ""}`,
            dataPatch: {
              generatedQuestions: body.questions,
              selectedQuestion: body.questions[0],
            },
          };
        });
      }

      if (key === "fastJury") {
        await runGuarded("fastJury", async () => {
          const result = await callJury("fast");
          return {
            output: result,
            summary: `Fast Jury returned ${result.finalDecision} with score ${result.globalScore}`,
            dataPatch: { fastJuryResult: result },
          };
        });
      }

      if (key === "strictJury") {
        await runGuarded("strictJury", async () => {
          const result = await callJury("strict");
          return {
            output: result,
            summary: `Strict Jury returned ${result.finalDecision} with score ${result.globalScore}`,
            dataPatch: { strictJuryResult: result },
          };
        });
      }

      if (key === "rewrite") {
        await runGuarded("rewrite", async () => {
          const question = dataRef.current.selectedQuestion ?? dataRef.current.generatedQuestions?.[0];
          const segment = dataRef.current.selectedSegment ?? dataRef.current.segments?.[selectedSegmentIndex];
          if (!question || !segment) throw new Error("Generate and select a question before rewriting.");
          const response = await fetch("/api/rewrite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...questionInput(question, segment),
              result: dataRef.current.strictJuryResult ?? dataRef.current.fastJuryResult
                ? {
                    finalDecision: (dataRef.current.strictJuryResult ?? dataRef.current.fastJuryResult)?.finalDecision ?? "rewrite",
                    summary: (dataRef.current.strictJuryResult ?? dataRef.current.fastJuryResult)?.summary ?? "No jury result.",
                    judges: (dataRef.current.strictJuryResult ?? dataRef.current.fastJuryResult)?.judges ?? [],
                  }
                : undefined,
            }),
          });
          let body = (await response.json()) as { rewrite?: RewriteResult; error?: string };
          if (!response.ok || !body.rewrite) {
            const fallback = await fetch("/api/rewrite", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...questionInput(question, segment), forceFallback: true }),
            });
            body = (await fallback.json()) as { rewrite?: RewriteResult; error?: string };
            if (!fallback.ok || !body.rewrite) throw new Error(body.error || "Rewrite failed.");
          }
          return {
            output: body.rewrite,
            summary: `Rewrite proposed: ${body.rewrite.question}`,
            dataPatch: { rewrittenQuestion: body.rewrite },
          };
        });
      }

      if (key === "finalOutput") {
        await runGuarded("finalOutput", async () => {
          const jury = dataRef.current.strictJuryResult ?? dataRef.current.fastJuryResult;
          const segment = dataRef.current.selectedSegment ?? dataRef.current.segments?.[selectedSegmentIndex];
          const question =
            dataRef.current.rewrittenQuestion && jury?.finalDecision === "rewrite"
              ? {
                  question: dataRef.current.rewrittenQuestion.question,
                  answer: dataRef.current.rewrittenQuestion.answer,
                }
              : dataRef.current.selectedQuestion ?? dataRef.current.generatedQuestions?.[0];
          if (!question || !segment) throw new Error("No question is ready for final output.");
          const finalApprovedQuestion = {
            question: question.question,
            answer: question.answer,
            sourceExcerpt: segment.analysisWindow.excerpt,
            jury,
          };
          return {
            output: finalApprovedQuestion,
            summary: "Final JSON output is ready.",
            dataPatch: { finalApprovedQuestion },
          };
        });
      }
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Workflow step failed.");
    } finally {
      setBusy(false);
    }
  };

  const runSequence = async (keys: WorkflowStepKey[]) => {
    for (const key of keys) {
      setSelectedKey(key);
      await runStep(key);
    }
  };

  const runFullWorkflow = async () => {
    await runSequence(workflowStepKeys);
  };

  const runFromSelected = async () => {
    const start = workflowStepKeys.indexOf(selectedKey);
    await runSequence(workflowStepKeys.slice(Math.max(0, start)));
  };

  const onSegmentChange = (index: number) => {
    setSelectedSegmentIndex(index);
    const segment = data.segments?.[index];
    if (segment) {
      setWorkflowData((current) => ({ ...current, selectedSegment: segment }));
      patchStep("segmentSelection", {
        status: "success",
        output: segment,
        summary: `Selected segment ${segment.index + 1}`,
      });
    }
  };

  const onQuestionChange = (id: string) => {
    setSelectedQuestionId(id);
    const question = data.generatedQuestions?.find((item) => item.id === id);
    if (question) setWorkflowData((current) => ({ ...current, selectedQuestion: question }));
  };

  const finalJson = {
    document: data.document?.metadata,
    finalApprovedQuestion: data.finalApprovedQuestion,
    generatedQuestions: data.generatedQuestions,
    fastJuryResult: data.fastJuryResult,
    strictJuryResult: data.strictJuryResult,
    rewrittenQuestion: data.rewrittenQuestion,
  };

  const copyFinalJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(finalJson, null, 2));
    log("Copied final JSON to clipboard.", "success", "finalOutput");
  };

  const exportFinalJson = () => {
    const blob = new Blob([JSON.stringify(finalJson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vread-workflow-output.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setSteps(createInitialSteps());
    setWorkflowData(sampleToWorkflowData(firstSample));
    setLogs([]);
    setSelectedKey("documentInput");
    setSelectedSampleId(firstSample.id);
    setSelectedSegmentIndex(0);
    setSelectedQuestionId(undefined);
    setGlobalError(null);
  };

  return (
    <main className="min-h-screen bg-[#05070c] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-4 p-4">
        <header className="rounded-[8px] border border-slate-800 bg-slate-950/95 p-5 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase text-cyan-200">
                <Network className="h-3.5 w-3.5" />
                VREAD workflow demo
              </div>
              <h1 className="text-3xl font-bold tracking-normal text-white md:text-5xl">
                VREAD Document Jury Workflow
              </h1>
              <p className="mt-2 max-w-4xl text-slate-400">
                Upload a PDF or EPUB, extract and segment text, generate candidate questions, run Fast and Strict LLM-as-a-Jury evaluation, rewrite weak questions, and export approved reading-comprehension output.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-bold uppercase text-slate-300">
                {appSourceLabel}
              </span>
              {busy && (
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-blue-400/10 px-3 py-1 text-xs font-bold uppercase text-blue-200">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Running
                </span>
              )}
            </div>
          </div>
        </header>

        {globalError && (
          <div className="flex gap-3 rounded-[8px] border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {globalError}
          </div>
        )}

        <section className="grid flex-1 gap-4 xl:grid-cols-[minmax(720px,1fr)_430px]">
          <div className="flex min-h-[760px] flex-col gap-4">
            <WorkflowCanvas steps={steps} selectedKey={selectedKey} onSelect={setSelectedKey} />

            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <WorkflowLogs logs={logs} />
              <div className="rounded-[8px] border border-slate-800 bg-[#070b12] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase text-slate-300">Jury Detail View</h2>
                  {latestJury && <StatusBadge decision={latestJury.finalDecision} compact />}
                </div>
                {!latestJury ? (
                  <div className="flex h-[220px] items-center justify-center rounded-[8px] border border-dashed border-slate-800 text-sm text-slate-500">
                    Run Fast Jury or Strict Jury to inspect judge scores here.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl font-bold text-white">{latestJury.globalScore}</div>
                      <ScoreBar score={latestJury.globalScore} />
                    </div>
                    <p className="text-sm text-slate-300">{latestJury.summary}</p>
                    <div className="grid max-h-[154px] gap-2 overflow-auto pr-1 md:grid-cols-2">
                      {latestJury.judges.map((judge) => (
                        <div key={judge.judge} className="rounded-[8px] border border-slate-800 bg-slate-950 p-3">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase text-slate-300">{judge.judge}</span>
                            <StatusBadge decision={judge.decision} compact />
                          </div>
                          <div className="text-lg font-bold text-white">{judge.score}</div>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-400">{judge.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <WorkflowSidebar
            samples={sampleDocuments}
            selectedSampleId={selectedSampleId}
            selectedStep={selectedStep}
            data={data}
            selectedSegmentIndex={selectedSegmentIndex}
            selectedQuestionId={selectedQuestion?.id}
            busy={busy}
            sourceLabel={appSourceLabel}
            onSampleChange={loadSample}
            onUpload={uploadFile}
            onRunFull={runFullWorkflow}
            onRunStep={runStep}
            onRunFromSelected={runFromSelected}
            onRunFastJury={() => runStep("fastJury")}
            onRunStrictJury={() => runStep("strictJury")}
            onRewrite={() => runStep("rewrite")}
            onCopy={copyFinalJson}
            onExport={exportFinalJson}
            onReset={reset}
            onSegmentChange={onSegmentChange}
            onQuestionChange={onQuestionChange}
          />
        </section>

        <section className="rounded-[8px] border border-slate-800 bg-slate-950 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Code2 className="h-4 w-4 text-cyan-300" />
            <h2 className="text-sm font-bold uppercase text-slate-300">Raw Workflow JSON</h2>
            {data.finalApprovedQuestion && <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
          </div>
          <pre className="max-h-[260px] overflow-auto rounded-[8px] bg-[#070b12] p-4 text-xs leading-relaxed text-slate-300">
            {JSON.stringify(finalJson, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
