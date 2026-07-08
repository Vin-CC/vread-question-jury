import { getAiConfig } from "./config";
import { AiProviderError } from "./errors";
import { modelForTask } from "./model-routing";
import { DemoProvider } from "./providers/demo-provider";
import { OpenAIProvider } from "./providers/openai-provider";
import { OpenRouterProvider } from "./providers/openrouter-provider";
import type { AiCompletionRequest, AiCompletionResponse, AiProvider } from "./types";

export function createAiProvider(options: { forceDemoFallback?: boolean } = {}): AiProvider {
  const config = getAiConfig(options);
  if (config.provider === "demo") return new DemoProvider();
  if (config.provider === "openai") return new OpenAIProvider(config);
  return new OpenRouterProvider(config);
}

export async function completeWithAi(
  request: AiCompletionRequest,
  options: { forceDemoFallback?: boolean } = {}
): Promise<AiCompletionResponse> {
  const config = getAiConfig(options);
  const provider = createAiProvider(options);
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
