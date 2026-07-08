import { z } from "zod";
import type { OpenRouterMessage, TokenUsage } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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

export class OpenRouterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export type OpenRouterCallResult = {
  content: string;
  model: string;
  latencyMs: number;
  usage?: TokenUsage;
};

export const defaultFastModel = "openai/gpt-4o-mini";
export const defaultStrictModel = "openai/gpt-4o-mini";
export const defaultChiefModel = "openai/gpt-4o-mini";
export const defaultRewriteModel = "openai/gpt-4o-mini";

export function getModel(kind: "fast" | "strict" | "chief" | "rewrite") {
  if (kind === "fast") return process.env.OPENROUTER_FAST_MODEL || defaultFastModel;
  if (kind === "chief") return process.env.OPENROUTER_CHIEF_MODEL || defaultChiefModel;
  if (kind === "rewrite") return process.env.OPENROUTER_REWRITE_MODEL || defaultRewriteModel;
  return process.env.OPENROUTER_STRICT_MODEL || defaultStrictModel;
}

export async function callOpenRouter({
  model,
  messages,
  temperature = 0.1,
  maxTokens = 1600,
}: {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<OpenRouterCallResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OpenRouterError("OPENROUTER_API_KEY is not configured.");
  }

  const started = Date.now();
  let response: Response;

  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "VREAD Question Jury",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
    });
  } catch (error) {
    throw new OpenRouterError(
      error instanceof Error ? `OpenRouter network error: ${error.message}` : "OpenRouter network error."
    );
  }

  const latencyMs = Date.now() - started;
  const raw = await response.text();

  if (!response.ok) {
    let message = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
      message = parsed.error?.message || parsed.message || raw;
    } catch {
      // keep raw text
    }
    throw new OpenRouterError(`OpenRouter API error (${response.status}): ${message}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new OpenRouterError("OpenRouter returned non-JSON API response.");
  }

  const parsed = completionSchema.safeParse(json);
  if (!parsed.success) {
    throw new OpenRouterError("OpenRouter response did not match the expected chat completion shape.");
  }

  const content = parsed.data.choices[0]?.message.content?.trim();
  if (!content) {
    throw new OpenRouterError("OpenRouter returned an empty model response.");
  }

  return {
    content,
    model: parsed.data.model || model,
    latencyMs,
    usage: parsed.data.usage
      ? {
          promptTokens: parsed.data.usage.prompt_tokens,
          completionTokens: parsed.data.usage.completion_tokens,
          totalTokens: parsed.data.usage.total_tokens,
        }
      : undefined,
  };
}
