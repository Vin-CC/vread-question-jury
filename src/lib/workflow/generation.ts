import { completeWithAi } from "@/lib/ai/gateway";
import { parseJsonObject } from "@/lib/jury/json";
import { buildQuestionGenerationPrompt } from "./prompts";
import {
  QuestionGenerationResponseSchema,
  type GeneratedQuestion,
  type TextSegment,
} from "./types";

export async function generateQuestionsForSegment(
  segment: TextSegment,
  forceFallback = false
): Promise<GeneratedQuestion[]> {
  const prompt = buildQuestionGenerationPrompt(segment);
  const response = await completeWithAi(
    {
      task: "questionGeneration",
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      responseFormat: "json",
      maxOutputTokens: 1200,
      temperature: 0.2,
    },
    { forceDemoFallback: forceFallback }
  );

  const parsed = QuestionGenerationResponseSchema.parse(parseJsonObject(response.content));
  return parsed.questions.map((question, index) => ({
    ...question,
    id: `${response.provider === "demo" ? "fallback" : "live"}-q-${segment.index}-${index}`,
    segmentIndex: segment.index,
    source: response.provider === "demo" ? "fallback" : "live",
    provider: response.provider,
    model: response.model,
    latencyMs: response.latencyMs,
    usage: response.usage
      ? {
          promptTokens: response.usage.inputTokens,
          completionTokens: response.usage.outputTokens,
          totalTokens: response.usage.totalTokens,
        }
      : undefined,
  }));
}
