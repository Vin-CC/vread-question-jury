import {
  buildAmbiguityJudgePrompt,
  buildAntiCheatJudgePrompt,
  buildChiefJudgePrompt,
  buildClarityJudgePrompt,
  buildEvidenceJudgePrompt,
  buildFastJuryPrompt,
  buildPedagogyJudgePrompt,
  buildRewritePrompt,
} from "./prompts";
import { completeWithAi } from "@/lib/ai/gateway";
import { parseJsonObject } from "./json";
import { normalizeFinalDecision } from "./scoring";
import {
  JudgeResultSchema,
  JuryResultSchema,
  RewriteResultSchema,
  type JudgeName,
  type JudgeResult,
  type JuryInput,
  type JuryResult,
  type RewriteResult,
} from "./types";
import type { AiChatMessage, AiCompletionResponse, AiTask } from "@/lib/ai/types";

function messagesFromPrompt(prompt: { system: string; user: string }): AiChatMessage[] {
  return [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
  ];
}

function tokenUsage(response: AiCompletionResponse) {
  return response.usage
    ? {
        promptTokens: response.usage.inputTokens,
        completionTokens: response.usage.outputTokens,
        totalTokens: response.usage.totalTokens,
      }
    : undefined;
}

function attachJudgeMetadata(
  judge: JudgeResult,
  meta: { provider: JudgeResult["provider"]; model: string; latencyMs: number; usage?: JudgeResult["usage"] }
): JudgeResult {
  return {
    ...judge,
    provider: meta.provider,
    model: meta.model,
    latencyMs: meta.latencyMs,
    usage: meta.usage,
  };
}

function attachJuryMetadata(
  result: JuryResult,
  meta: { provider: JuryResult["provider"]; model: string; latencyMs: number; usage?: JuryResult["usage"] }
): JuryResult {
  return {
    ...result,
    source: meta.provider === "demo" ? "fallback" : "live",
    provider: meta.provider,
    model: meta.model,
    latencyMs: meta.latencyMs,
    usage: meta.usage,
  };
}

export async function runFastJury(input: JuryInput, forceFallback = false): Promise<JuryResult> {
  const prompt = buildFastJuryPrompt(input);
  const response = await completeWithAi(
    {
      task: "fastJury",
      messages: messagesFromPrompt(prompt),
      responseFormat: "json",
      maxOutputTokens: 2400,
    },
    { forceDemoFallback: forceFallback }
  );

  const parsedJson = parseJsonObject(response.content);
  const validated = JuryResultSchema.parse(parsedJson);
  const withMeta = attachJuryMetadata(
    {
      ...validated,
      judges: validated.judges.map((judge) =>
        attachJudgeMetadata(judge, {
          provider: response.provider,
          model: response.model,
          latencyMs: response.latencyMs,
          usage: tokenUsage(response),
        })
      ),
    },
    { ...response, usage: tokenUsage(response) }
  );

  return normalizeFinalDecision(withMeta);
}

const builders: Record<JudgeName, (input: JuryInput) => { system: string; user: string }> = {
  evidence: buildEvidenceJudgePrompt,
  ambiguity: buildAmbiguityJudgePrompt,
  antiCheat: buildAntiCheatJudgePrompt,
  clarity: buildClarityJudgePrompt,
  pedagogy: buildPedagogyJudgePrompt,
};

const judgeTasks: Record<JudgeName, AiTask> = {
  evidence: "evidenceJudge",
  ambiguity: "ambiguityJudge",
  antiCheat: "antiCheatJudge",
  clarity: "clarityJudge",
  pedagogy: "pedagogyJudge",
};

async function runJudge(input: JuryInput, judgeName: JudgeName, forceFallback: boolean): Promise<JudgeResult> {
  const response = await completeWithAi(
    {
      task: judgeTasks[judgeName],
      messages: messagesFromPrompt(builders[judgeName](input)),
      responseFormat: "json",
      maxOutputTokens: 900,
    },
    { forceDemoFallback: forceFallback }
  );
  const parsedJson = parseJsonObject(response.content);
  const validated = JudgeResultSchema.parse(parsedJson);
  return attachJudgeMetadata(validated, { ...response, usage: tokenUsage(response) });
}

export async function runStrictJury(input: JuryInput, forceFallback = false): Promise<JuryResult> {
  const judges = await Promise.all(
    (["evidence", "ambiguity", "antiCheat", "clarity", "pedagogy"] as const).map((judge) =>
      runJudge(input, judge, forceFallback)
    )
  );

  const chiefResponse = await completeWithAi(
    {
      task: "chiefJudge",
      messages: messagesFromPrompt(buildChiefJudgePrompt(input, judges)),
      responseFormat: "json",
      maxOutputTokens: 1800,
    },
    { forceDemoFallback: forceFallback }
  );

  const parsedJson = parseJsonObject(chiefResponse.content);
  const validated = JuryResultSchema.parse(parsedJson);
  const mergedJudges = validated.judges.map((judge) => {
    const original = judges.find((item) => item.judge === judge.judge);
    return {
      ...judge,
      provider: original?.provider,
      model: original?.model,
      latencyMs: original?.latencyMs,
      usage: original?.usage,
    };
  });

  return normalizeFinalDecision(
    attachJuryMetadata(
      {
        ...validated,
        mode: "strict",
        judges: mergedJudges,
      },
      { ...chiefResponse, usage: tokenUsage(chiefResponse) }
    )
  );
}

export async function rewriteQuestion(
  input: JuryInput,
  result?: Pick<JuryResult, "finalDecision" | "summary" | "judges">,
  forceFallback = false
): Promise<RewriteResult> {
  const response = await completeWithAi(
    {
      task: "rewrite",
      messages: messagesFromPrompt(buildRewritePrompt(input, result)),
      responseFormat: "json",
      maxOutputTokens: 1000,
    },
    { forceDemoFallback: forceFallback }
  );

  const parsedJson = parseJsonObject(response.content);
  const validated = RewriteResultSchema.parse(parsedJson);
  return {
    ...validated,
    source: response.provider === "demo" ? "fallback" : "live",
    provider: response.provider,
    model: response.model,
    latencyMs: response.latencyMs,
    usage: tokenUsage(response),
  };
}
