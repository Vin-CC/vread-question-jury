import { getFallbackJuryResult, getFallbackRewrite } from "@/lib/jury/fallback";
import type { JudgeName, JuryInput } from "@/lib/jury/types";
import type { AiCompletionRequest, AiCompletionResponse, AiProvider } from "../types";

const judgeTaskMap: Partial<Record<AiCompletionRequest["task"], JudgeName>> = {
  evidenceJudge: "evidence",
  ambiguityJudge: "ambiguity",
  antiCheatJudge: "antiCheat",
  clarityJudge: "clarity",
  pedagogyJudge: "pedagogy",
};

function extractAfter(label: string, text: string, nextLabels: string[]) {
  const start = text.indexOf(label);
  if (start < 0) return "";
  const fromLabel = start + label.length;
  const nextIndexes = nextLabels
    .map((nextLabel) => text.indexOf(nextLabel, fromLabel))
    .filter((index) => index >= 0);
  const end = nextIndexes.length > 0 ? Math.min(...nextIndexes) : text.length;
  return text.slice(fromLabel, end).trim();
}

function inputFromPrompt(request: AiCompletionRequest): JuryInput {
  const user = request.messages.find((message) => message.role === "user")?.content ?? "";
  const excerpt = extractAfter("SOURCE EXCERPT:", user, ["GENERATED QUESTION:", "EXPECTED ANSWER:", "JUDGE RESULTS:", "JURY CONTEXT:"]);
  const question = extractAfter("GENERATED QUESTION:", user, ["EXPECTED ANSWER:", "JUDGE RESULTS:", "JURY CONTEXT:"]);
  const answer = extractAfter("EXPECTED ANSWER:", user, ["JUDGE RESULTS:", "JURY CONTEXT:", "Check:", "JUDGES:", "Return this exact JSON shape:"]);

  return {
    excerpt,
    question,
    answer,
    exampleId: question.toLowerCase().includes("where is mara")
      ? "ambiguous-easy"
      : answer.toLowerCase().includes("orion")
        ? "bad-evidence"
        : "good",
  };
}

function excerptFromQuestionPrompt(request: AiCompletionRequest) {
  const user = request.messages.find((message) => message.role === "user")?.content ?? "";
  return extractAfter("EXCERPT:", user, []);
}

function demoQuestions(excerpt: string) {
  const lower = excerpt.toLowerCase();
  if (lower.includes("red ribbon") || lower.includes("mayor")) {
    return {
      questions: [
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
      ],
    };
  }

  if (lower.includes("crooked crown") || lower.includes("telescope")) {
    return {
      questions: [
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
      ],
    };
  }

  return {
    questions: [
      {
        question: "What concrete object is most important in the selected scene?",
        answer: excerpt.split(/\s+/).filter(Boolean).slice(0, 2).join(" ") || "the excerpt",
        rationale: "Fallback generic candidate when no document-specific pattern matches.",
      },
    ],
  };
}

function usageForTask(task: AiCompletionRequest["task"]) {
  if (task === "questionGeneration") return { inputTokens: 740, outputTokens: 280, totalTokens: 1020 };
  if (task === "fastJury") return { inputTokens: 1250, outputTokens: 720, totalTokens: 1970 };
  if (task === "chiefJudge") return { inputTokens: 3300, outputTokens: 1100, totalTokens: 4400 };
  if (task === "rewrite") return { inputTokens: 900, outputTokens: 180, totalTokens: 1080 };
  return { inputTokens: 520, outputTokens: 260, totalTokens: 780 };
}

export class DemoProvider implements AiProvider {
  readonly name = "demo" as const;

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const input = request.task === "questionGeneration" ? undefined : inputFromPrompt(request);
    const model =
      request.model ||
      (request.task === "questionGeneration"
        ? "demo/question-generator"
        : request.task === "rewrite"
          ? "demo/rewrite-agent"
          : request.task === "chiefJudge"
            ? "demo/chief-judge"
            : request.task === "fastJury"
              ? "demo/fast-jury"
              : `demo/${judgeTaskMap[request.task] ?? "strict"}-judge`);

    let body: unknown;
    if (request.task === "questionGeneration") {
      body = demoQuestions(excerptFromQuestionPrompt(request));
    } else if (request.task === "fastJury") {
      body = getFallbackJuryResult(input as JuryInput, "fast");
    } else if (request.task === "chiefJudge") {
      body = getFallbackJuryResult(input as JuryInput, "strict");
    } else if (request.task === "rewrite") {
      body = getFallbackRewrite(input as JuryInput);
    } else {
      const judgeName = judgeTaskMap[request.task];
      body = getFallbackJuryResult(input as JuryInput, "strict").judges.find((judge) => judge.judge === judgeName);
    }

    return {
      content: JSON.stringify(body),
      provider: this.name,
      model,
      latencyMs: 0,
      usage: usageForTask(request.task),
      raw: body,
    };
  }
}
