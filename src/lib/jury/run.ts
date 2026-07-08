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
import { callOpenRouter, getModel } from "./openrouter";
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
  type OpenRouterMessage,
  type RewriteResult,
} from "./types";

function messagesFromPrompt(prompt: { system: string; user: string }): OpenRouterMessage[] {
  return [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
  ];
}

function attachJudgeMetadata(
  judge: JudgeResult,
  meta: { model: string; latencyMs: number; usage?: JudgeResult["usage"] }
): JudgeResult {
  return {
    ...judge,
    model: meta.model,
    latencyMs: meta.latencyMs,
    usage: meta.usage,
  };
}

function attachJuryMetadata(
  result: JuryResult,
  meta: { model: string; latencyMs: number; usage?: JuryResult["usage"] }
): JuryResult {
  return {
    ...result,
    source: "live",
    model: meta.model,
    latencyMs: meta.latencyMs,
    usage: meta.usage,
  };
}

export async function runFastJury(input: JuryInput): Promise<JuryResult> {
  const model = getModel("fast");
  const prompt = buildFastJuryPrompt(input);
  const response = await callOpenRouter({
    model,
    messages: messagesFromPrompt(prompt),
    maxTokens: 2400,
  });

  const parsedJson = parseJsonObject(response.content);
  const validated = JuryResultSchema.parse(parsedJson);
  const withMeta = attachJuryMetadata(
    {
      ...validated,
      judges: validated.judges.map((judge) =>
        attachJudgeMetadata(judge, {
          model: response.model,
          latencyMs: response.latencyMs,
          usage: response.usage,
        })
      ),
    },
    response
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

async function runJudge(input: JuryInput, judgeName: JudgeName): Promise<JudgeResult> {
  const model = getModel("strict");
  const response = await callOpenRouter({
    model,
    messages: messagesFromPrompt(builders[judgeName](input)),
    maxTokens: 900,
  });
  const parsedJson = parseJsonObject(response.content);
  const validated = JudgeResultSchema.parse(parsedJson);
  return attachJudgeMetadata(validated, response);
}

export async function runStrictJury(input: JuryInput): Promise<JuryResult> {
  const judges = await Promise.all(
    (["evidence", "ambiguity", "antiCheat", "clarity", "pedagogy"] as const).map((judge) =>
      runJudge(input, judge)
    )
  );

  const chiefModel = getModel("chief");
  const chiefResponse = await callOpenRouter({
    model: chiefModel,
    messages: messagesFromPrompt(buildChiefJudgePrompt(input, judges)),
    maxTokens: 1800,
  });

  const parsedJson = parseJsonObject(chiefResponse.content);
  const validated = JuryResultSchema.parse(parsedJson);
  const mergedJudges = validated.judges.map((judge) => {
    const original = judges.find((item) => item.judge === judge.judge);
    return {
      ...judge,
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
      chiefResponse
    )
  );
}

export async function rewriteQuestion(
  input: JuryInput,
  result?: Pick<JuryResult, "finalDecision" | "summary" | "judges">
): Promise<RewriteResult> {
  const model = getModel("rewrite");
  const response = await callOpenRouter({
    model,
    messages: messagesFromPrompt(buildRewritePrompt(input, result)),
    maxTokens: 1000,
  });

  const parsedJson = parseJsonObject(response.content);
  const validated = RewriteResultSchema.parse(parsedJson);
  return {
    ...validated,
    source: "live",
    model: response.model,
    latencyMs: response.latencyMs,
    usage: response.usage,
  };
}
