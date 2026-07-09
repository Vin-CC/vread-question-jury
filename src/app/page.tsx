"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, PanelRightOpen, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { InspectionPopover } from "@/components/workflow/InspectionPopover";
import { WorkflowSidebar } from "@/components/workflow/WorkflowSidebar";
import { WorkflowBottomBar } from "@/components/workflow/WorkflowBottomBar";
import { toUserFacingAiValue } from "@/lib/ai/display";
import type { AiProviderName, AiPublicStatus, AiTask } from "@/lib/ai/types";
import type { JuryInput, JuryMode, JuryResult, RewriteResult } from "@/lib/jury/types";
import { createInitialSteps, workflowStepKeys } from "@/lib/workflow/nodeDefinitions";
import { evaluateQualityGate, juryStepAfterRewrite } from "@/lib/workflow/qualityGate";
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
  InspectionAnchor,
  TextSegment,
  WorkflowData,
  WorkflowLog,
  WorkflowRunSummary,
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
  const [runSummary, setRunSummary] = useState<WorkflowRunSummary | undefined>();
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
        : selectedKey === "qualityGate"
          ? undefined
          : selectedKey === "strictJury"
            ? data.strictJuryResult
            : selectedKey === "rewrite"
              ? data.rewrittenQuestion
              : latestJury ?? selectedQuestion;
  const selectedTask = aiTaskForStep(selectedKey);
  const selectedModel =
    selectedAiResult?.model ?? (selectedTask && aiStatus?.models[selectedTask]) ?? undefined;

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
      await runBranchingFlow("cleaning");
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
      body: JSON.stringify({ ...questionInput(juryQuestion, jurySegment), mode }),
    });
    const body = (await response.json()) as {
      result?: JuryResult;
      error?: string;
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
            body: JSON.stringify({ segment }),
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
            // A new fast verdict invalidates any previous routing and strict result.
            dataPatch: { fastJuryResult: result, qualityGateResult: undefined, strictJuryResult: undefined },
          };
        });
      }

      if (key === "qualityGate") {
        await runGuarded("qualityGate", async () => {
          const fastJury = dataRef.current.fastJuryResult;
          if (!fastJury) throw new Error("Run Fast Jury before evaluating the Quality Gate.");
          const decision = evaluateQualityGate(fastJury, {
            rewriteAttempted: dataRef.current.rewriteAttempted,
          });
          return {
            input: {
              fastJuryScore: fastJury.globalScore,
              fastJuryDecision: fastJury.finalDecision,
              rewriteAttempted: Boolean(dataRef.current.rewriteAttempted),
            },
            output: decision,
            summary: `Quality Gate routed to ${decision.route}: ${decision.reason}`,
            dataPatch: { qualityGateResult: decision },
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
              qualityGateResult: dataRef.current.qualityGateResult,
            },
            output: result,
            summary: `Strict Review returned ${result.finalDecision} with score ${result.globalScore}`,
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
          const body = (await response.json()) as { rewrite?: RewriteResult; error?: string };
          if (!response.ok || !body.rewrite) throw new Error(body.error || "Rewrite failed.");
          // The rewritten question becomes the active candidate so any later
          // jury pass and the final output judge the improved version.
          const rewrittenCandidate: GeneratedQuestion = {
            id: `${question.id}-rewrite`,
            segmentIndex: question.segmentIndex,
            question: body.rewrite.question,
            answer: body.rewrite.answer,
            rationale: body.rewrite.reason,
            provider: body.rewrite.provider,
            model: body.rewrite.model,
            latencyMs: body.rewrite.latencyMs,
            usage: body.rewrite.usage,
          };
          return {
            input: {
              question,
              segment,
              jury: juryForRewrite,
            },
            output: body.rewrite,
            summary: `Rewrite proposed: ${body.rewrite.question}`,
            dataPatch: {
              rewrittenQuestion: body.rewrite,
              rewriteAttempted: true,
              selectedQuestion: rewrittenCandidate,
            },
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
        await runGuarded<unknown>("finalOutput", async () => {
          const jury = dataRef.current.strictJuryResult ?? dataRef.current.fastJuryResult;
          const gate = dataRef.current.qualityGateResult;

          if (jury?.finalDecision === "reject") {
            const rejectedOutput = {
              status: "rejected" as const,
              reason: gate?.route === "reject" ? gate.reason : jury.summary,
              jury,
              qualityGate: gate,
            };
            return {
              input: { jury, qualityGateResult: gate },
              output: rejectedOutput,
              summary: "Final output marked as rejected by the jury.",
              dataPatch: { finalStatus: "rejected" as const, finalApprovedQuestion: undefined },
            };
          }

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
            dataPatch: { finalApprovedQuestion, finalStatus: "approved" as const },
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

  const markSkipped = (keys: WorkflowStepKey[], reason: string) => {
    if (keys.length === 0) return;
    setSteps((current) => {
      const next = { ...current };
      for (const key of keys) {
        next[key] = { ...current[key], status: "skipped", summary: reason, error: undefined };
      }
      return next;
    });
    for (const key of keys) {
      log(`${steps[key].label} skipped: ${reason}`, "info", key);
    }
  };

  // Steps at and after Fast Jury depend on the routing decision, so a fresh
  // run must clear their previous statuses and derived data.
  const juryAndTailKeys: WorkflowStepKey[] = [
    "fastJury",
    "qualityGate",
    "strictJury",
    "rewrite",
    "integrityChecks",
    "vreadExport",
    "finalOutput",
  ];

  const resetJuryPhase = () => {
    const initial = createInitialSteps();
    setSteps((current) => {
      const next = { ...current };
      for (const key of juryAndTailKeys) next[key] = initial[key];
      return next;
    });
    setWorkflowData((current) => ({
      ...current,
      fastJuryResult: undefined,
      qualityGateResult: undefined,
      strictJuryResult: undefined,
      rewrittenQuestion: undefined,
      rewriteAttempted: undefined,
      finalStatus: undefined,
      integrityReport: undefined,
      vreadExport: undefined,
      finalApprovedQuestion: undefined,
      selectedQuestion:
        current.generatedQuestions?.find((question) => question.id === selectedQuestionId) ??
        current.generatedQuestions?.[0],
    }));
  };

  const runWithSummary = async (
    body: (runOne: (key: WorkflowStepKey) => Promise<boolean>) => Promise<void>
  ) => {
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const runId = crypto.randomUUID();
    const initialSummary: WorkflowRunSummary = {
      runId,
      startedAt,
      status: "running",
      numberOfSteps: 0,
      successfulSteps: 0,
      failedSteps: 0,
      providerUsed: aiStatus?.provider,
      modelsUsed: [],
    };
    setRunSummary(initialSummary);
    setWorkflowData((current) => ({ ...current, runSummary: initialSummary }));

    let successfulSteps = 0;
    let failedSteps = 0;
    let executedSteps = 0;

    const runOne = async (key: WorkflowStepKey) => {
      executedSteps += 1;
      setSelectedKey(key);
      const success = await runStep(key);
      if (success) successfulSteps += 1;
      else failedSteps += 1;
      return Boolean(success);
    };

    await body(runOne);

    const completedAtMs = Date.now();
    const completedData = dataRef.current;
    const latestResult = completedData.strictJuryResult ?? completedData.fastJuryResult;
    const integrityStatus = completedData.integrityReport?.status;
    const status: WorkflowRunSummary["status"] =
      failedSteps > 0 || integrityStatus === "fail"
        ? "failed"
        : completedData.finalStatus === "rejected" || integrityStatus === "warning"
          ? "warning"
          : "success";
    const completedSummary: WorkflowRunSummary = {
      runId,
      startedAt,
      completedAt: new Date(completedAtMs).toISOString(),
      durationMs: completedAtMs - startedAtMs,
      status,
      numberOfSteps: executedSteps,
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

  // Plain sequence without branching, used for manual single-step runs.
  const runSequence = async (keys: WorkflowStepKey[]) => {
    await runWithSummary(async (runOne) => {
      for (const key of keys) {
        await runOne(key);
      }
    });
  };

  const tailKeys: WorkflowStepKey[] = ["integrityChecks", "vreadExport", "finalOutput"];

  // Cost-aware execution: Fast Jury feeds the Quality Gate, which decides
  // whether to approve directly, escalate to Strict Review, rewrite and
  // re-judge, or stop with a rejected output. Branches that are not taken
  // are marked as skipped.
  const runBranchingFlow = async (startKey: WorkflowStepKey) => {
    await runWithSummary(async (runOne) => {
      const executed = new Set<WorkflowStepKey>();
      const exec = async (key: WorkflowStepKey) => {
        executed.add(key);
        return runOne(key);
      };
      const skip = (keys: WorkflowStepKey[], reason: string) =>
        markSkipped(keys.filter((key) => !executed.has(key)), reason);

      const runTail = async (from: WorkflowStepKey = "integrityChecks") => {
        for (const key of tailKeys.slice(tailKeys.indexOf(from))) {
          if (!(await exec(key))) return;
        }
      };

      const handleStrictResult = async (): Promise<"proceed" | "rejected" | "stop"> => {
        const strict = dataRef.current.strictJuryResult;
        if (!strict) return "stop";
        if (strict.finalDecision === "reject") return "rejected";
        if (strict.finalDecision === "rewrite" && !dataRef.current.rewriteAttempted) {
          if (!(await exec("rewrite"))) return "stop";
        }
        return "proceed";
      };

      const gateLoop = async (): Promise<"proceed" | "rejected" | "stop"> => {
        for (;;) {
          if (!(await exec("qualityGate"))) return "stop";
          const gate = dataRef.current.qualityGateResult;
          if (!gate) return "stop";
          if (gate.route === "approve") return "proceed";
          if (gate.route === "reject") return "rejected";
          if (gate.route === "strictReview") {
            if (!(await exec("strictJury"))) return "stop";
            return handleStrictResult();
          }
          // route === "rewrite": fix the question, then re-judge it. The gate
          // escalates instead of rewriting twice, so this loop is bounded.
          if (!(await exec("rewrite"))) return "stop";
          if (juryStepAfterRewrite(gate) === "fastJury") {
            if (!(await exec("fastJury"))) return "stop";
            continue;
          }
          if (!(await exec("strictJury"))) return "stop";
          return handleStrictResult();
        }
      };

      if (workflowStepKeys.indexOf(startKey) <= workflowStepKeys.indexOf("fastJury")) {
        resetJuryPhase();
      }

      if (tailKeys.includes(startKey)) {
        await runTail(startKey);
        return;
      }

      let outcome: "proceed" | "rejected" | "stop";
      if (startKey === "strictJury") {
        outcome = (await exec("strictJury")) ? await handleStrictResult() : "stop";
      } else if (startKey === "rewrite") {
        outcome = (await exec("rewrite")) && (await exec("fastJury")) ? await gateLoop() : "stop";
      } else if (startKey === "qualityGate") {
        outcome = await gateLoop();
      } else {
        if (startKey !== "fastJury") {
          const preJuryKeys = workflowStepKeys.slice(0, workflowStepKeys.indexOf("fastJury"));
          for (const key of preJuryKeys.slice(preJuryKeys.indexOf(startKey))) {
            if (!(await exec(key))) return;
          }
        }
        if (!(await exec("fastJury"))) return;
        outcome = await gateLoop();
      }

      if (outcome === "stop") return;
      if (outcome === "rejected") {
        skip(
          ["strictJury", "rewrite", "integrityChecks", "vreadExport"],
          "Skipped — the jury rejected the question."
        );
        await exec("finalOutput");
        return;
      }
      skip(["strictJury"], "Skipped — Fast Jury score was high with no critical issue.");
      skip(["rewrite"], "Skipped — no rewrite was needed.");
      await runTail();
    });
  };

  const runFullWorkflow = async () => {
    await runBranchingFlow("documentInput");
  };

  const runFromSelected = async () => {
    await runBranchingFlow(selectedKey);
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
    qualityGateResult: data.qualityGateResult,
    strictJuryResult: data.strictJuryResult,
    rewrittenQuestion: data.rewrittenQuestion,
    finalStatus: data.finalStatus,
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
  };

  return (
    <AppShell>
      <div className="flex h-screen gap-3 overflow-hidden p-3 pb-24">
        <div className="relative min-w-0 flex-1">
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
            fitTrigger={inspectorHidden}
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
        </div>

        {!inspectorHidden && (
          <div className="w-[340px] shrink-0">
            <WorkflowSidebar
              selectedStep={selectedStep}
              inspectionMode={selectedInspectionMode}
              data={data}
              logs={logs}
              selectedSegmentIndex={selectedSegmentIndex}
              selectedQuestionId={selectedQuestion?.id}
              busy={busy}
              selectedModel={selectedModel}
              onUpload={uploadFile}
              onRunStep={(key) => runSequence([key])}
              onRewrite={() => runSequence(["rewrite"])}
              onCopy={copyFinalJson}
              onExport={exportFinalJson}
              onCopyVreadJson={copyVreadJson}
              onExportVreadJson={exportVreadJson}
              onCopySqlPreview={copySqlPreview}
              onCollapse={() => setInspectorHidden(true)}
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

      {inspectorHidden && (
        <button
          type="button"
          onClick={() => setInspectorHidden(false)}
          className="fixed right-4 top-4 z-40 inline-flex h-11 items-center gap-2 rounded-2xl border border-white/80 bg-white/95 px-3 text-sm font-black text-slate-700 shadow-lg backdrop-blur transition hover:text-violet-700"
        >
          <PanelRightOpen className="h-4 w-4" />
          Inspector
        </button>
      )}

      <WorkflowBottomBar
        busy={busy}
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
