import { AiProviderError } from "./errors";
import { resolveModels } from "./model-routing";
import type {
  AiConfig,
  AiProviderName,
  AiProviderSort,
  AiPublicStatus,
  AiReasoningEffort,
  RuntimeRunMode,
} from "./types";

const providerNames: AiProviderName[] = ["openrouter", "openai", "demo"];
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
  if (providerNames.includes(configuredProvider as AiProviderName)) {
    return { provider: configuredProvider as AiProviderName, configuredProvider };
  }
  throw new AiProviderError({
    message: `AI_PROVIDER must be one of openrouter, openai, or demo. Received "${configuredProvider}".`,
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
  if (provider === "demo") return undefined;
  if (provider === "openrouter") {
    const apiKey = cleanEnv("OPENROUTER_API_KEY");
    if (!apiKey) throw new AiProviderError({ message: "OPENROUTER_API_KEY is not configured." });
    return apiKey;
  }

  const apiKey = cleanEnv("OPENAI_API_KEY");
  if (!apiKey && configuredProvider === "codex") {
    throw new AiProviderError({
      message:
        "AI_PROVIDER=codex maps to the OpenAI runtime provider. Codex is a development agent, while this app needs an LLM runtime provider. Configure OPENAI_API_KEY and AI_* model variables, or set AI_PROVIDER=openrouter/demo.",
    });
  }
  if (!apiKey) throw new AiProviderError({ message: "OPENAI_API_KEY is not configured." });
  return apiKey;
}

function apiKeyErrorMessage(provider: AiProviderName, configuredProvider: string) {
  try {
    requiredApiKey(provider, configuredProvider);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "Live mode is not configured.";
  }
}

function liveModeError(message: string) {
  return new AiProviderError({
    message: `Live mode is not configured. ${message} Add an API key or switch to Demo mode.`,
  });
}

export function getAiConfig(options: { forceDemoFallback?: boolean; runtimeMode?: RuntimeRunMode } = {}): AiConfig {
  const demoFallbackMode =
    options.forceDemoFallback || cleanEnv("DEMO_FALLBACK_MODE")?.toLowerCase() === "true";
  const parsed = parseProvider(cleanEnv("AI_PROVIDER"));
  const runtimeMode: RuntimeRunMode =
    options.runtimeMode ?? (demoFallbackMode || parsed.provider === "demo" ? "demo" : "live");

  let provider: AiProviderName;
  if (runtimeMode === "demo") {
    provider = "demo";
  } else {
    if (parsed.provider === "demo") {
      throw liveModeError("AI_PROVIDER is set to demo.");
    }
    provider = parsed.provider;
  }

  let apiKey: string | undefined;
  try {
    apiKey = requiredApiKey(provider, parsed.configuredProvider);
  } catch (error) {
    if (runtimeMode === "live" && error instanceof Error && /API_KEY is not configured/.test(error.message)) {
      throw liveModeError(error.message);
    }
    throw error;
  }

  return {
    provider,
    configuredProvider: parsed.configuredProvider,
    demoFallbackMode,
    runtimeMode,
    apiKey,
    models: resolveModels(provider),
    providerSort: parseProviderSort(),
    temperature: parseNumber("AI_TEMPERATURE", 0.1),
    maxOutputTokens: Math.trunc(parseNumber("AI_MAX_OUTPUT_TOKENS", 1600)),
    reasoningEffort: parseReasoningEffort(),
  };
}

export function getAiPublicStatus(): AiPublicStatus {
  const parsed = parseProvider(cleanEnv("AI_PROVIDER"));
  const demoFallbackMode = cleanEnv("DEMO_FALLBACK_MODE")?.toLowerCase() === "true";
  const liveProvider = parsed.provider === "demo" ? undefined : parsed.provider;
  const liveConfigurationError = liveProvider
    ? apiKeyErrorMessage(liveProvider, parsed.configuredProvider)
    : "AI_PROVIDER is set to demo.";
  const liveAvailable = Boolean(liveProvider && !liveConfigurationError);
  const defaultRuntimeMode: RuntimeRunMode =
    demoFallbackMode || parsed.provider === "demo" || !liveAvailable ? "demo" : "live";
  const config = getAiConfig({ runtimeMode: defaultRuntimeMode });

  return {
    provider: config.provider,
    configuredProvider: config.configuredProvider,
    liveProvider,
    liveAvailable,
    defaultRuntimeMode,
    liveConfigurationError,
    demoFallbackMode: config.demoFallbackMode,
    models: config.models,
    providerSort: config.providerSort,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    reasoningEffort: config.reasoningEffort,
  };
}
