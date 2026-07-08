import { z } from "zod";
import type { AiProviderName, AiTask } from "@/lib/ai/types";
import type { JuryResult, RewriteResult } from "@/lib/jury/types";

export type WorkflowNodeStatus = "idle" | "running" | "success" | "error";

export type NodeInspectionMode = "overview" | "input" | "output";

export type InspectionAnchor = {
  x: number;
  y: number;
};

export type WorkflowStepKey =
  | "documentInput"
  | "textExtraction"
  | "cleaning"
  | "segmentation"
  | "segmentSelection"
  | "questionGeneration"
  | "fastJury"
  | "strictJury"
  | "rewrite"
  | "integrityChecks"
  | "vreadExport"
  | "finalOutput";

export type WorkflowStepState = {
  key: WorkflowStepKey;
  label: string;
  status: WorkflowNodeStatus;
  startedAt?: string;
  completedAt?: string;
  summary?: string;
  error?: string;
  input?: unknown;
  output?: unknown;
};

export type DocumentKind = "sample" | "pdf" | "epub" | "text";

export type DocumentMetadata = {
  name: string;
  kind: DocumentKind;
  size?: number;
  wordCount?: number;
  source?: "upload" | "sample";
};

export type TextSegment = {
  index: number;
  wordCount: number;
  text: string;
  analysisWindow: {
    startWord: number;
    endWord: number;
    excerpt: string;
  };
};

export type GeneratedQuestion = {
  id: string;
  segmentIndex: number;
  question: string;
  answer: string;
  rationale: string;
  source?: "live" | "fallback";
  provider?: AiProviderName;
  model?: string;
  latencyMs?: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export type IntegrityCheckStatus = "pass" | "warning" | "fail";

export type IntegrityCheck = {
  key: string;
  label: string;
  status: IntegrityCheckStatus;
  message: string;
};

export type IntegrityReport = {
  status: IntegrityCheckStatus;
  checks: IntegrityCheck[];
  summary: string;
};

export type VreadExport = {
  book: {
    title: string;
    slug: string;
    language: string;
    expected_segments: number;
    source_type: "pdf" | "epub" | "sample";
    word_count: number;
    created_from: "vread-question-jury-demo";
  };
  reading_questions: Array<{
    segment_index: number;
    question: string;
    answer: string;
    source_excerpt: string;
    jury_decision: "approve" | "rewrite" | "reject";
    jury_score: number;
    integrity_status: IntegrityCheckStatus;
  }>;
  run_summary?: LocalWorkflowRunSummary;
};

export type VreadExportBundle = {
  json: VreadExport;
  sqlPreview: string;
};

export type LocalWorkflowRunSummary = {
  runId: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  status: "running" | "success" | "warning" | "failed";
  numberOfSteps: number;
  successfulSteps: number;
  failedSteps: number;
  providerUsed?: AiProviderName;
  modelsUsed: string[];
  finalDecision?: "approve" | "rewrite" | "reject";
  globalScore?: number;
  integrityStatus?: IntegrityCheckStatus;
};

export type WorkflowData = {
  document?: {
    metadata: DocumentMetadata;
    rawText?: string;
  };
  extractedText?: string;
  cleanedText?: string;
  segments?: TextSegment[];
  selectedSegment?: TextSegment;
  generatedQuestions?: GeneratedQuestion[];
  selectedQuestion?: GeneratedQuestion;
  fastJuryResult?: JuryResult;
  strictJuryResult?: JuryResult;
  rewrittenQuestion?: RewriteResult;
  integrityReport?: IntegrityReport;
  vreadExport?: VreadExportBundle;
  runSummary?: LocalWorkflowRunSummary;
  finalApprovedQuestion?: {
    question: string;
    answer: string;
    sourceExcerpt: string;
    jury?: JuryResult;
    integrity?: IntegrityReport;
    vreadExport?: VreadExportBundle;
    runSummary?: LocalWorkflowRunSummary;
  };
};

export type WorkflowLog = {
  id: string;
  timestamp: string;
  level: "info" | "success" | "error";
  message: string;
  step?: WorkflowStepKey;
  ai?: {
    task: AiTask;
    provider: AiProviderName;
    model: string;
    latencyMs: number;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  };
};

export const GeneratedQuestionSchema = z.object({
  id: z.string().min(1),
  segmentIndex: z.number().int().min(0),
  question: z.string().min(8).max(800),
  answer: z.string().min(1).max(500),
  rationale: z.string().min(8).max(1000),
  source: z.enum(["live", "fallback"]).optional(),
  provider: z.enum(["openrouter", "openai", "demo"]).optional(),
  model: z.string().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  usage: z
    .object({
      promptTokens: z.number().int().nonnegative().optional(),
      completionTokens: z.number().int().nonnegative().optional(),
      totalTokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export const QuestionGenerationResponseSchema = z.object({
  questions: z.array(GeneratedQuestionSchema.omit({ id: true, segmentIndex: true })).min(1).max(4),
});
