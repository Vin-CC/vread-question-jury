import type { JudgeName, JuryInput, JudgeResult } from "./types";

const jsonRules = `Return JSON only. Do not wrap JSON in markdown. Do not include commentary outside JSON. Use double-quoted JSON keys and strings.`;

const scoringRules = `Scores are integers from 0 to 100.
Final decision policy:
- approve only when globalScore >= 85 and no critical judge rejects.
- rewrite when globalScore is 60-84 or the issue is fixable.
- reject when globalScore < 60 or evidence is missing.
Critical rule: if the Evidence Judge finds that the expected answer is not explicitly supported by the excerpt, finalDecision cannot be approve.`;

const inputBlock = ({ excerpt, question, answer }: JuryInput) => `SOURCE EXCERPT:
${excerpt}

GENERATED QUESTION:
${question}

EXPECTED ANSWER:
${answer}`;

const judgeContract = (judge: JudgeName) => `Return this exact JSON shape:
{
  "judge": "${judge}",
  "score": 0,
  "decision": "approve" | "rewrite" | "reject",
  "reason": "specific reason tied to the excerpt",
  "failureModes": ["short labels for detected problems"],
  "suggestedFix": "optional concise fix"
}`;

const strictCommon = `You are a strict VREAD reading-comprehension judge.
Do not be impressed by fluent writing.
Reward only questions that are grounded in the excerpt, clear, hard to answer without reading, unambiguous, and useful for comprehension.
Answers should be explicitly supported by the source excerpt. Questions should test narrative attention, not useless lexical memory.`;

export function buildFastJuryPrompt(input: JuryInput) {
  return {
    system: `${strictCommon}
You simulate five independent specialized judges and one chief judge in a single low-cost screening pass.
${jsonRules}`,
    user: `${inputBlock(input)}

JUDGES:
1. Evidence Judge: checks whether the expected answer is explicitly supported by the source excerpt.
2. Ambiguity Judge: checks whether several answers could be valid.
3. Anti-Cheat Judge: checks whether the question could be answered without reading the excerpt.
4. Clarity Judge: checks whether the question is clear and specific.
5. Pedagogy Judge: checks whether the question tests meaningful comprehension rather than a useless detail.
6. Chief Judge: aggregates judge results and returns finalDecision.

${scoringRules}

Return this exact JSON shape:
{
  "mode": "fast",
  "globalScore": 0,
  "finalDecision": "approve" | "rewrite" | "reject",
  "summary": "brief verdict",
  "judges": [
    {"judge":"evidence","score":0,"decision":"approve","reason":"...","failureModes":[],"suggestedFix":"..."},
    {"judge":"ambiguity","score":0,"decision":"approve","reason":"...","failureModes":[],"suggestedFix":"..."},
    {"judge":"antiCheat","score":0,"decision":"approve","reason":"...","failureModes":[],"suggestedFix":"..."},
    {"judge":"clarity","score":0,"decision":"approve","reason":"...","failureModes":[],"suggestedFix":"..."},
    {"judge":"pedagogy","score":0,"decision":"approve","reason":"...","failureModes":[],"suggestedFix":"..."}
  ],
  "recommendedRewrite": {"question":"...","answer":"...","reason":"..."}
}

Only include recommendedRewrite when finalDecision is "rewrite".`,
  };
}

export function buildEvidenceJudgePrompt(input: JuryInput) {
  return {
    system: `${strictCommon}
You are the Evidence Judge. Your only job is to verify textual grounding.
Reject when the expected answer is absent, contradicted, inferred from outside knowledge, or only loosely implied.
${jsonRules}`,
    user: `${inputBlock(input)}

Check: Does the expected answer appear explicitly or is it directly and unambiguously supported by the excerpt?
For VREAD, verbatim or near-verbatim support is preferred. Missing evidence is critical.

${judgeContract("evidence")}`,
  };
}

export function buildAmbiguityJudgePrompt(input: JuryInput) {
  return {
    system: `${strictCommon}
You are the Ambiguity Judge. Your only job is to detect whether multiple answers could reasonably satisfy the question.
${jsonRules}`,
    user: `${inputBlock(input)}

Check whether the wording points to exactly one answer. Penalize vague referents, broad "where/what/who" questions, and questions where several excerpt details could fit.

${judgeContract("ambiguity")}`,
  };
}

export function buildAntiCheatJudgePrompt(input: JuryInput) {
  return {
    system: `${strictCommon}
You are the Anti-Cheat Judge. Your only job is to detect if the question can be answered without reading the excerpt.
${jsonRules}`,
    user: `${inputBlock(input)}

Check whether a user could guess the answer from common sense, the wording of the question, generic book knowledge, or obvious context clues. Reward questions anchored in a specific scene detail.

${judgeContract("antiCheat")}`,
  };
}

export function buildClarityJudgePrompt(input: JuryInput) {
  return {
    system: `${strictCommon}
You are the Clarity Judge. Your only job is to check wording quality and specificity.
${jsonRules}`,
    user: `${inputBlock(input)}

Check whether the question is clear, specific, non-leading, not yes/no, not multiple-choice, and gives enough scene context to identify the answer.

${judgeContract("clarity")}`,
  };
}

export function buildPedagogyJudgePrompt(input: JuryInput) {
  return {
    system: `${strictCommon}
You are the Pedagogy Judge. Your only job is to check reading-comprehension value.
${jsonRules}`,
    user: `${inputBlock(input)}

Check whether the question rewards meaningful narrative attention. Penalize decorative facts, rare-word memory, trivial details, and details that do not help validate actual reading.

${judgeContract("pedagogy")}`,
  };
}

export function buildChiefJudgePrompt(input: JuryInput, judges: JudgeResult[]) {
  return {
    system: `${strictCommon}
You are the Chief Judge. Aggregate independent judge results into the final VREAD decision.
${jsonRules}`,
    user: `${inputBlock(input)}

JUDGE RESULTS:
${JSON.stringify(judges, null, 2)}

${scoringRules}

Compute a defensible globalScore. Evidence missing is a critical failure.

Return this exact JSON shape:
{
  "mode": "strict",
  "globalScore": 0,
  "finalDecision": "approve" | "rewrite" | "reject",
  "summary": "brief verdict",
  "judges": ${JSON.stringify(judges)},
  "recommendedRewrite": {"question":"...","answer":"...","reason":"..."}
}

Only include recommendedRewrite when finalDecision is "rewrite". Preserve each judge object exactly except you may omit model, latencyMs, and usage fields if absent.`,
  };
}

export function buildRewritePrompt(input: JuryInput, result?: { finalDecision: string; summary: string; judges: JudgeResult[] }) {
  return {
    system: `${strictCommon}
You are the Rewrite Agent. Create one better VREAD question and answer pair from the excerpt.
The answer must be explicitly supported by the excerpt. Prefer memorable scene-grounded details.
No yes/no questions. No multiple-choice questions. Avoid trivial or generic questions.
${jsonRules}`,
    user: `${inputBlock(input)}

JURY CONTEXT:
${result ? JSON.stringify(result, null, 2) : "No jury result provided."}

Return this exact JSON shape:
{
  "question": "improved question",
  "answer": "explicitly supported answer",
  "reason": "why this version fixes the issue"
}`,
  };
}
