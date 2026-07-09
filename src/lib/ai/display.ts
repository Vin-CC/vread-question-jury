import type { AiProviderName, RuntimeRunMode } from "./types";

export function aiProviderDisplayName(provider?: AiProviderName) {
  if (provider === "openai") return "OpenAI";
  if (provider === "anthropic") return "Claude";
  if (provider === "demo") return "Local";
  return "OpenRouter";
}

export function runtimeModeDisplayName(mode?: RuntimeRunMode) {
  return mode === "live" ? "Live" : "Local";
}

export function runtimeModeBadge(mode?: RuntimeRunMode) {
  return `${runtimeModeDisplayName(mode)} mode`;
}

export function aiModelDisplayName(model?: string) {
  if (!model) return undefined;
  return model.replace(/^demo\//, "local/").replaceAll("fallback", "offline");
}

export function offlineReasonDisplay(reason?: string) {
  if (!reason) return undefined;
  return reason
    .replaceAll("demo", "local")
    .replaceAll("Demo", "Local")
    .replaceAll("fallback", "offline")
    .replaceAll("Fallback", "Offline");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toUserFacingAiValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toUserFacingAiValue);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if ((key === "provider" || key === "providerUsed") && typeof entry === "string") {
        return [key, aiProviderDisplayName(entry as AiProviderName)];
      }
      if ((key === "model" || key === "modelsUsed") && typeof entry === "string") {
        return [key, aiModelDisplayName(entry)];
      }
      if (key === "modelsUsed" && Array.isArray(entry)) {
        return [key, entry.map((item) => (typeof item === "string" ? aiModelDisplayName(item) : item))];
      }
      if ((key === "runtimeRunMode" || key === "requestedRunMode") && typeof entry === "string") {
        return [key, runtimeModeDisplayName(entry as RuntimeRunMode)];
      }
      if (key === "source" && entry === "fallback") {
        return [key, "local"];
      }
      if (key === "fallbackReason" && typeof entry === "string") {
        return ["offlineReason", offlineReasonDisplay(entry)];
      }
      return [key, toUserFacingAiValue(entry)];
    })
  );
}
