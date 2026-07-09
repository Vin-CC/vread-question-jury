import type { JuryResult } from "@/lib/jury/types";
import type { QualityGateResult } from "./types";

export const GLOBAL_SCORE_PASS_THRESHOLD = 75;
export const GLOBAL_SCORE_WARNING_THRESHOLD = 60;

export function evaluateQualityGate(
  fastJury: JuryResult,
  options: { rewriteAttempted?: boolean } = {}
): QualityGateResult {
  const evidenceJudge = fastJury.judges.find((judge) => judge.judge === "evidence");
  const evidenceDecision: QualityGateResult["evidenceDecision"] = evidenceJudge?.decision ?? "unknown";
  const fastJuryScore = fastJury.globalScore;
  const rejectingJudges = fastJury.judges.filter((judge) => judge.decision === "reject");
  const hasCriticalIssue = evidenceDecision === "reject" || rejectingJudges.length > 0;
  const base = { fastJuryScore, evidenceDecision };

  if (fastJury.finalDecision === "reject") {
    return {
      ...base,
      route: "reject",
      reason: `Fast Jury rejected the question (score ${fastJuryScore}). The pipeline stops here.`,
    };
  }

  if (fastJury.finalDecision === "rewrite") {
    if (options.rewriteAttempted) {
      return {
        ...base,
        route: "strictReview",
        reason: `Fast Jury still asks for a rewrite after one rewrite attempt (score ${fastJuryScore}); escalating to Strict Review instead of looping.`,
      };
    }
    return {
      ...base,
      route: "rewrite",
      reason: `Fast Jury flagged fixable weaknesses (score ${fastJuryScore}); routing to Rewrite.`,
    };
  }

  if (fastJuryScore >= GLOBAL_SCORE_PASS_THRESHOLD && !hasCriticalIssue) {
    return {
      ...base,
      route: "approve",
      reason: `Fast Jury approved with a high score (${fastJuryScore} >= ${GLOBAL_SCORE_PASS_THRESHOLD}) and no critical issue; Strict Review is skipped to save cost.`,
    };
  }

  if (hasCriticalIssue) {
    return {
      ...base,
      route: "strictReview",
      reason:
        evidenceDecision === "reject"
          ? `The evidence judge rejected despite an overall approval (score ${fastJuryScore}); escalating to Strict Review.`
          : `${rejectingJudges.length} judge${rejectingJudges.length === 1 ? "" : "s"} rejected despite an overall approval (score ${fastJuryScore}); escalating to Strict Review.`,
    };
  }

  return {
    ...base,
    route: "strictReview",
    reason: `Fast Jury approved but the score ${fastJuryScore} is below the confident-approval threshold (${GLOBAL_SCORE_PASS_THRESHOLD}); escalating to Strict Review.`,
  };
}

// After a rewrite, a near-threshold question only needs the cheap jury again,
// while a weak one goes straight to the strict panel.
export function juryStepAfterRewrite(gate: QualityGateResult): "fastJury" | "strictJury" {
  return gate.fastJuryScore >= GLOBAL_SCORE_WARNING_THRESHOLD ? "fastJury" : "strictJury";
}
