import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import type { WorkflowNodeStatus, WorkflowStepKey } from "@/lib/workflow/types";

export type WorkflowNodeData = {
  key: WorkflowStepKey;
  label: string;
  summary?: string;
  status: WorkflowNodeStatus;
  selected?: boolean;
};

const iconByStatus = {
  idle: Circle,
  running: Loader2,
  success: CheckCircle2,
  error: AlertTriangle,
};

function WorkflowNode({ data }: NodeProps) {
  const node = data as unknown as WorkflowNodeData;
  const Icon = iconByStatus[node.status];

  return (
    <div
      className={clsx(
        "w-[210px] rounded-[8px] border bg-slate-950/95 p-4 shadow-2xl backdrop-blur",
        node.status === "idle" && "border-slate-700",
        node.status === "running" && "border-blue-400 shadow-blue-500/30",
        node.status === "success" && "border-emerald-400 shadow-emerald-500/20",
        node.status === "error" && "border-red-400 shadow-red-500/30",
        node.selected && "ring-2 ring-cyan-300"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-cyan-300" />
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase text-slate-400">{node.key}</div>
        <Icon
          className={clsx(
            "h-4 w-4",
            node.status === "running" && "animate-spin text-blue-300",
            node.status === "success" && "text-emerald-300",
            node.status === "error" && "text-red-300",
            node.status === "idle" && "text-slate-500"
          )}
        />
      </div>
      <div className="text-base font-bold text-white">{node.label}</div>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">{node.summary}</p>
      <Handle type="source" position={Position.Right} className="!bg-cyan-300" />
    </div>
  );
}

export default memo(WorkflowNode);
