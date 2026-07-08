import type { AiProviderName, AiTask } from "./types";

export class AiProviderError extends Error {
  readonly provider?: AiProviderName;
  readonly task?: AiTask;
  readonly statusCode?: number;

  constructor({
    message,
    provider,
    task,
    statusCode,
    cause,
  }: {
    message: string;
    provider?: AiProviderName;
    task?: AiTask;
    statusCode?: number;
    cause?: unknown;
  }) {
    super(message);
    this.name = "AiProviderError";
    this.provider = provider;
    this.task = task;
    this.statusCode = statusCode;
    this.cause = cause;
  }
}
