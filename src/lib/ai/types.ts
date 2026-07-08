export type AiProviderName = "openrouter" | "openai" | "demo";

export type RuntimeRunMode = "demo" | "live";

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
  runtimeMode?: RuntimeRunMode;
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
  demoFallbackMode: boolean;
  runtimeMode: RuntimeRunMode;
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
  liveProvider?: Exclude<AiProviderName, "demo">;
  liveAvailable: boolean;
  defaultRuntimeMode: RuntimeRunMode;
  liveConfigurationError?: string;
  demoFallbackMode: boolean;
  models: AiModelConfig;
  providerSort?: AiProviderSort;
  temperature: number;
  maxOutputTokens: number;
  reasoningEffort: AiReasoningEffort;
};
