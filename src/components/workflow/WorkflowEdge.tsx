"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { clsx } from "clsx";

export type WorkflowEdgeState = "idle" | "active" | "failed" | "skipped";

export type WorkflowEdgeData = {
  // "bezier" for the long diagonal branch edges so they never draw
  // axis-aligned segments through the main row of nodes.
  curve?: "smoothstep" | "bezier";
  state?: WorkflowEdgeState;
  // Pixel offsets applied to the label so chips on crossing branch edges
  // never overlap each other or a node.
  labelDx?: number;
  labelDy?: number;
};

const strokeByState: Record<WorkflowEdgeState, string> = {
  idle: "#9fb6d8",
  active: "#22c55e",
  failed: "#fb7185",
  skipped: "#d3dce8",
};

export default function WorkflowEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label } = props;
  const data = (props.data ?? {}) as WorkflowEdgeData;
  const state = data.state ?? "idle";

  const [path, labelX, labelY] =
    data.curve === "bezier"
      ? getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
      : getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: 26,
        });

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: strokeByState[state],
          strokeWidth: state === "active" ? 6 : 5,
          strokeDasharray: "1 15",
          strokeLinecap: "round",
          opacity: state === "skipped" ? 0.5 : 1,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX + (data.labelDx ?? 0)}px, ${
                labelY + (data.labelDy ?? 0)
              }px)`,
            }}
            className={clsx(
              "pointer-events-none absolute z-10 rounded-full border px-3 py-1 text-[15px] font-black tracking-tight",
              state === "active" && "border-emerald-300 bg-white text-emerald-700 shadow-md",
              state === "failed" && "border-red-200 bg-white text-red-600 shadow-md",
              state === "skipped" && "border-slate-200 bg-white/75 text-slate-400",
              state === "idle" && "border-slate-200 bg-white text-slate-600 shadow-md"
            )}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
