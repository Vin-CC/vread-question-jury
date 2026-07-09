"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, PanelRightClose, PanelRightOpen, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { InspectionPopover } from "@/components/workflow/InspectionPopover";
import { WorkflowSidebar } from "@/components/workflow/WorkflowSidebar";
import { WorkflowBottomBar } from "@/components/workflow/WorkflowBottomBar";
import { aiProviderDisplayName, runtimeModeBadge, toUserFacingAiValue } from "@/lib/ai/display";
import type { AiProviderName, AiPublicStatus, AiTask, RuntimeRunMode } from "@/lib/ai/types";
import type { JuryInput, JuryMode, JuryResult, RewriteResult } from "@/lib/jury/types";
import { createInitialSteps, workflowStepKeys } from "@/lib/workflow/nodeDefinitions";
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

function nowTime() {
  return new Date().toLocaleTimeString();
}

function shortText(text: string, max = 420) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
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
  const [data, setData] = useState<WorkflowData>({});
  const dataRef = useRef<WorkflowData>({});
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [selectedKey, setSelectedKey] = useState<WorkflowStepKey>("documentInput");
  const [selectedInspectionMode, setSelectedInspectionMode] =
    useState<NodeInspectionMode>("overview");
  const [inspectionPopoverOpen, setInspectionPopoverOpen] = useState(false);
  const [inspectionAnchor, setInspectionAnchor] = useState<InspectionAnchor | undefined>();
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(0);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AiPublicStatus | null>(null);
  const [aiStatusError, setAiStatusError] = useState<string | null>(null);
  const [runSummary, setRunSummary] = useState<LocalWorkflowRunSummary | undefined>();
  const [runtimeRunMode, setRuntimeRunMode] = useState<RuntimeRunMode>("demo");
  const runtimeRunModeRef = useRef<RuntimeRunMode>("demo");
  const [lastFailedStep, setLastFailedStep] = useState<WorkflowStepKey | undefined>();
  const [inspectorHidden, setInspectorHidden] = useState(false);

  const selectedStep = steps[selectedKey];
  const selectedQuestion = useMemo(
    () =>
      data.generatedQuestions?.find((question) => question.id === selectedQuestionId) ??
      data.generatedQuestions?.[0],
    [data.generatedQuestions, selectedQuestionId]
  );
  const latestJury = data.strictJuryResult ?? data.fastJuryResult;
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
  const appSourceLabel =
    runtimeRunMode === "demo"
      ? "Local mode"
      : `Live ${aiProviderDisplayName(selectedAiResult?.provider ?? aiStatus?.liveProvider ?? aiStatus?.provider)}`;
  const selectedTask = aiTaskForStep(selectedKey);
  const selectedModel =
    selectedAiResult?.model ?? (selectedTask && aiStatus?.models[selectedTask]) ?? undefined;
  const selectedProvider =
    runtimeRunMode === "demo" ? "demo" : selectedAiResult?.provider ?? aiStatus?.liveProvider ?? aiStatus?.provider;

  const updateRuntimeRunMode = (mode: RuntimeRunMode) => {
    runtimeRunModeRef.current = mode;
    setRuntimeRunMode(mode);
  };

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
        updateRuntimeRunMode(body.status.defaultRuntimeMode);
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
      requestedRunMode: runtimeRunModeRef.current,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      fallbackReason: runtimeRunModeRef.current === "demo" ? "requested local mode" : undefined,
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
    setLastFailedStep(undefined);
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
      if (runtimeRunModeRef.current === "live") setLastFailedStep(key);
      log(message, "error", key);
      throw error;
    }
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
  });

  const callJury = async (mode: JuryMode, question?: GeneratedQuestion, segment?: TextSegment) => {
    const current = dataRef.current;
    const juryQuestion = question ?? current.selectedQuestion ?? current.generatedQuestions?.[0];
    const jurySegment = segment ?? current.selectedSegment ?? current.segments?.[selectedSegmentIndex];
    if (!juryQuestion || !jurySegment) throw new Error("Generate and select a question before running jury.");
    const response = await fetch("/api/jury", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...questionInput(juryQuestion, jurySegment), mode, runtimeRunMode: runtimeRunModeRef.current }),
    });
    const body = (await response.json()) as {
      result?: JuryResult;
      error?: string;
      fallbackAvailable?: boolean;
    };
    if (!response.ok || !body.result) throw new Error(body.error || `${mode} jury failed.`);
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
          const metadata = currentData.document?.metadata;
          if (!metadata) throw new Error("Upload a real PDF or EPUB document first.");
          return {
            input: dataRef.current.document?.metadata,
            output: metadata,
            summary: `Document ready: ${metadata.name}`,
          };
        });
      }

      if (key === "textExtraction") {
        await runGuarded("textExtraction", async () => {
          const text = dataRef.current.extractedText ?? dataRef.current.document?.rawText;
          if (!text) throw new Error("Upload a real PDF or EPUB document first.");
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
            body: JSON.stringify({ segment, runtimeRunMode: runtimeRunModeRef.current }),
          });
          const body = (await response.json()) as { questions?: GeneratedQuestion[]; error?: string };
          if (!response.ok || !body.questions) throw new Error(body.error || "Question generation failed.");
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
              runtimeRunMode: runtimeRunModeRef.current,
              result: juryForRewrite
                ? {
                  finalDecision: juryForRewrite.finalDecision,
                  summary: juryForRewrite.summary,
                  judges: juryForRewrite.judges,
                }
                : undefined,
            }),
          });
          const body = (await response.json()) as { rewrite?: RewriteResult; error?: string };
          if (!response.ok || !body.rewrite) throw new Error(body.error || "Rewrite failed.");
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
      providerUsed: runtimeRunModeRef.current === "demo" ? "demo" : aiStatus?.liveProvider ?? aiStatus?.provider,
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
    await navigator.clipboard.writeText(JSON.stringify(toUserFacingAiValue(finalJson), null, 2));
    log("Copied final JSON to clipboard.", "success", "finalOutput");
  };

  const exportFinalJson = () => {
    const blob = new Blob([JSON.stringify(toUserFacingAiValue(finalJson), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vread-workflow-output.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyVreadJson = async () => {
    if (!vreadExport) return;
    await navigator.clipboard.writeText(JSON.stringify(toUserFacingAiValue(vreadExport.json), null, 2));
    log("Copied VREAD JSON export to clipboard.", "success", "vreadExport");
  };

  const exportVreadJson = () => {
    if (!vreadExport) return;
    const blob = new Blob([JSON.stringify(toUserFacingAiValue(vreadExport.json), null, 2)], { type: "application/json" });
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
    setWorkflowData({});
    setLogs([]);
    setSelectedKey("documentInput");
    setSelectedInspectionMode("overview");
    setInspectionPopoverOpen(false);
    setInspectionAnchor(undefined);
    setSelectedSegmentIndex(0);
    setSelectedQuestionId(undefined);
    setGlobalError(null);
    setRunSummary(undefined);
    setLastFailedStep(undefined);
  };

  const retryInLocalMode = async () => {
    if (!lastFailedStep) return;
    updateRuntimeRunMode("demo");
    setGlobalError(null);
    await runSequence([lastFailedStep]);
  };

  const runModeLabel =
    runtimeRunMode === "demo"
      ? runtimeModeBadge(runtimeRunMode)
      : `Live ${aiProviderDisplayName(aiStatus?.liveProvider ?? selectedProvider)}`;

  return (
    <AppShell>
      <div className="relative h-screen overflow-hidden">
        <div className="pointer-events-none absolute left-5 top-4 z-20">
          <h1 className="text-lg font-black tracking-tight text-slate-950">VREAD Question Jury</h1>
          {aiStatusError && <p className="mt-1 max-w-[360px] text-xs font-bold text-red-600">{aiStatusError}</p>}
        </div>

        {globalError && (
          <div className="absolute left-5 right-5 top-16 z-40 flex flex-col gap-3 rounded-[22px] border border-red-200 bg-red-50/95 p-3 text-sm font-semibold text-red-700 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {globalError}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {runtimeRunMode === "live" && lastFailedStep && (
                <button
                  type="button"
                  onClick={retryInLocalMode}
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-700"
                >
                  Retry in Local mode
                </button>
              )}
              <button
                type="button"
                onClick={() => setGlobalError(null)}
                aria-label="Dismiss error"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-red-700 transition hover:bg-red-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

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

        {!inspectorHidden && (
          <div className="absolute bottom-24 right-3 top-3 z-30 w-[390px] max-w-[calc(100vw-24px)] 2xl:w-[420px]">
            <WorkflowSidebar
              selectedStep={selectedStep}
              inspectionMode={selectedInspectionMode}
              data={data}
              logs={logs}
              selectedSegmentIndex={selectedSegmentIndex}
              selectedQuestionId={selectedQuestion?.id}
              busy={busy}
              sourceLabel={appSourceLabel}
              selectedModel={selectedModel}
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
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setInspectorHidden((value) => !value)}
        className="fixed right-4 top-4 z-40 inline-flex h-11 items-center gap-2 rounded-2xl border border-white/80 bg-white/95 px-3 text-sm font-black text-slate-700 shadow-lg backdrop-blur transition hover:text-violet-700"
      >
        {inspectorHidden ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
        {inspectorHidden ? "Show panel" : "Hide panel"}
      </button>

      <WorkflowBottomBar
        busy={busy}
        modeLabel={runModeLabel}
        runtimeRunMode={runtimeRunMode}
        hasFinalOutput={Boolean(data.finalApprovedQuestion)}
        onRunModeChange={(mode) => {
          updateRuntimeRunMode(mode);
          setGlobalError(null);
          setLastFailedStep(undefined);
        }}
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
