import type { AiModelConfig, AiProviderName, AiTask } from "./types";

const strictJudgeTasks: AiTask[] = [
  "evidenceJudge",
  "ambiguityJudge",
  "antiCheatJudge",
  "clarityJudge",
  "pedagogyJudge",
];

const defaultModels: Record<AiProviderName, Record<"question" | "fast" | "strict" | "chief" | "rewrite", string>> = {
  openrouter: {
    question: "openai/gpt-4o-mini",
    fast: "openai/gpt-4o-mini",
    strict: "openai/gpt-4o-mini",
    chief: "openai/gpt-4o-mini",
    rewrite: "openai/gpt-4o-mini",
  },
  openai: {
    question: "gpt-4o-mini",
    fast: "gpt-4o-mini",
    strict: "gpt-4o-mini",
    chief: "gpt-4o-mini",
    rewrite: "gpt-4o-mini",
  },
  anthropic: {
    question: "claude-opus-4-8",
    fast: "claude-haiku-4-5",
    strict: "claude-opus-4-8",
    chief: "claude-opus-4-8",
    rewrite: "claude-opus-4-8",
  },
  // Model aliases resolved by the Claude Code CLI against the local subscription.
  "claude-cli": {
    question: "sonnet",
    fast: "haiku",
    strict: "sonnet",
    chief: "sonnet",
    rewrite: "sonnet",
  },
};

function envValue(key: string) {
  const value = process.env[key]?.trim();
  return value || undefined;
}

export function resolveModels(provider: AiProviderName): AiModelConfig {
  const defaults = defaultModels[provider];
  const question = envValue("AI_QUESTION_MODEL") || defaults.question;
  const fast = envValue("AI_FAST_MODEL") || envValue("OPENROUTER_FAST_MODEL") || defaults.fast;
  const strict = envValue("AI_STRICT_MODEL") || envValue("OPENROUTER_STRICT_MODEL") || defaults.strict;
  const chief = envValue("AI_CHIEF_MODEL") || envValue("OPENROUTER_CHIEF_MODEL") || defaults.chief;
  const rewrite = envValue("AI_REWRITE_MODEL") || envValue("OPENROUTER_REWRITE_MODEL") || defaults.rewrite;

  return {
    questionGeneration: question,
    fastJury: fast,
    evidenceJudge: strict,
    ambiguityJudge: strict,
    antiCheatJudge: strict,
    clarityJudge: strict,
    pedagogyJudge: strict,
    chiefJudge: chief,
    rewrite,
  };
}

export function modelForTask(models: AiModelConfig, task: AiTask) {
  return models[task];
}

export function isStrictJudgeTask(task: AiTask) {
  return strictJudgeTasks.includes(task);
}
