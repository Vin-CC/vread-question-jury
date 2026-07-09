import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { AiProviderError } from "../errors";
import type { AiConfig, AiCompletionRequest, AiCompletionResponse, AiProvider } from "../types";

const CLI_BINARY = process.env.CLAUDE_CLI_PATH?.trim() || "claude";
const CLI_TIMEOUT_MS = 240_000;

type ClaudeCliEnvelope = {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  stop_reason?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
};

function runCli(args: string[], stdin: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    // cwd = tmpdir so the CLI does not load this project's CLAUDE.md/skills into jury prompts.
    const child = spawn(CLI_BINARY, args, { cwd: tmpdir(), env: process.env });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`Claude CLI timed out after ${CLI_TIMEOUT_MS / 1000}s.`));
    }, CLI_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => {
      if (settled) return;
      clearTimeout(timer);
      reject(
        error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
          ? new Error(`Claude CLI binary "${CLI_BINARY}" was not found. Install Claude Code or set CLAUDE_CLI_PATH.`)
          : error
      );
    });
    child.on("close", (code) => {
      if (settled) return;
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });

    child.stdin.write(stdin);
    child.stdin.end();
  });
}

export class ClaudeCliProvider implements AiProvider {
  readonly name = "claude-cli" as const;

  constructor(private readonly config: AiConfig) {}

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const model = request.model || this.config.models[request.task];

    const systemParts = request.messages.filter((message) => message.role === "system").map((message) => message.content);
    if (request.responseFormat === "json") {
      systemParts.push("Respond with a single valid JSON object only. No markdown fences, no prose outside the JSON.");
    }
    const prompt =
      request.messages
        .filter((message) => message.role !== "system")
        .map((message) => message.content)
        .join("\n\n") || "Follow the instructions above.";

    // Headless print mode, JSON envelope, no tools, no session files. Auth reuses the
    // user's Claude Code login (subscription) — no API key required.
    const args = ["-p", "--output-format", "json", "--model", model, "--tools", "", "--no-session-persistence"];
    if (systemParts.length > 0) args.push("--system-prompt", systemParts.join("\n\n"));

    let cli: { stdout: string; stderr: string; code: number | null };
    try {
      cli = await runCli(args, prompt);
    } catch (error) {
      throw new AiProviderError({
        message: error instanceof Error ? `Claude CLI error: ${error.message}` : "Claude CLI error.",
        provider: this.name,
        task: request.task,
        cause: error,
      });
    }

    let envelope: ClaudeCliEnvelope;
    try {
      envelope = JSON.parse(cli.stdout) as ClaudeCliEnvelope;
    } catch {
      throw new AiProviderError({
        message: `Claude CLI returned unparseable output (exit ${cli.code}): ${(cli.stderr || cli.stdout).slice(0, 300)}`,
        provider: this.name,
        task: request.task,
      });
    }

    if (cli.code !== 0 || envelope.is_error || envelope.subtype !== "success") {
      throw new AiProviderError({
        message: `Claude CLI failed (${envelope.subtype ?? `exit ${cli.code}`}): ${(envelope.result || cli.stderr || "no detail").slice(0, 300)}`,
        provider: this.name,
        task: request.task,
      });
    }

    let content = (envelope.result ?? "").trim();
    if (request.responseFormat === "json") {
      content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }
    if (!content) {
      throw new AiProviderError({ message: "Claude CLI returned an empty model response.", provider: this.name, task: request.task });
    }

    const inputTokens =
      (envelope.usage?.input_tokens ?? 0) +
      (envelope.usage?.cache_read_input_tokens ?? 0) +
      (envelope.usage?.cache_creation_input_tokens ?? 0);

    return {
      content,
      provider: this.name,
      model,
      latencyMs: 0,
      usage: {
        inputTokens,
        outputTokens: envelope.usage?.output_tokens,
        totalTokens: inputTokens + (envelope.usage?.output_tokens ?? 0),
      },
      raw: envelope,
    };
  }
}
