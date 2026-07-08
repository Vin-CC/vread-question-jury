import { clsx } from "clsx";
import type { JudgeDecision } from "@/lib/jury/types";

const labelByDecision: Record<JudgeDecision, string> = {
  approve: "Approved",
  rewrite: "Rewrite",
  reject: "Rejected",
};

export function StatusBadge({
  decision,
  compact = false,
}: {
  decision: JudgeDecision;
  compact?: boolean;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-3 py-1 font-semibold",
        compact ? "text-xs" : "text-sm",
        decision === "approve" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        decision === "rewrite" && "border-amber-200 bg-amber-50 text-amber-800",
        decision === "reject" && "border-red-200 bg-red-50 text-red-800"
      )}
    >
      {labelByDecision[decision]}
    </span>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 85 ? "bg-emerald-600" : score >= 60 ? "bg-amber-500" : "bg-red-600";

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={clsx("h-full rounded-full", color)} style={{ width: `${score}%` }} />
    </div>
  );
}
