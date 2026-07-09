import type { AiProviderName } from "./types";

export function aiProviderDisplayName(provider?: AiProviderName) {
  if (provider === "openai") return "OpenAI";
  if (provider === "anthropic") return "Claude";
  if (provider === "claude-cli") return "Claude Code";
  return "OpenRouter";
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
      return [key, toUserFacingAiValue(entry)];
    })
  );
}
