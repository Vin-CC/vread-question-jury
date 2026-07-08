"use client";

import { useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import type { WorkflowLog } from "@/lib/workflow/types";
import { clsx } from "clsx";

type LogUsage = NonNullable<WorkflowLog["ai"]>["usage"];

function usageLabel(usage?: LogUsage) {
  if (!usage) return undefined;
  return [
    usage.promptTokens !== undefined ? `in ${usage.promptTokens}` : undefined,
    usage.completionTokens !== undefined ? `out ${usage.completionTokens}` : undefined,
    usage.totalTokens !== undefined ? `total ${usage.totalTokens}` : undefined,
  ]
    .filter(Boolean)
    .join(" / ");
}

export function WorkflowLogs({ logs }: { logs: WorkflowLog[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="h-full rounded-[32px] border border-white bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3"
      >
        <span className="inline-flex items-center gap-2 text-sm font-black text-slate-950">
          <ListChecks className="h-4 w-4 text-violet-600" />
          Execution logs
        </span>
        <span className="inline-flex items-center gap-2 text-xs font-black uppercase text-slate-400">
          {logs.length} events
          <ChevronDown className={clsx("h-4 w-4 transition", open && "rotate-180")} />
        </span>
      </button>
      {!open ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
          Logs are collapsed for demo view. Expand when you need provider, model, latency, or token details.
        </div>
      ) : (
        <div className="mt-4 max-h-[300px] space-y-2 overflow-auto pr-1 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-slate-500">No workflow events yet.</div>
          ) : (
            logs.map((log) => {
              const usage = usageLabel(log.ai?.usage);
              return (
                <div key={log.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex gap-3">
                    <span className="text-slate-400">{log.timestamp}</span>
                    <span
                      className={clsx(
                        "font-black",
                        log.level === "success" && "text-emerald-600",
                        log.level === "error" && "text-red-600",
                        log.level === "info" && "text-blue-600"
                      )}
                    >
                      {log.level.toUpperCase()}
                    </span>
                    <span className="text-slate-700">{log.message}</span>
                  </div>
                  {log.ai && (
                    <div className="mt-1 flex flex-wrap gap-2 pl-[92px] text-[11px] text-slate-500">
                      <span>task {log.ai.task}</span>
                      <span>provider {log.ai.provider}</span>
                      <span>model {log.ai.model}</span>
                      <span>latency {log.ai.latencyMs}ms</span>
                      {usage && <span>tokens {usage}</span>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
