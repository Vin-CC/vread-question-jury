import { z } from "zod";
import { AiProviderError } from "../errors";
import type { AiConfig, AiCompletionRequest, AiCompletionResponse, AiProvider } from "../types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const completionSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable(),
        }),
      })
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
    })
    .optional(),
});

export class OpenAIProvider implements AiProvider {
  readonly name = "openai" as const;

  constructor(private readonly config: AiConfig) {}

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    if (!this.config.apiKey) {
      throw new AiProviderError({ message: "OPENAI_API_KEY is not configured.", provider: this.name, task: request.task });
    }

    const model = request.model || this.config.models[request.task];
    const payload: Record<string, unknown> = {
      model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxOutputTokens,
    };

    if (request.responseFormat === "json") payload.response_format = { type: "json_object" };
    if (this.config.reasoningEffort !== "none") payload.reasoning_effort = this.config.reasoningEffort;

    let response: Response;
    try {
      response = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new AiProviderError({
        message: error instanceof Error ? `OpenAI network error: ${error.message}` : "OpenAI network error.",
        provider: this.name,
        task: request.task,
        cause: error,
      });
    }

    const raw = await response.text();
    if (!response.ok) {
      let message = raw;
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
        message = parsed.error?.message || parsed.message || raw;
      } catch {
        // Keep raw text.
      }
      throw new AiProviderError({
        message: `OpenAI API error (${response.status}): ${message}`,
        provider: this.name,
        task: request.task,
        statusCode: response.status,
      });
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (error) {
      throw new AiProviderError({
        message: "OpenAI returned non-JSON API response.",
        provider: this.name,
        task: request.task,
        cause: error,
      });
    }

    const parsed = completionSchema.safeParse(json);
    if (!parsed.success) {
      throw new AiProviderError({
        message: "OpenAI response did not match the expected chat completion shape.",
        provider: this.name,
        task: request.task,
        cause: parsed.error,
      });
    }

    const content = parsed.data.choices[0]?.message.content?.trim();
    if (!content) {
      throw new AiProviderError({ message: "OpenAI returned an empty model response.", provider: this.name, task: request.task });
    }

    return {
      content,
      provider: this.name,
      model: parsed.data.model || model,
      latencyMs: 0,
      usage: parsed.data.usage
        ? {
            inputTokens: parsed.data.usage.prompt_tokens,
            outputTokens: parsed.data.usage.completion_tokens,
            totalTokens: parsed.data.usage.total_tokens,
          }
        : undefined,
      raw: json,
    };
  }
}
