"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import type { WorkflowStepKey, WorkflowStepState } from "@/lib/workflow/types";
import WorkflowNode, { type WorkflowNodeData } from "./WorkflowNode";

const nodeTypes = {
  workflow: WorkflowNode,
};

const positions: Record<WorkflowStepKey, { x: number; y: number }> = {
  documentInput: { x: 0, y: 40 },
  textExtraction: { x: 280, y: 40 },
  cleaning: { x: 560, y: 40 },
  segmentation: { x: 840, y: 40 },
  segmentSelection: { x: 1120, y: 40 },
  questionGeneration: { x: 1120, y: 250 },
  fastJury: { x: 840, y: 250 },
  strictJury: { x: 560, y: 250 },
  rewrite: { x: 280, y: 250 },
  finalOutput: { x: 0, y: 250 },
};

const links: Array<[WorkflowStepKey, WorkflowStepKey]> = [
  ["documentInput", "textExtraction"],
  ["textExtraction", "cleaning"],
  ["cleaning", "segmentation"],
  ["segmentation", "segmentSelection"],
  ["segmentSelection", "questionGeneration"],
  ["questionGeneration", "fastJury"],
  ["fastJury", "strictJury"],
  ["strictJury", "rewrite"],
  ["rewrite", "finalOutput"],
];

export function WorkflowCanvas({
  steps,
  selectedKey,
  onSelect,
}: {
  steps: Record<WorkflowStepKey, WorkflowStepState>;
  selectedKey: WorkflowStepKey;
  onSelect: (key: WorkflowStepKey) => void;
}) {
  const nodes: Node<WorkflowNodeData>[] = Object.values(steps).map((step) => ({
    id: step.key,
    type: "workflow",
    position: positions[step.key],
    data: {
      key: step.key,
      label: step.label,
      summary: step.summary,
      status: step.status,
      selected: selectedKey === step.key,
    },
  }));

  const edges: Edge[] = links.map(([source, target]) => {
    const active = steps[source].status === "success" || steps[target].status === "running";
    const failed = steps[source].status === "error" || steps[target].status === "error";

    return {
      id: `${source}-${target}`,
      source,
      target,
      animated: active && !failed,
      style: {
        stroke: failed ? "#fb7185" : active ? "#22d3ee" : "#334155",
        strokeWidth: active ? 2.5 : 1.5,
      },
    };
  });

  return (
    <div className="h-full min-h-[520px] overflow-hidden rounded-[8px] border border-slate-800 bg-[#070b12]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.45}
        maxZoom={1.25}
        onNodeClick={(_, node) => onSelect(node.id as WorkflowStepKey)}
      >
        <Background color="#1e293b" gap={18} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            const status = (node.data as WorkflowNodeData).status;
            if (status === "success") return "#34d399";
            if (status === "running") return "#60a5fa";
            if (status === "error") return "#fb7185";
            return "#475569";
          }}
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}
