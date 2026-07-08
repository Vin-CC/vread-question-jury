import type {
  GeneratedQuestion,
  IntegrityCheck,
  IntegrityCheckStatus,
  IntegrityReport,
  LocalWorkflowRunSummary,
  VreadExportBundle,
  WorkflowData,
} from "./types";

const GLOBAL_SCORE_PASS_THRESHOLD = 75;
const GLOBAL_SCORE_WARNING_THRESHOLD = 60;
const MIN_SEGMENT_WORDS = 40;

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function slugify(value: string) {
  const slug = normalizeText(value).replace(/\s+/g, "-");
  return slug || "untitled-book";
}

function statusFromChecks(checks: IntegrityCheck[]): IntegrityCheckStatus {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warning")) return "warning";
  return "pass";
}

function check(
  key: string,
  label: string,
  status: IntegrityCheckStatus,
  message: string
): IntegrityCheck {
  return { key, label, status, message };
}

export function resolveFinalQuestion(data: WorkflowData) {
  const jury = data.strictJuryResult ?? data.fastJuryResult;
  const baseQuestion = data.selectedQuestion ?? data.generatedQuestions?.[0];

  if (data.rewrittenQuestion && jury?.finalDecision === "rewrite") {
    return {
      question: data.rewrittenQuestion.question,
      answer: data.rewrittenQuestion.answer,
      source: "rewrite" as const,
      baseQuestion,
    };
  }

  if (!baseQuestion) return undefined;

  return {
    question: baseQuestion.question,
    answer: baseQuestion.answer,
    source: "generated" as const,
    baseQuestion,
  };
}

export function buildIntegrityReport(data: WorkflowData): IntegrityReport {
  const finalQuestion = resolveFinalQuestion(data);
  const segment = data.selectedSegment ?? data.segments?.[0];
  const jury = data.strictJuryResult ?? data.fastJuryResult;
  const evidenceJudge = jury?.judges.find((judge) => judge.judge === "evidence");
  const sourceExcerpt = segment?.analysisWindow.excerpt;
  const answer = finalQuestion?.answer.trim() ?? "";
  const question = finalQuestion?.question.trim() ?? "";
  const normalizedAnswer = normalizeText(answer);
  const normalizedQuestion = normalizeText(question);
  const normalizedExcerpt = normalizeText(sourceExcerpt ?? "");
  const normalizedCandidates = (data.generatedQuestions ?? []).map((candidate) =>
    normalizeText(candidate.question)
  );
  const selectedCandidate = finalQuestion?.baseQuestion;
  const selectedQuestionOccurrences = selectedCandidate
    ? normalizedCandidates.filter((candidate) => candidate === normalizeText(selectedCandidate.question)).length
    : 0;

  const checks: IntegrityCheck[] = [
    check(
      "question_exists",
      "Question exists",
      question ? "pass" : "fail",
      question ? "A final question is available." : "No generated or rewritten question is available."
    ),
    check(
      "answer_exists",
      "Answer exists",
      answer ? "pass" : "fail",
      answer ? "A final answer is available." : "The final answer is missing."
    ),
    check(
      "source_excerpt_exists",
      "Source excerpt exists",
      sourceExcerpt ? "pass" : "fail",
      sourceExcerpt ? "A source excerpt is attached." : "The selected segment has no source excerpt."
    ),
    check(
      "answer_not_in_question",
      "Answer is not present in question",
      answer && question && normalizedQuestion.includes(normalizedAnswer) ? "fail" : "pass",
      answer && question && normalizedQuestion.includes(normalizedAnswer)
        ? "The answer appears inside the question text."
        : "The question does not reveal the answer."
    ),
    check(
      "answer_in_excerpt",
      "Answer appears in source excerpt",
      answer && sourceExcerpt && normalizedExcerpt.includes(normalizedAnswer) ? "pass" : "fail",
      answer && sourceExcerpt && normalizedExcerpt.includes(normalizedAnswer)
        ? "The answer can be found directly in the source excerpt."
        : "The answer could not be found in the source excerpt by exact text match."
    ),
    check(
      "jury_not_reject",
      "Final jury decision is not reject",
      jury?.finalDecision && jury.finalDecision !== "reject" ? "pass" : "fail",
      jury?.finalDecision
        ? `The final jury decision is ${jury.finalDecision}.`
        : "No jury decision is available."
    ),
    check(
      "evidence_judge_not_reject",
      "Evidence judge did not reject",
      evidenceJudge?.decision && evidenceJudge.decision !== "reject" ? "pass" : "fail",
      evidenceJudge
        ? `Evidence judge decision is ${evidenceJudge.decision}.`
        : "No evidence judge result is available."
    ),
    check(
      "global_score_threshold",
      "Global jury score is above threshold",
      !jury
        ? "fail"
        : jury.globalScore >= GLOBAL_SCORE_PASS_THRESHOLD
          ? "pass"
          : jury.globalScore >= GLOBAL_SCORE_WARNING_THRESHOLD && jury.finalDecision !== "reject"
            ? "warning"
            : "fail",
      jury
        ? `Global score is ${jury.globalScore}; pass threshold is ${GLOBAL_SCORE_PASS_THRESHOLD}.`
        : "No jury score is available."
    ),
    check(
      "question_not_duplicated",
      "Question is not duplicated",
      selectedQuestionOccurrences <= 1 ? "pass" : "warning",
      selectedQuestionOccurrences <= 1
        ? "The selected question is unique among generated candidates."
        : "The selected question appears more than once among generated candidates."
    ),
    check(
      "segment_index_exists",
      "Segment index exists",
      typeof segment?.index === "number" ? "pass" : "fail",
      typeof segment?.index === "number"
        ? `Selected segment index is ${segment.index}.`
        : "No selected segment index is available."
    ),
    check(
      "segment_has_enough_text",
      "Selected segment has enough text",
      !segment
        ? "fail"
        : segment.wordCount >= MIN_SEGMENT_WORDS
          ? "pass"
          : "warning",
      segment
        ? `Selected segment has ${segment.wordCount} words.`
        : "No selected segment is available."
    ),
    check(
      "final_output_required_fields",
      "Final output has required fields",
      question && answer && sourceExcerpt && jury ? "pass" : "fail",
      question && answer && sourceExcerpt && jury
        ? "Question, answer, source excerpt, and jury metadata are ready."
        : "One or more required final output fields are missing."
    ),
  ];

  const status = statusFromChecks(checks);
  const failed = checks.filter((item) => item.status === "fail").length;
  const warnings = checks.filter((item) => item.status === "warning").length;

  return {
    status,
    checks,
    summary:
      status === "pass"
        ? "All critical integrity checks passed."
        : status === "warning"
          ? `Integrity passed with ${warnings} warning${warnings === 1 ? "" : "s"}.`
          : `Integrity failed with ${failed} blocking issue${failed === 1 ? "" : "s"}.`,
  };
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function resolveFinalFields(data: WorkflowData) {
  const finalQuestion = resolveFinalQuestion(data);
  const segment = data.selectedSegment ?? data.segments?.[0];
  const jury = data.strictJuryResult ?? data.fastJuryResult;

  if (!finalQuestion || !segment || !jury) {
    throw new Error("A final question, selected segment, and jury result are required before VREAD export.");
  }

  return { finalQuestion, segment, jury };
}

export function buildVreadExport(
  data: WorkflowData,
  runSummary?: LocalWorkflowRunSummary
): VreadExportBundle {
  const { finalQuestion, segment, jury } = resolveFinalFields(data);
  const metadata = data.document?.metadata;
  const title = metadata?.name ?? "Untitled Book";
  const integrityStatus = data.integrityReport?.status ?? "warning";
  const sourceType: "pdf" | "epub" | "sample" =
    metadata?.kind === "pdf" || metadata?.kind === "epub" ? metadata.kind : "sample";
  const wordCount =
    metadata?.wordCount ??
    data.cleanedText?.split(/\s+/).filter(Boolean).length ??
    segment.wordCount;

  const json = {
    book: {
      title,
      slug: slugify(title),
      language: "en",
      expected_segments: data.segments?.length ?? 1,
      source_type: sourceType,
      word_count: wordCount,
      created_from: "vread-question-jury-demo" as const,
    },
    reading_questions: [
      {
        segment_index: segment.index,
        question: finalQuestion.question,
        answer: finalQuestion.answer,
        source_excerpt: segment.analysisWindow.excerpt,
        jury_decision: jury.finalDecision,
        jury_score: jury.globalScore,
        integrity_status: integrityStatus,
      },
    ],
    run_summary: runSummary,
  };

  const sqlPreview = [
    "-- PREVIEW ONLY: this demo does not execute SQL or insert into Supabase.",
    "insert into books (title, slug, language, expected_segments, source_type, word_count, created_from)",
    `values (${sqlString(json.book.title)}, ${sqlString(json.book.slug)}, ${sqlString(json.book.language)}, ${json.book.expected_segments}, ${sqlString(json.book.source_type)}, ${json.book.word_count}, ${sqlString(json.book.created_from)});`,
    "",
    "insert into reading_questions (book_slug, segment_index, question, answer, source_excerpt, jury_decision, jury_score, integrity_status)",
    `values (${sqlString(json.book.slug)}, ${segment.index}, ${sqlString(finalQuestion.question)}, ${sqlString(finalQuestion.answer)}, ${sqlString(segment.analysisWindow.excerpt)}, ${sqlString(jury.finalDecision)}, ${jury.globalScore}, ${sqlString(integrityStatus)});`,
  ].join("\n");

  return { json, sqlPreview };
}

export function collectModelsUsed(data: WorkflowData) {
  const models = new Set<string>();

  for (const question of data.generatedQuestions ?? []) {
    if (question.model) models.add(question.model);
  }

  for (const jury of [data.fastJuryResult, data.strictJuryResult]) {
    if (jury?.model) models.add(jury.model);
    for (const judge of jury?.judges ?? []) {
      if (judge.model) models.add(judge.model);
    }
  }

  if (data.rewrittenQuestion?.model) models.add(data.rewrittenQuestion.model);

  return Array.from(models);
}

export function providerFromData(data: WorkflowData) {
  return (
    data.strictJuryResult?.provider ??
    data.fastJuryResult?.provider ??
    data.rewrittenQuestion?.provider ??
    data.generatedQuestions?.find((question: GeneratedQuestion) => question.provider)?.provider
  );
}
