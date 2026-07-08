import type { WorkflowLog } from "@/lib/workflow/types";
import { clsx } from "clsx";

export function WorkflowLogs({ logs }: { logs: WorkflowLog[] }) {
  return (
    <div className="h-full rounded-[8px] border border-slate-800 bg-[#070b12] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase text-slate-300">Execution Logs</h2>
        <span className="text-xs text-slate-500">{logs.length} events</span>
      </div>
      <div className="max-h-[220px] space-y-2 overflow-auto pr-1 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-slate-500">No workflow events yet.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-3 rounded bg-slate-900/70 px-3 py-2">
              <span className="text-slate-500">{log.timestamp}</span>
              <span
                className={clsx(
                  "font-bold",
                  log.level === "success" && "text-emerald-300",
                  log.level === "error" && "text-red-300",
                  log.level === "info" && "text-cyan-300"
                )}
              >
                {log.level.toUpperCase()}
              </span>
              <span className="text-slate-300">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
