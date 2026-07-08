import type { TextSegment } from "./types";

const jsonOnly = "Return JSON only. Do not wrap it in markdown. Do not include text outside JSON.";

export function buildQuestionGenerationPrompt(segment: TextSegment) {
  return {
    system: `You generate VREAD reading-comprehension questions from book excerpts. ${jsonOnly}`,
    user: `Generate 3 candidate questions for this excerpt.

Rules:
- Each answer must be explicitly supported by the excerpt.
- Prefer memorable scene-grounded details over useless lexical details.
- No yes/no questions.
- No multiple choice.
- Questions must be clear and hard to answer without reading.
- Keep answers short and quoteable from the excerpt when possible.

Return this exact JSON shape:
{
  "questions": [
    {"question":"...","answer":"...","rationale":"why this validates reading"}
  ]
}

EXCERPT:
${segment.analysisWindow.excerpt}`,
  };
}
