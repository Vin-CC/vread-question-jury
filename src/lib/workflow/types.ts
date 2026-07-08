import { z } from "zod";
import type { JuryResult, RewriteResult } from "@/lib/jury/types";

export type WorkflowNodeStatus = "idle" | "running" | "success" | "error";

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
  model?: string;
  latencyMs?: number;
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
  finalApprovedQuestion?: {
    question: string;
    answer: string;
    sourceExcerpt: string;
    jury?: JuryResult;
  };
};

export type WorkflowLog = {
  id: string;
  timestamp: string;
  level: "info" | "success" | "error";
  message: string;
  step?: WorkflowStepKey;
};

export const GeneratedQuestionSchema = z.object({
  id: z.string().min(1),
  segmentIndex: z.number().int().min(0),
  question: z.string().min(8).max(800),
  answer: z.string().min(1).max(500),
  rationale: z.string().min(8).max(1000),
  source: z.enum(["live", "fallback"]).optional(),
  model: z.string().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
});

export const QuestionGenerationResponseSchema = z.object({
  questions: z.array(GeneratedQuestionSchema.omit({ id: true, segmentIndex: true })).min(1).max(4),
});
