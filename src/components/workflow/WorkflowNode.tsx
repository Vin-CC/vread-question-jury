import { memo, type MouseEvent } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Database,
  Download,
  FileText,
  Filter,
  Gavel,
  Loader2,
  ScanText,
  Scissors,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { clsx } from "clsx";
import type {
  InspectionAnchor,
  NodeInspectionMode,
  WorkflowNodeStatus,
  WorkflowStepKey,
} from "@/lib/workflow/types";

export type WorkflowNodeData = {
  key: WorkflowStepKey;
  label: string;
  stepNumber: number;
  summary?: string;
  status: WorkflowNodeStatus;
  selected?: boolean;
  hasInput?: boolean;
  hasOutput?: boolean;
  onInspect?: (key: WorkflowStepKey, mode: NodeInspectionMode, anchor?: InspectionAnchor) => void;
};

const iconByStatus = {
  idle: Circle,
  running: Loader2,
  success: CheckCircle2,
  error: AlertTriangle,
};

const moduleConfig: Record<WorkflowStepKey, { label: string; icon: typeof FileText; color: string; soft: string }> = {
  documentInput: {
    label: "Document",
    icon: FileText,
    color: "from-blue-500 to-sky-500",
    soft: "bg-blue-50 text-blue-700",
  },
  textExtraction: {
    label: "Extract",
    icon: ScanText,
    color: "from-emerald-500 to-teal-500",
    soft: "bg-emerald-50 text-emerald-700",
  },
  cleaning: {
    label: "Clean",
    icon: Filter,
    color: "from-green-500 to-lime-500",
    soft: "bg-green-50 text-green-700",
  },
  segmentation: {
    label: "Segment",
    icon: Scissors,
    color: "from-teal-500 to-cyan-500",
    soft: "bg-teal-50 text-teal-700",
  },
  segmentSelection: {
    label: "Select",
    icon: Circle,
    color: "from-slate-500 to-slate-700",
    soft: "bg-slate-100 text-slate-700",
  },
  questionGeneration: {
    label: "Generate",
    icon: Sparkles,
    color: "from-cyan-500 to-blue-500",
    soft: "bg-cyan-50 text-cyan-700",
  },
  fastJury: {
    label: "Fast Jury",
    icon: Gavel,
    color: "from-violet-500 to-purple-600",
    soft: "bg-violet-50 text-violet-700",
  },
  strictJury: {
    label: "Strict Jury",
    icon: ShieldCheck,
    color: "from-purple-600 to-fuchsia-600",
    soft: "bg-purple-50 text-purple-700",
  },
  rewrite: {
    label: "Rewrite",
    icon: Wand2,
    color: "from-orange-500 to-amber-500",
    soft: "bg-orange-50 text-orange-700",
  },
  integrityChecks: {
    label: "Integrity",
    icon: ShieldCheck,
    color: "from-teal-500 to-emerald-500",
    soft: "bg-teal-50 text-teal-700",
  },
  vreadExport: {
    label: "Export",
    icon: Database,
    color: "from-emerald-500 to-green-600",
    soft: "bg-emerald-50 text-emerald-700",
  },
  finalOutput: {
    label: "Output",
    icon: Download,
    color: "from-slate-700 to-slate-950",
    soft: "bg-slate-100 text-slate-800",
  },
};

function WorkflowNode({ data }: NodeProps) {
  const node = data as unknown as WorkflowNodeData;
  const StatusIcon = iconByStatus[node.status];
  const config = moduleConfig[node.key];
  const ModuleIcon = config.icon;
  const inspect = (
    event: MouseEvent<HTMLButtonElement>,
    mode: NodeInspectionMode
  ) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    node.onInspect?.(node.key, mode, {
      x: rect.right + 12,
      y: rect.top + rect.height / 2,
    });
  };

  return (
    <div
      className={clsx(
        "group flex w-[160px] cursor-pointer flex-col items-center transition duration-300",
        node.selected && "scale-[1.03]"
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white !bg-violet-400" />
      <div
        className={clsx(
          "relative flex h-[116px] w-[116px] items-center justify-center rounded-full border-[6px] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.16)] transition duration-300",
          node.status === "idle" && "border-slate-200",
          node.status === "running" && "animate-pulse border-blue-400 shadow-blue-400/30",
          node.status === "success" && "border-emerald-400 shadow-emerald-400/25",
          node.status === "error" && "border-red-400 shadow-red-400/25",
          node.selected && "border-violet-500 shadow-[0_0_0_8px_rgba(124,58,237,0.16),0_20px_45px_rgba(79,70,229,0.28)]"
        )}
      >
        <div className={clsx("flex h-[82px] w-[82px] items-center justify-center rounded-full bg-gradient-to-br text-white shadow-inner", config.color)}>
          <ModuleIcon className="h-9 w-9" strokeWidth={2.5} />
        </div>
        <span className="absolute -right-1 -top-1 flex h-9 w-9 items-center justify-center rounded-full border-4 border-white bg-slate-950 text-sm font-black text-white shadow-lg">
          {node.stepNumber}
        </span>
        <StatusIcon
          className={clsx(
            "absolute -bottom-1 -right-1 h-7 w-7 rounded-full border-4 border-white bg-white p-1",
            node.status === "running" && "animate-spin text-blue-600",
            node.status === "success" && "text-emerald-600",
            node.status === "error" && "text-red-600",
            node.status === "idle" && "text-slate-400"
          )}
        />
      </div>
      <div className="mt-4 text-center">
        <div className="text-base font-black text-slate-950">{config.label}</div>
        <div className={clsx("mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase", config.soft)}>
          Step {node.stepNumber}
        </div>
      </div>
      <div className="nodrag nopan mt-3 flex gap-2 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => inspect(event, "input")}
          className={clsx(
            "h-8 rounded-[8px] border px-2 text-xs font-bold transition",
            node.hasInput
              ? "border-blue-200 bg-white text-blue-700 shadow-sm hover:border-blue-300"
              : "border-slate-200 bg-slate-50 text-slate-400"
          )}
        >
          Input
        </button>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => inspect(event, "output")}
          className={clsx(
            "h-8 rounded-[8px] border px-2 text-xs font-bold transition",
            node.hasOutput
              ? "border-emerald-200 bg-white text-emerald-700 shadow-sm hover:border-emerald-300"
              : "border-slate-200 bg-slate-50 text-slate-400"
          )}
        >
          Output
        </button>
      </div>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-emerald-400" />
    </div>
  );
}

export default memo(WorkflowNode);
