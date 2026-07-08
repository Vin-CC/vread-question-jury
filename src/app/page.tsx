"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Clipboard, Database, Download, FileJson, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { InspectionPopover } from "@/components/workflow/InspectionPopover";
import { WorkflowLogs } from "@/components/workflow/WorkflowLogs";
import { WorkflowSidebar } from "@/components/workflow/WorkflowSidebar";
import { WorkflowTopBar } from "@/components/workflow/WorkflowTopBar";
import { WorkflowBottomBar } from "@/components/workflow/WorkflowBottomBar";
import type { AiProviderName, AiPublicStatus, AiTask } from "@/lib/ai/types";
import type { JuryInput, JuryMode, JuryResult, RewriteResult } from "@/lib/jury/types";
import { createInitialSteps, workflowStepKeys } from "@/lib/workflow/nodeDefinitions";
import { sampleDocuments, sampleToWorkflowData } from "@/lib/workflow/samples";
import { cleanText } from "@/lib/workflow/runners/cleanText";
import { segmentText } from "@/lib/workflow/runners/segmentText";
import {
  buildIntegrityReport,
  buildVreadExport,
  collectModelsUsed,
  providerFromData,
  resolveFinalQuestion,
} from "@/lib/workflow/productionCompatibility";
import type {
  DocumentMetadata,
  GeneratedQuestion,
  LocalWorkflowRunSummary,
  InspectionAnchor,
  TextSegment,
  WorkflowData,
  WorkflowLog,
  NodeInspectionMode,
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

function providerLabel(provider?: AiProviderName) {
  if (provider === "openai") return "OpenAI";
  if (provider === "demo") return "Demo";
  return "OpenRouter";
}

function sourceLabel(result?: { source?: "live" | "fallback"; provider?: AiProviderName }, status?: AiPublicStatus | null) {
  const provider = result?.provider ?? status?.provider;
  if (result?.source === "fallback" || provider === "demo" || status?.demoFallbackMode) return "Demo fallback";
  return `Live ${providerLabel(provider)}`;
}

function aiTaskForStep(step: WorkflowStepKey): AiTask | undefined {
  if (step === "questionGeneration") return "questionGeneration";
  if (step === "fastJury") return "fastJury";
  if (step === "strictJury") return "chiefJudge";
  if (step === "rewrite") return "rewrite";
  return undefined;
}

export default function Home() {
  const [steps, setSteps] = useState(createInitialSteps);
  const [data, setData] = useState<WorkflowData>(() => sampleToWorkflowData(firstSample));
  const dataRef = useRef<WorkflowData>(sampleToWorkflowData(firstSample));
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [selectedKey, setSelectedKey] = useState<WorkflowStepKey>("documentInput");
  const [selectedInspectionMode, setSelectedInspectionMode] =
    useState<NodeInspectionMode>("overview");
  const [inspectionPopoverOpen, setInspectionPopoverOpen] = useState(false);
  const [inspectionAnchor, setInspectionAnchor] = useState<InspectionAnchor | undefined>();
  const [selectedSampleId, setSelectedSampleId] = useState(firstSample.id);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(0);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AiPublicStatus | null>(null);
  const [aiStatusError, setAiStatusError] = useState<string | null>(null);
  const [runSummary, setRunSummary] = useState<LocalWorkflowRunSummary | undefined>();

  const selectedStep = steps[selectedKey];
  const selectedQuestion = useMemo(
    () =>
      data.generatedQuestions?.find((question) => question.id === selectedQuestionId) ??
      data.generatedQuestions?.[0],
    [data.generatedQuestions, selectedQuestionId]
  );
  const latestJury = data.strictJuryResult ?? data.fastJuryResult;
  const integrityReport = data.integrityReport;
  const vreadExport = data.vreadExport;
  const selectedAiResult =
    selectedKey === "questionGeneration"
      ? selectedQuestion
      : selectedKey === "fastJury"
        ? data.fastJuryResult
        : selectedKey === "strictJury"
          ? data.strictJuryResult
          : selectedKey === "rewrite"
            ? data.rewrittenQuestion
            : latestJury ?? selectedQuestion;
  const appSourceLabel = sourceLabel(selectedAiResult, aiStatus);
  const selectedTask = aiTaskForStep(selectedKey);
  const selectedModel =
    selectedAiResult?.model ?? (selectedTask && aiStatus?.models[selectedTask]) ?? undefined;
  const selectedProvider = selectedAiResult?.provider ?? aiStatus?.provider;

  useEffect(() => {
    let active = true;
    fetch("/api/ai/status")
      .then(async (response) => {
        const body = (await response.json()) as { status?: AiPublicStatus; error?: string };
        if (!active) return;
        if (!response.ok || !body.status) {
          setAiStatusError(body.error || "AI provider configuration is unavailable.");
          return;
        }
        setAiStatus(body.status);
        setAiStatusError(null);
      })
      .catch((error) => {
        if (active) setAiStatusError(error instanceof Error ? error.message : "AI provider status failed.");
      });
    return () => {
      active = false;
    };
  }, []);

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

  const log = (
    message: string,
    level: WorkflowLog["level"] = "info",
    step?: WorkflowStepKey,
    ai?: WorkflowLog["ai"]
  ) => {
    setLogs((items) => [
      {
        id: crypto.randomUUID(),
        timestamp: nowTime(),
        level,
        message,
        step,
        ai,
      },
      ...items,
    ]);
  };

  const aiLogFromOutput = (key: WorkflowStepKey, output: unknown): WorkflowLog["ai"] => {
    const task = aiTaskForStep(key);
    if (!task) return undefined;
    const value = Array.isArray(output) ? output[0] : output;
    if (!value || typeof value !== "object") return undefined;
    const result = value as {
      provider?: AiProviderName;
      model?: string;
      latencyMs?: number;
      usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
      };
    };
    if (!result.provider || !result.model || result.latencyMs === undefined) return undefined;
    return {
      task,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      usage: result.usage,
    };
  };

  const runGuarded = async <T,>(
    key: WorkflowStepKey,
    runner: () => Promise<{
      input?: unknown;
      output: T;
      summary: string;
      dataPatch?: Partial<WorkflowData>;
    }>
  ) => {
    patchStep(key, { status: "running", startedAt: new Date().toISOString(), error: undefined });
    log(`Running ${steps[key].label}`, "info", key);
    try {
      const result = await runner();
      patchStep(key, {
        status: "success",
        completedAt: new Date().toISOString(),
        summary: result.summary,
        input: result.input,
        output: result.output,
      });
      if (result.dataPatch) {
        setWorkflowData((current) => ({ ...current, ...result.dataPatch }));
      }
      log(result.summary, "success", key, aiLogFromOutput(key, result.output));
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
        input: { sampleId: sample.id, source: "sample selector" },
        output: sampleData.document?.metadata,
      },
    });
    setSelectedSegmentIndex(0);
    setSelectedQuestionId(undefined);
    setGlobalError(null);
    setRunSummary(undefined);
    log(`Loaded sample document: ${sample.title}`, "success", "documentInput");
  };

  const uploadFile = async (file: File) => {
    setBusy(true);
    setGlobalError(null);
    patchStep("documentInput", {
      status: "success",
      input: { name: file.name, type: file.type, size: file.size },
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
        input: { name: file.name, type: file.type, size: file.size },
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
            input: dataRef.current.document?.metadata,
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
            input: dataRef.current.document?.metadata,
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
            input: {
              extractedTextPreview: shortText(dataRef.current.extractedText),
              characters: dataRef.current.extractedText.length,
            },
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
            input: {
              cleanedTextPreview: shortText(dataRef.current.cleanedText),
              wordCount: dataRef.current.cleanedText.split(/\s+/).filter(Boolean).length,
            },
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
            input: {
              segmentCount: dataRef.current.segments?.length ?? 0,
              selectedSegmentIndex,
            },
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
            input: segment,
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
            input: {
              question: dataRef.current.selectedQuestion ?? dataRef.current.generatedQuestions?.[0],
              segment: dataRef.current.selectedSegment ?? dataRef.current.segments?.[selectedSegmentIndex],
            },
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
            input: {
              question: dataRef.current.selectedQuestion ?? dataRef.current.generatedQuestions?.[0],
              segment: dataRef.current.selectedSegment ?? dataRef.current.segments?.[selectedSegmentIndex],
              fastJuryResult: dataRef.current.fastJuryResult,
            },
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
          const juryForRewrite = dataRef.current.strictJuryResult ?? dataRef.current.fastJuryResult;
          const response = await fetch("/api/rewrite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...questionInput(question, segment),
              result: juryForRewrite
                ? {
                    finalDecision: juryForRewrite.finalDecision,
                    summary: juryForRewrite.summary,
                    judges: juryForRewrite.judges,
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
            input: {
              question,
              segment,
              jury: juryForRewrite,
            },
            output: body.rewrite,
            summary: `Rewrite proposed: ${body.rewrite.question}`,
            dataPatch: { rewrittenQuestion: body.rewrite },
          };
        });
      }

      if (key === "integrityChecks") {
        await runGuarded("integrityChecks", async () => {
          const jury = dataRef.current.strictJuryResult ?? dataRef.current.fastJuryResult;
          const segment = dataRef.current.selectedSegment ?? dataRef.current.segments?.[selectedSegmentIndex];
          const finalQuestion = resolveFinalQuestion(dataRef.current);
          const report = buildIntegrityReport(dataRef.current);
          const finalApprovedQuestion =
            finalQuestion && segment
              ? {
                  question: finalQuestion.question,
                  answer: finalQuestion.answer,
                  sourceExcerpt: segment.analysisWindow.excerpt,
                  jury,
                  integrity: report,
                }
              : undefined;

          return {
            input: {
              question: finalQuestion,
              segment,
              jury,
              generatedQuestions: dataRef.current.generatedQuestions,
            },
            output: report,
            summary: report.summary,
            dataPatch: {
              integrityReport: report,
              ...(finalApprovedQuestion ? { finalApprovedQuestion } : {}),
            },
          };
        });
      }

      if (key === "vreadExport") {
        await runGuarded("vreadExport", async () => {
          const exportBundle = buildVreadExport(dataRef.current, runSummary ?? dataRef.current.runSummary);

          return {
            input: {
              finalApprovedQuestion: dataRef.current.finalApprovedQuestion,
              integrityReport: dataRef.current.integrityReport,
              runSummary: runSummary ?? dataRef.current.runSummary,
            },
            output: exportBundle,
            summary: `VREAD export ready with ${exportBundle.json.reading_questions.length} reading question.`,
            dataPatch: {
              vreadExport: exportBundle,
            },
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
            integrity: dataRef.current.integrityReport,
            vreadExport: dataRef.current.vreadExport,
            runSummary: runSummary ?? dataRef.current.runSummary,
          };
          return {
            input: {
              selectedQuestion: dataRef.current.selectedQuestion ?? dataRef.current.generatedQuestions?.[0],
              rewrittenQuestion: dataRef.current.rewrittenQuestion,
              jury,
              integrityReport: dataRef.current.integrityReport,
              vreadExport: dataRef.current.vreadExport,
            },
            output: finalApprovedQuestion,
            summary: "Final JSON output is ready.",
            dataPatch: { finalApprovedQuestion },
          };
        });
      }
      return true;
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Workflow step failed.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const runSequence = async (keys: WorkflowStepKey[]) => {
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const runId = crypto.randomUUID();
    const initialSummary: LocalWorkflowRunSummary = {
      runId,
      startedAt,
      status: "running",
      numberOfSteps: keys.length,
      successfulSteps: 0,
      failedSteps: 0,
      providerUsed: aiStatus?.provider,
      modelsUsed: [],
    };
    setRunSummary(initialSummary);
    setWorkflowData((current) => ({ ...current, runSummary: initialSummary }));

    let successfulSteps = 0;
    let failedSteps = 0;

    for (const key of keys) {
      setSelectedKey(key);
      const success = await runStep(key);
      if (success) successfulSteps += 1;
      else failedSteps += 1;
    }

    const completedAtMs = Date.now();
    const completedData = dataRef.current;
    const latestResult = completedData.strictJuryResult ?? completedData.fastJuryResult;
    const integrityStatus = completedData.integrityReport?.status;
    const status: LocalWorkflowRunSummary["status"] =
      failedSteps > 0 || integrityStatus === "fail"
        ? "failed"
        : integrityStatus === "warning"
          ? "warning"
          : "success";
    const completedSummary: LocalWorkflowRunSummary = {
      runId,
      startedAt,
      completedAt: new Date(completedAtMs).toISOString(),
      durationMs: completedAtMs - startedAtMs,
      status,
      numberOfSteps: keys.length,
      successfulSteps,
      failedSteps,
      providerUsed: providerFromData(completedData) ?? aiStatus?.provider,
      modelsUsed: collectModelsUsed(completedData),
      finalDecision: latestResult?.finalDecision,
      globalScore: latestResult?.globalScore,
      integrityStatus,
    };

    setRunSummary(completedSummary);
    setWorkflowData((current) => ({
      ...current,
      runSummary: completedSummary,
      vreadExport: current.vreadExport
        ? {
            ...current.vreadExport,
            json: {
              ...current.vreadExport.json,
              run_summary: completedSummary,
            },
          }
        : current.vreadExport,
      finalApprovedQuestion: current.finalApprovedQuestion
        ? {
            ...current.finalApprovedQuestion,
            runSummary: completedSummary,
            vreadExport: current.vreadExport
              ? {
                  ...current.vreadExport,
                  json: {
                    ...current.vreadExport.json,
                    run_summary: completedSummary,
                  },
                }
              : current.finalApprovedQuestion.vreadExport,
          }
        : current.finalApprovedQuestion,
    }));
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
    integrityReport: data.integrityReport,
    vreadExport: data.vreadExport?.json,
    sqlPreview: data.vreadExport?.sqlPreview,
    runSummary: data.runSummary ?? runSummary,
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

  const copyVreadJson = async () => {
    if (!vreadExport) return;
    await navigator.clipboard.writeText(JSON.stringify(vreadExport.json, null, 2));
    log("Copied VREAD JSON export to clipboard.", "success", "vreadExport");
  };

  const exportVreadJson = () => {
    if (!vreadExport) return;
    const blob = new Blob([JSON.stringify(vreadExport.json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vread-compatible-export.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const copySqlPreview = async () => {
    if (!vreadExport) return;
    await navigator.clipboard.writeText(vreadExport.sqlPreview);
    log("Copied SQL preview to clipboard.", "success", "vreadExport");
  };

  const reset = () => {
    setSteps(createInitialSteps());
    setWorkflowData(sampleToWorkflowData(firstSample));
    setLogs([]);
    setSelectedKey("documentInput");
    setSelectedInspectionMode("overview");
    setInspectionPopoverOpen(false);
    setInspectionAnchor(undefined);
    setSelectedSampleId(firstSample.id);
    setSelectedSegmentIndex(0);
    setSelectedQuestionId(undefined);
    setGlobalError(null);
    setRunSummary(undefined);
  };

  const runModeLabel = appSourceLabel === "Demo fallback" ? "Fallback" : "Live";

  return (
    <AppShell>
      <div className="flex min-h-screen flex-col gap-5 px-4 pb-28 pt-4 lg:px-6">
        <WorkflowTopBar
          provider={selectedProvider}
          modeLabel={runModeLabel}
          model={selectedModel}
          busy={busy}
          aiStatusError={aiStatusError}
          onExport={exportFinalJson}
        />

        {globalError && (
          <div className="mx-auto flex w-[min(1480px,100%)] gap-3 rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 shadow-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {globalError}
          </div>
        )}

        <section className="mx-auto grid w-[min(1480px,100%)] flex-1 gap-5 xl:grid-cols-[minmax(760px,1fr)_420px]">
          <div className="flex min-h-[calc(100vh-190px)] flex-col gap-5 overflow-hidden">
            <WorkflowCanvas
              steps={steps}
              selectedKey={selectedKey}
              onSelect={(key) => {
                setSelectedKey(key);
                setSelectedInspectionMode("overview");
                setInspectionAnchor(undefined);
                setInspectionPopoverOpen(false);
              }}
              onInspect={(key, mode, anchor) => {
                setSelectedKey(key);
                setSelectedInspectionMode(mode);
                setInspectionAnchor(anchor);
                setInspectionPopoverOpen(true);
              }}
            />

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="rounded-[32px] border border-white bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <div className="mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-base font-black text-slate-950">Run output</h2>
                  {integrityReport && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase text-slate-600">
                      Integrity: {integrityReport.status}
                    </span>
                  )}
                </div>
                {!data.finalApprovedQuestion ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                    Run through Integrity, Export, and Output to show the approved VREAD question here.
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Approved question</div>
                      <h3 className="mt-2 text-xl font-black text-slate-950">{data.finalApprovedQuestion.question}</h3>
                      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                        <div className="text-xs font-black uppercase text-emerald-700">Answer</div>
                        <div className="mt-1 text-base font-black text-slate-950">{data.finalApprovedQuestion.answer}</div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-white p-3">
                          <div className="text-xs font-bold uppercase text-slate-400">Jury score</div>
                          <div className="mt-1 text-2xl font-black text-slate-950">
                            {data.finalApprovedQuestion.jury?.globalScore ?? "Pending"}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <div className="text-xs font-bold uppercase text-slate-400">Decision</div>
                          <div className="mt-1 text-lg font-black capitalize text-slate-950">
                            {data.finalApprovedQuestion.jury?.finalDecision ?? "pending"}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <div className="text-xs font-bold uppercase text-slate-400">Integrity</div>
                          <div className="mt-1 text-lg font-black uppercase text-slate-950">
                            {data.finalApprovedQuestion.integrity?.status ?? integrityReport?.status ?? "pending"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <FileJson className="h-4 w-4 text-violet-600" />
                          <h3 className="text-sm font-black text-slate-950">VREAD Export</h3>
                        </div>
                        {vreadExport && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={copyVreadJson}
                              className="inline-flex h-8 items-center gap-1 rounded-xl bg-white px-2 text-xs font-black text-violet-700"
                            >
                              <Clipboard className="h-3.5 w-3.5" />
                              Copy
                            </button>
                            <button
                              type="button"
                              onClick={exportVreadJson}
                              className="inline-flex h-8 items-center gap-1 rounded-xl bg-white px-2 text-xs font-black text-violet-700"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Export
                            </button>
                            <button
                              type="button"
                              onClick={copySqlPreview}
                              className="inline-flex h-8 items-center gap-1 rounded-xl bg-white px-2 text-xs font-black text-amber-700"
                            >
                              <Database className="h-3.5 w-3.5" />
                              SQL
                            </button>
                          </div>
                        )}
                      </div>
                      {vreadExport ? (
                        <pre className="max-h-[260px] overflow-auto rounded-2xl bg-white p-3 text-xs leading-relaxed text-slate-600">
                          {JSON.stringify(vreadExport.json, null, 2)}
                        </pre>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
                          Run the VREAD Export module to generate the payload.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              <WorkflowLogs logs={logs} />
            </div>
          </div>

          <WorkflowSidebar
            samples={sampleDocuments}
            selectedSampleId={selectedSampleId}
            selectedStep={selectedStep}
            inspectionMode={selectedInspectionMode}
            data={data}
            selectedSegmentIndex={selectedSegmentIndex}
            selectedQuestionId={selectedQuestion?.id}
            busy={busy}
            sourceLabel={appSourceLabel}
            onSampleChange={loadSample}
            onUpload={uploadFile}
            onRunFull={runFullWorkflow}
            onRunStep={(key) => runSequence([key])}
            onRunFromSelected={runFromSelected}
            onRunFastJury={() => runSequence(["fastJury"])}
            onRunStrictJury={() => runSequence(["strictJury"])}
            onRewrite={() => runSequence(["rewrite"])}
            onCopy={copyFinalJson}
            onExport={exportFinalJson}
            onCopyVreadJson={copyVreadJson}
            onExportVreadJson={exportVreadJson}
            onCopySqlPreview={copySqlPreview}
            onReset={reset}
            onSegmentChange={onSegmentChange}
            onQuestionChange={onQuestionChange}
            onInspectionModeChange={setSelectedInspectionMode}
            onOpenInspection={(mode, anchor) => {
              setSelectedInspectionMode(mode);
              setInspectionAnchor(anchor);
              setInspectionPopoverOpen(true);
            }}
          />
        </section>
      </div>

      <WorkflowBottomBar
        busy={busy}
        modeLabel={runModeLabel}
        hasFinalOutput={Boolean(data.finalApprovedQuestion)}
        onRunOnce={() => runSequence([selectedKey])}
        onRunFull={runFullWorkflow}
        onRunFromSelected={runFromSelected}
        onReset={reset}
        onExport={exportFinalJson}
        onCopy={copyFinalJson}
      />

      <InspectionPopover
        open={inspectionPopoverOpen}
        step={selectedStep}
        mode={selectedInspectionMode}
        anchor={inspectionAnchor}
        fallbackValue={data.document?.metadata}
        onClose={() => setInspectionPopoverOpen(false)}
        onModeChange={setSelectedInspectionMode}
      />
    </AppShell>
  );
}
