import type { JudgeResult, JuryResult } from "./types";

const weightByJudge: Record<JudgeResult["judge"], number> = {
  evidence: 0.32,
  ambiguity: 0.18,
  antiCheat: 0.18,
  clarity: 0.14,
  pedagogy: 0.18,
};

export function normalizeFinalDecision(result: JuryResult): JuryResult {
  const evidence = result.judges.find((judge) => judge.judge === "evidence");
  const weighted = result.judges.reduce(
    (sum, judge) => sum + judge.score * weightByJudge[judge.judge],
    0
  );
  const globalScore = Math.round(
    Number.isFinite(result.globalScore) ? (result.globalScore + weighted) / 2 : weighted
  );

  const criticalEvidenceReject = evidence?.decision === "reject" || (evidence?.score ?? 100) < 60;
  const anyReject = result.judges.some((judge) => judge.decision === "reject");
  const anyRewrite = result.judges.some((judge) => judge.decision === "rewrite");

  let finalDecision: JuryResult["finalDecision"];
  if (criticalEvidenceReject || globalScore < 60) {
    finalDecision = "reject";
  } else if (globalScore >= 85 && !anyReject && !anyRewrite) {
    finalDecision = "approve";
  } else {
    finalDecision = "rewrite";
  }

  return {
    ...result,
    globalScore,
    finalDecision,
  };
}
