import { demoExamples } from "./examples";
import { normalizeFinalDecision } from "./scoring";
import {
  JuryResultSchema,
  RewriteResultSchema,
  type JudgeName,
  type JudgeResult,
  type JuryInput,
  type JuryMode,
  type JuryResult,
  type RewriteResult,
} from "./types";

type Scenario = "good" | "bad-evidence" | "ambiguous-easy";

function detectScenario(input: JuryInput): Scenario {
  if (input.exampleId === "bad-evidence" || input.exampleId === "ambiguous-easy") {
    return input.exampleId;
  }

  const matched = demoExamples.find(
    (example) =>
      example.question === input.question &&
      example.answer === input.answer &&
      example.excerpt === input.excerpt
  );

  if (matched?.id === "bad-evidence" || matched?.id === "ambiguous-easy") {
    return matched.id;
  }

  if (input.question.toLowerCase().includes("where is mara")) return "ambiguous-easy";
  if (input.answer.toLowerCase() === "orion") return "bad-evidence";
  return "good";
}

function withFallbackMeta(judges: Omit<JudgeResult, "model" | "latencyMs">[], mode: JuryMode) {
  const baseLatency = mode === "fast" ? 460 : 780;
  return judges.map((judge, index) => ({
    ...judge,
    provider: "demo" as const,
    model: mode === "fast" ? "local/offline-fast-jury" : `local/offline-${judge.judge}-judge`,
    latencyMs: mode === "fast" ? baseLatency : baseLatency + index * 95,
    usage: {
      promptTokens: mode === "fast" ? 1250 : 520,
      completionTokens: mode === "fast" ? 720 : 260,
      totalTokens: mode === "fast" ? 1970 : 780,
    },
  }));
}

function judge(
  judgeName: JudgeName,
  score: number,
  decision: JudgeResult["decision"],
  reason: string,
  failureModes: string[] = [],
  suggestedFix?: string
): Omit<JudgeResult, "model" | "latencyMs"> {
  return {
    judge: judgeName,
    score,
    decision,
    reason,
    failureModes,
    suggestedFix,
  };
}

function scenarioJudges(scenario: Scenario) {
  if (scenario === "bad-evidence") {
    return [
      judge(
        "evidence",
        18,
        "reject",
        "The expected answer 'Orion' is not present in the excerpt. The text only says Karim saw three bright stars arranged like a crooked crown.",
        ["missing evidence", "unsupported answer"],
        "Ask about the crooked crown arrangement or the brass telescope instead."
      ),
      judge(
        "ambiguity",
        72,
        "rewrite",
        "The question asks for a constellation, but the excerpt never names one, so the answer space depends on outside inference.",
        ["outside inference"],
        "Anchor the question to a detail explicitly named in the passage."
      ),
      judge(
        "antiCheat",
        42,
        "reject",
        "A reader could guess a common constellation without reading the excerpt because the question supplies no scene-specific constraint.",
        ["guessable", "generic astronomy"],
        "Use a scene detail that cannot be guessed from general knowledge."
      ),
      judge(
        "clarity",
        64,
        "rewrite",
        "The wording is grammatical, but it asks for identification that the passage does not actually provide.",
        ["misleading wording"],
        "Ask what shape the three stars resembled."
      ),
      judge(
        "pedagogy",
        44,
        "reject",
        "The question rewards astronomy knowledge rather than comprehension of the excerpt.",
        ["not comprehension"],
        "Test the note, storm, observatory, telescope, or star arrangement."
      ),
    ];
  }

  if (scenario === "ambiguous-easy") {
    return [
      judge(
        "evidence",
        92,
        "approve",
        "The answer 'bakery' is explicitly supported because Mara enters the bakery before dawn.",
        []
      ),
      judge(
        "ambiguity",
        58,
        "rewrite",
        "The question 'Where is Mara?' is broad and could be answered as bakery, before dawn, near the counter, or in the scene's workspace.",
        ["broad wording", "multiple valid answers"],
        "Ask about the object Mara uses to mark the mayor's tray."
      ),
      judge(
        "antiCheat",
        48,
        "rewrite",
        "The answer is easy to infer from the question context and does not require attention to the key scene action.",
        ["too easy", "low reading proof"],
        "Use a detail tied to the tray mix-up."
      ),
      judge(
        "clarity",
        62,
        "rewrite",
        "The question is short and understandable, but too underspecified for reliable validation.",
        ["underspecified"],
        "Add the scene action and target object."
      ),
      judge(
        "pedagogy",
        55,
        "rewrite",
        "The question checks setting recognition rather than meaningful comprehension of Mara's action and purpose.",
        ["weak comprehension value"],
        "Ask why or how she distinguishes the mayor's tray."
      ),
    ];
  }

  return [
    judge(
      "evidence",
      96,
      "approve",
      "The expected answer 'silver whistle' is explicitly stated in the excerpt as the object Nimmie Amee is polishing.",
      []
    ),
    judge(
      "ambiguity",
      91,
      "approve",
      "The question points to one named character, one location, and one action, leaving a single supported answer.",
      []
    ),
    judge(
      "antiCheat",
      88,
      "approve",
      "The answer depends on a specific object in the passage and is not guessable from general book knowledge.",
      []
    ),
    judge(
      "clarity",
      94,
      "approve",
      "The wording is clear, specific, and anchored in the cottage scene.",
      []
    ),
    judge(
      "pedagogy",
      89,
      "approve",
      "The question tests attention to a memorable scene detail connected to a later action with the field mice.",
      []
    ),
  ];
}

export function getFallbackJuryResult(input: JuryInput, mode: JuryMode): JuryResult {
  const scenario = detectScenario(input);
  const judges = withFallbackMeta(scenarioJudges(scenario), mode);
  const raw: JuryResult = {
    mode,
    source: "local",
    globalScore: scenario === "good" ? 92 : scenario === "bad-evidence" ? 45 : 63,
    finalDecision:
      scenario === "good" ? "approve" : scenario === "bad-evidence" ? "reject" : "rewrite",
    summary:
      scenario === "good"
        ? "Local verdict: the question is grounded, specific, hard to guess, and useful for reading validation."
        : scenario === "bad-evidence"
          ? "Local verdict: reject because the expected answer is not explicitly supported by the excerpt."
          : "Local verdict: rewrite because the answer is supported, but the question is too broad and too easy for reliable reading validation.",
    judges,
    recommendedRewrite:
      scenario === "ambiguous-easy"
        ? {
            question: "What does Mara tie around the mayor's tray to keep the orders from being confused?",
            answer: "red ribbon",
            reason: "This version is grounded in a concrete action and cannot be answered reliably without reading the excerpt.",
          }
        : undefined,
    provider: "demo",
    model: mode === "fast" ? "local/offline-fast-jury" : "local/offline-chief-judge",
    latencyMs: mode === "fast" ? 460 : 1320,
    usage: {
      promptTokens: mode === "fast" ? 1250 : 3300,
      completionTokens: mode === "fast" ? 720 : 1100,
      totalTokens: mode === "fast" ? 1970 : 4400,
    },
  };

  const normalized = normalizeFinalDecision(raw);
  return JuryResultSchema.parse({
    ...normalized,
    source: "local",
    finalDecision: raw.finalDecision,
  });
}

export function getFallbackRewrite(input: JuryInput): RewriteResult {
  const scenario = detectScenario(input);
  const rewrite =
    scenario === "bad-evidence"
      ? {
          question: "What shape did the three bright stars resemble after the clouds parted?",
          answer: "crooked crown",
          reason: "The answer is explicitly supported by the excerpt and avoids unsupported constellation knowledge.",
        }
      : scenario === "ambiguous-easy"
        ? {
            question: "What does Mara tie around the mayor's tray to keep the orders from being confused?",
            answer: "red ribbon",
            reason: "The rewrite targets a concrete action from the scene instead of asking for an overly easy location.",
          }
        : {
            question: "What object does Nimmie Amee polish inside the cottage?",
            answer: "silver whistle",
            reason: "The original question is already strong, so local mode keeps the grounded scene-specific version.",
          };

  return RewriteResultSchema.parse({
    ...rewrite,
    source: "local",
    provider: "demo",
    model: "local/offline-rewrite-agent",
    latencyMs: 610,
    usage: {
      promptTokens: 900,
      completionTokens: 180,
      totalTokens: 1080,
    },
  });
}
