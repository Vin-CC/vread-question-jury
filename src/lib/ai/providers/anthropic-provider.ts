import Anthropic from "@anthropic-ai/sdk";
import { AiProviderError } from "../errors";
import type { AiConfig, AiCompletionRequest, AiCompletionResponse, AiProvider } from "../types";

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic" as const;

  constructor(private readonly config: AiConfig) {}

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    if (!this.config.apiKey) {
      throw new AiProviderError({ message: "ANTHROPIC_API_KEY is not configured.", provider: this.name, task: request.task });
    }

    const model = request.model || this.config.models[request.task];

    // The Messages API takes the system prompt as a top-level field, not as a message role.
    const systemParts = request.messages.filter((message) => message.role === "system").map((message) => message.content);
    if (request.responseFormat === "json") {
      systemParts.push("Respond with a single valid JSON object only. No markdown fences, no prose outside the JSON.");
    }
    const messages = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role as "user" | "assistant", content: message.content }));
    if (messages.length === 0 || messages[0].role !== "user") {
      messages.unshift({ role: "user", content: "Follow the instructions above." });
    }

    const client = new Anthropic({ apiKey: this.config.apiKey });

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model,
        max_tokens: request.maxOutputTokens ?? this.config.maxOutputTokens,
        system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
        messages,
        // Sampling params (temperature/top_p) are rejected by Claude Opus 4.7+ models — never sent.
        ...(this.config.reasoningEffort !== "none"
          ? {
              thinking: { type: "adaptive" as const },
              output_config: { effort: this.config.reasoningEffort },
            }
          : {}),
      });
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new AiProviderError({
          message: `Anthropic API error (${error.status ?? "network"}): ${error.message}`,
          provider: this.name,
          task: request.task,
          statusCode: typeof error.status === "number" ? error.status : undefined,
          cause: error,
        });
      }
      throw new AiProviderError({
        message: error instanceof Error ? `Anthropic network error: ${error.message}` : "Anthropic network error.",
        provider: this.name,
        task: request.task,
        cause: error,
      });
    }

    if (response.stop_reason === "refusal") {
      throw new AiProviderError({
        message: "Anthropic declined the request (stop_reason: refusal).",
        provider: this.name,
        task: request.task,
      });
    }

    let content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    if (request.responseFormat === "json") {
      content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }
    if (!content) {
      throw new AiProviderError({ message: "Anthropic returned an empty model response.", provider: this.name, task: request.task });
    }

    return {
      content,
      provider: this.name,
      model: response.model || model,
      latencyMs: 0,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      raw: response,
    };
  }
}
