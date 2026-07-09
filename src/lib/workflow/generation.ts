import { completeWithAi } from "@/lib/ai/gateway";
import { parseJsonObject } from "@/lib/jury/json";
import { buildQuestionGenerationPrompt } from "./prompts";
import {
  QuestionGenerationResponseSchema,
  type GeneratedQuestion,
  type TextSegment,
} from "./types";

export async function generateQuestionsForSegment(segment: TextSegment): Promise<GeneratedQuestion[]> {
  const prompt = buildQuestionGenerationPrompt(segment);
  const response = await completeWithAi({
    task: "questionGeneration",
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    responseFormat: "json",
    maxOutputTokens: 1200,
    temperature: 0.2,
  });

  const parsed = QuestionGenerationResponseSchema.parse(parseJsonObject(response.content));
  return parsed.questions.map((question, index) => ({
    ...question,
    id: `q-${segment.index}-${index}`,
    segmentIndex: segment.index,
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
