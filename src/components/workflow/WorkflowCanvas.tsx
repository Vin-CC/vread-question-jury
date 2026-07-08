"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import type {
  InspectionAnchor,
  NodeInspectionMode,
  WorkflowStepKey,
  WorkflowStepState,
} from "@/lib/workflow/types";
import WorkflowNode, { type WorkflowNodeData } from "./WorkflowNode";

const nodeTypes = {
  workflow: WorkflowNode,
};

const positions: Record<WorkflowStepKey, { x: number; y: number }> = {
  documentInput: { x: 0, y: 120 },
  textExtraction: { x: 230, y: 120 },
  cleaning: { x: 460, y: 120 },
  segmentation: { x: 690, y: 120 },
  segmentSelection: { x: 920, y: 120 },
  questionGeneration: { x: 1150, y: 120 },
  fastJury: { x: 1380, y: 120 },
  strictJury: { x: 1610, y: 120 },
  rewrite: { x: 1840, y: 120 },
  integrityChecks: { x: 2070, y: 120 },
  vreadExport: { x: 2300, y: 120 },
  finalOutput: { x: 2530, y: 120 },
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
  ["rewrite", "integrityChecks"],
  ["integrityChecks", "vreadExport"],
  ["vreadExport", "finalOutput"],
];

export function WorkflowCanvas({
  steps,
  selectedKey,
  onSelect,
  onInspect,
}: {
  steps: Record<WorkflowStepKey, WorkflowStepState>;
  selectedKey: WorkflowStepKey;
  onSelect: (key: WorkflowStepKey) => void;
  onInspect: (key: WorkflowStepKey, mode: NodeInspectionMode, anchor?: InspectionAnchor) => void;
}) {
  const nodes: Node<WorkflowNodeData>[] = Object.values(steps).map((step, index) => ({
    id: step.key,
    type: "workflow",
    position: positions[step.key],
    data: {
      key: step.key,
      label: step.label,
      stepNumber: index + 1,
      summary: step.summary,
      status: step.status,
      selected: selectedKey === step.key,
      hasInput: step.input !== undefined,
      hasOutput: step.output !== undefined,
      onInspect,
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
      type: "smoothstep",
      style: {
        stroke: failed ? "#fb7185" : active ? "#22c55e" : "#9fb6d8",
        strokeWidth: active ? 6 : 5,
        strokeDasharray: "1 15",
        strokeLinecap: "round",
      },
    };
  });

  return (
    <div className="h-full min-h-[560px] overflow-hidden rounded-[32px] border border-white bg-[#f7f9fe] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.16),0_24px_70px_rgba(79,70,229,0.08)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.35}
        maxZoom={1.2}
        onNodeClick={(_, node) => onSelect(node.id as WorkflowStepKey)}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#d7deea" gap={26} size={1.4} />
        <Controls
          className="!left-5 !top-5 !bottom-auto !rounded-2xl !border !border-slate-200 !bg-white !shadow-lg"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}
