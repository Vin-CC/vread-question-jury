import { AiProviderError } from "./errors";
import { resolveModels } from "./model-routing";
import type {
  AiConfig,
  AiProviderName,
  AiProviderSort,
  AiPublicStatus,
  AiReasoningEffort,
} from "./types";

const providerNames: AiProviderName[] = ["openrouter", "openai", "anthropic", "claude-cli"];
const providerSorts: AiProviderSort[] = ["price", "throughput", "latency"];
const reasoningEfforts: AiReasoningEffort[] = ["none", "low", "medium", "high"];

function cleanEnv(key: string) {
  const value = process.env[key]?.trim();
  return value || undefined;
}

function parseNumber(key: string, fallback: number) {
  const raw = cleanEnv(key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new AiProviderError({ message: `${key} must be a finite number.` });
  }
  return parsed;
}

function parseProvider(rawProvider?: string): { provider: AiProviderName; configuredProvider: string } {
  const configuredProvider = (rawProvider || "openrouter").toLowerCase();
  if (configuredProvider === "codex") {
    return { provider: "openai", configuredProvider };
  }
  if (configuredProvider === "claude") {
    return { provider: "anthropic", configuredProvider };
  }
  if (configuredProvider === "claude-code" || configuredProvider === "claude_cli") {
    return { provider: "claude-cli", configuredProvider };
  }
  if (providerNames.includes(configuredProvider as AiProviderName)) {
    return { provider: configuredProvider as AiProviderName, configuredProvider };
  }
  throw new AiProviderError({
    message: `AI_PROVIDER must be one of openrouter, openai (or codex), anthropic (or claude), or claude-cli (local Claude Code login). Received "${configuredProvider}".`,
  });
}

function parseProviderSort() {
  const raw = cleanEnv("AI_PROVIDER_SORT");
  if (!raw) return undefined;
  if (providerSorts.includes(raw as AiProviderSort)) return raw as AiProviderSort;
  throw new AiProviderError({
    message: `AI_PROVIDER_SORT must be one of price, throughput, or latency. Received "${raw}".`,
  });
}

function parseReasoningEffort() {
  const raw = cleanEnv("AI_REASONING_EFFORT") || "none";
  if (reasoningEfforts.includes(raw as AiReasoningEffort)) return raw as AiReasoningEffort;
  throw new AiProviderError({
    message: `AI_REASONING_EFFORT must be one of none, low, medium, or high. Received "${raw}".`,
  });
}

function requiredApiKey(provider: AiProviderName, configuredProvider: string) {
  // claude-cli shells out to the local Claude Code binary, which carries its own login.
  if (provider === "claude-cli") return undefined;
  if (provider === "openrouter") {
    const apiKey = cleanEnv("OPENROUTER_API_KEY");
    if (!apiKey) throw new AiProviderError({ message: "OPENROUTER_API_KEY is not configured." });
    return apiKey;
  }
  if (provider === "anthropic") {
    const apiKey = cleanEnv("ANTHROPIC_API_KEY");
    if (!apiKey) throw new AiProviderError({ message: "ANTHROPIC_API_KEY is not configured." });
    return apiKey;
  }

  const apiKey = cleanEnv("OPENAI_API_KEY");
  if (!apiKey && configuredProvider === "codex") {
    throw new AiProviderError({
      message:
        "AI_PROVIDER=codex maps to the OpenAI runtime provider. Codex is a development agent, while this app needs an LLM runtime provider. Configure OPENAI_API_KEY and AI_* model variables, or set AI_PROVIDER=openrouter.",
    });
  }
  if (!apiKey) throw new AiProviderError({ message: "OPENAI_API_KEY is not configured." });
  return apiKey;
}

export function getAiConfig(): AiConfig {
  const parsed = parseProvider(cleanEnv("AI_PROVIDER"));

  return {
    provider: parsed.provider,
    configuredProvider: parsed.configuredProvider,
    apiKey: requiredApiKey(parsed.provider, parsed.configuredProvider),
    models: resolveModels(parsed.provider),
    providerSort: parseProviderSort(),
    temperature: parseNumber("AI_TEMPERATURE", 0.1),
    maxOutputTokens: Math.trunc(parseNumber("AI_MAX_OUTPUT_TOKENS", 1600)),
    reasoningEffort: parseReasoningEffort(),
  };
}

export function getAiPublicStatus(): AiPublicStatus {
  const config = getAiConfig();

  return {
    provider: config.provider,
    configuredProvider: config.configuredProvider,
    models: config.models,
    providerSort: config.providerSort,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    reasoningEffort: config.reasoningEffort,
  };
}
