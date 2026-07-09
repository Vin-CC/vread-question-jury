import { getAiConfig } from "./config";
import { AiProviderError } from "./errors";
import { modelForTask } from "./model-routing";
import { AnthropicProvider } from "./providers/anthropic-provider";
import { ClaudeCliProvider } from "./providers/claude-cli-provider";
import { OpenAIProvider } from "./providers/openai-provider";
import { OpenRouterProvider } from "./providers/openrouter-provider";
import type { AiCompletionRequest, AiCompletionResponse, AiProvider } from "./types";

export function createAiProvider(): AiProvider {
  const config = getAiConfig();
  if (config.provider === "openai") return new OpenAIProvider(config);
  if (config.provider === "anthropic") return new AnthropicProvider(config);
  if (config.provider === "claude-cli") return new ClaudeCliProvider(config);
  return new OpenRouterProvider(config);
}

export async function completeWithAi(request: AiCompletionRequest): Promise<AiCompletionResponse> {
  const config = getAiConfig();
  const provider = createAiProvider();
  const started = Date.now();
  const model = request.model || modelForTask(config.models, request.task);

  try {
    const response = await provider.complete({
      ...request,
      model,
      temperature: request.temperature ?? config.temperature,
      maxOutputTokens: request.maxOutputTokens ?? config.maxOutputTokens,
    });

    return {
      ...response,
      provider: provider.name,
      model: response.model || model,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    if (error instanceof AiProviderError) {
      throw new AiProviderError({
        message: error.message,
        provider: error.provider ?? provider.name,
        task: error.task ?? request.task,
        statusCode: error.statusCode,
        cause: error,
      });
    }

    throw new AiProviderError({
      message: error instanceof Error ? error.message : "AI provider call failed.",
      provider: provider.name,
      task: request.task,
      cause: error,
    });
  }
}
