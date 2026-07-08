import { z } from "zod";
import type { AiProviderName } from "@/lib/ai/types";

export type JudgeName =
  | "evidence"
  | "ambiguity"
  | "antiCheat"
  | "clarity"
  | "pedagogy";

export type JudgeDecision = "approve" | "rewrite" | "reject";

export type JuryMode = "fast" | "strict";

export type JuryInput = {
  excerpt: string;
  question: string;
  answer: string;
  exampleId?: string;
};

export type TokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type JudgeResult = {
  judge: JudgeName;
  score: number;
  decision: JudgeDecision;
  reason: string;
  failureModes: string[];
  suggestedFix?: string;
  provider?: AiProviderName;
  model?: string;
  latencyMs?: number;
  usage?: TokenUsage;
};

export type JuryResult = {
  mode: JuryMode;
  source?: "live" | "fallback";
  globalScore: number;
  finalDecision: JudgeDecision;
  summary: string;
  judges: JudgeResult[];
  recommendedRewrite?: {
    question: string;
    answer: string;
    reason: string;
  };
  provider?: AiProviderName;
  model?: string;
  latencyMs?: number;
  usage?: TokenUsage;
};

export type RewriteResult = {
  question: string;
  answer: string;
  reason: string;
  source?: "live" | "fallback";
  provider?: AiProviderName;
  model?: string;
  latencyMs?: number;
  usage?: TokenUsage;
};

export const judgeNames = [
  "evidence",
  "ambiguity",
  "antiCheat",
  "clarity",
  "pedagogy",
] as const;

export const JudgeDecisionSchema = z.enum(["approve", "rewrite", "reject"]);
export const JudgeNameSchema = z.enum(judgeNames);

export const JuryInputSchema = z.object({
  excerpt: z.string().trim().min(50, "Excerpt must be at least 50 characters."),
  question: z.string().trim().min(8, "Question is too short.").max(800),
  answer: z.string().trim().min(1, "Answer is required.").max(500),
  exampleId: z.string().trim().max(80).optional(),
});

export const TokenUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
});

export const AiProviderNameSchema = z.enum(["openrouter", "openai", "demo"]);

export const JudgeResultSchema = z.object({
  judge: JudgeNameSchema,
  score: z.number().int().min(0).max(100),
  decision: JudgeDecisionSchema,
  reason: z.string().min(8).max(1000),
  failureModes: z.array(z.string().min(1).max(160)).max(8),
  suggestedFix: z.string().min(1).max(600).optional(),
  provider: AiProviderNameSchema.optional(),
  model: z.string().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  usage: TokenUsageSchema.optional(),
});

export const JuryResultSchema = z.object({
  mode: z.enum(["fast", "strict"]),
  source: z.enum(["live", "fallback"]).optional(),
  globalScore: z.number().int().min(0).max(100),
  finalDecision: JudgeDecisionSchema,
  summary: z.string().min(8).max(1400),
  judges: z.array(JudgeResultSchema).length(5),
  recommendedRewrite: z
    .object({
      question: z.string().min(8).max(800),
      answer: z.string().min(1).max(500),
      reason: z.string().min(8).max(800),
    })
    .optional(),
  provider: AiProviderNameSchema.optional(),
  model: z.string().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  usage: TokenUsageSchema.optional(),
});

export const RewriteResultSchema = z.object({
  question: z.string().min(8).max(800),
  answer: z.string().min(1).max(500),
  reason: z.string().min(8).max(800),
  source: z.enum(["live", "fallback"]).optional(),
  provider: AiProviderNameSchema.optional(),
  model: z.string().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  usage: TokenUsageSchema.optional(),
});
