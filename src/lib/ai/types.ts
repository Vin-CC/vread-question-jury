export type AiProviderName = "openrouter" | "openai" | "anthropic" | "claude-cli";

export type AiTask =
  | "questionGeneration"
  | "fastJury"
  | "evidenceJudge"
  | "ambiguityJudge"
  | "antiCheatJudge"
  | "clarityJudge"
  | "pedagogyJudge"
  | "chiefJudge"
  | "rewrite";

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiCompletionRequest = {
  task: AiTask;
  messages: AiChatMessage[];
  responseFormat?: "json";
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
};

export type AiCompletionResponse = {
  content: string;
  provider: AiProviderName;
  model: string;
  latencyMs: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  raw?: unknown;
};

export interface AiProvider {
  name: AiProviderName;
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
}

export type AiProviderSort = "price" | "throughput" | "latency";

export type AiReasoningEffort = "none" | "low" | "medium" | "high";

export type AiModelConfig = Record<AiTask, string>;

export type AiConfig = {
  provider: AiProviderName;
  configuredProvider: string;
  // Absent for claude-cli, which authenticates through the local Claude Code login.
  apiKey?: string;
  models: AiModelConfig;
  providerSort?: AiProviderSort;
  temperature: number;
  maxOutputTokens: number;
  reasoningEffort: AiReasoningEffort;
};

export type AiPublicStatus = {
  provider: AiProviderName;
  configuredProvider: string;
  models: AiModelConfig;
  providerSort?: AiProviderSort;
  temperature: number;
  maxOutputTokens: number;
  reasoningEffort: AiReasoningEffort;
};
