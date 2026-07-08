import { isDemoFallbackEnabled } from "@/lib/jury/fallback";
import { callOpenRouter, getModel } from "@/lib/jury/openrouter";
import { parseJsonObject } from "@/lib/jury/json";
import { buildQuestionGenerationPrompt } from "./prompts";
import {
  QuestionGenerationResponseSchema,
  type GeneratedQuestion,
  type TextSegment,
} from "./types";

function fallbackQuestions(segment: TextSegment): GeneratedQuestion[] {
  const excerpt = segment.analysisWindow.excerpt.toLowerCase();
  const bakery = excerpt.includes("red ribbon") || excerpt.includes("mayor");
  const observatory = excerpt.includes("crooked crown") || excerpt.includes("telescope");

  const questions = bakery
    ? [
        {
          question: "Where is Mara?",
          answer: "bakery",
          rationale: "Intentionally broad first candidate for showing the rewrite path.",
        },
        {
          question: "What does Mara slip around the mayor's tray?",
          answer: "red ribbon",
          rationale: "This targets a concrete action that proves attention to the scene.",
        },
        {
          question: "Which tray held almond cakes?",
          answer: "the mayor's tray",
          rationale: "This checks order-specific comprehension from the excerpt.",
        },
      ]
    : observatory
      ? [
          {
            question: "What object did Karim find covered with dust at the observatory?",
            answer: "brass telescope",
            rationale: "This answer is explicitly grounded in the opening scene.",
          },
          {
            question: "What shape did the three bright stars resemble?",
            answer: "crooked crown",
            rationale: "This tests a memorable visual detail from the excerpt.",
          },
          {
            question: "Who left a note beside the stairs for Karim?",
            answer: "Lina",
            rationale: "This checks a named character tied to a specific action.",
          },
        ]
      : [
          {
            question: "What concrete object is most important in the selected scene?",
            answer: segment.analysisWindow.excerpt.split(/\s+/).slice(0, 2).join(" "),
            rationale: "Fallback generic candidate when no built-in scene pattern matches.",
          },
        ];

  return questions.map((question, index) => ({
    id: `fallback-q-${segment.index}-${index}`,
    segmentIndex: segment.index,
    source: "fallback",
    model: "demo/fallback-question-generator",
    latencyMs: 520,
    ...question,
  }));
}

export async function generateQuestionsForSegment(
  segment: TextSegment,
  forceFallback = false
): Promise<GeneratedQuestion[]> {
  if (forceFallback || isDemoFallbackEnabled()) return fallbackQuestions(segment);

  const model = getModel("fast");
  const prompt = buildQuestionGenerationPrompt(segment);
  const response = await callOpenRouter({
    model,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    maxTokens: 1200,
    temperature: 0.2,
  });

  const parsed = QuestionGenerationResponseSchema.parse(parseJsonObject(response.content));
  return parsed.questions.map((question, index) => ({
    ...question,
    id: `live-q-${segment.index}-${index}`,
    segmentIndex: segment.index,
    source: "live",
    model: response.model,
    latencyMs: response.latencyMs,
  }));
}
