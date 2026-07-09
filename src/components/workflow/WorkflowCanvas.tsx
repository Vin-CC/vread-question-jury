"use client";

import "@xyflow/react/dist/style.css";
import { useEffect } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
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
import WorkflowEdge, { type WorkflowEdgeData, type WorkflowEdgeState } from "./WorkflowEdge";

const nodeTypes = {
  workflow: WorkflowNode,
};

const edgeTypes = {
  workflow: WorkflowEdge,
};

const fitViewOptions = { padding: 0.03, minZoom: 0.4, maxZoom: 1.15 };

const positions: Record<WorkflowStepKey, { x: number; y: number }> = {
  documentInput: { x: 0, y: 120 },
  textExtraction: { x: 140, y: 120 },
  cleaning: { x: 280, y: 120 },
  segmentation: { x: 420, y: 120 },
  segmentSelection: { x: 560, y: 120 },
  questionGeneration: { x: 700, y: 120 },
  fastJury: { x: 870, y: 120 },
  qualityGate: { x: 1060, y: 120 },
  rewrite: { x: 960, y: -200 },
  strictJury: { x: 1250, y: 400 },
  integrityChecks: { x: 1430, y: 120 },
  vreadExport: { x: 1570, y: 120 },
  finalOutput: { x: 1710, y: 120 },
};

type FlowLink = {
  source: WorkflowStepKey;
  target: WorkflowStepKey;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  curve?: WorkflowEdgeData["curve"];
  labelDx?: number;
  labelDy?: number;
};

const links: FlowLink[] = [
  { source: "documentInput", target: "textExtraction" },
  { source: "textExtraction", target: "cleaning" },
  { source: "cleaning", target: "segmentation" },
  { source: "segmentation", target: "segmentSelection" },
  { source: "segmentSelection", target: "questionGeneration" },
  { source: "questionGeneration", target: "fastJury" },
  { source: "fastJury", target: "qualityGate" },
  {
    source: "qualityGate",
    target: "integrityChecks",
    label: "approve",
    labelDy: -26,
  },
  {
    source: "qualityGate",
    target: "strictJury",
    sourceHandle: "source-bottom",
    targetHandle: "target-top",
    label: "escalate",
    labelDx: -46,
  },
  {
    source: "qualityGate",
    target: "rewrite",
    sourceHandle: "source-top",
    targetHandle: "target-bottom",
    label: "rewrite",
    labelDx: 34,
  },
  {
    source: "rewrite",
    target: "fastJury",
    sourceHandle: "source-bottom",
    targetHandle: "target-top",
    label: "re-judge",
    labelDx: -54,
  },
  {
    source: "rewrite",
    target: "strictJury",
    targetHandle: "target-top",
    label: "re-judge",
    curve: "bezier",
    labelDx: 150,
    labelDy: 190,
  },
  {
    source: "strictJury",
    target: "integrityChecks",
    targetHandle: "target-bottom",
    label: "verified",
    labelDx: 26,
    labelDy: 10,
  },
  { source: "integrityChecks", target: "vreadExport" },
  { source: "vreadExport", target: "finalOutput" },
];

// React Flow only fits the view on mount; re-fit whenever the surrounding
// layout changes (e.g. the inspector opens or closes).
function AutoFit({ trigger }: { trigger: unknown }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const id = window.setTimeout(() => {
      void fitView({ ...fitViewOptions, duration: 320 });
    }, 60);
    return () => window.clearTimeout(id);
  }, [trigger, fitView]);
  return null;
}

export function WorkflowCanvas({
  steps,
  selectedKey,
  fitTrigger,
  onSelect,
  onInspect,
}: {
  steps: Record<WorkflowStepKey, WorkflowStepState>;
  selectedKey: WorkflowStepKey;
  fitTrigger?: unknown;
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

  const edges: Edge[] = links.map(
    ({ source, target, sourceHandle, targetHandle, label, curve, labelDx, labelDy }) => {
      const sourceStatus = steps[source].status;
      const targetStatus = steps[target].status;
      const running = targetStatus === "running" && sourceStatus === "success";
      const taken =
        sourceStatus === "success" && (targetStatus === "success" || targetStatus === "running");
      const failed = sourceStatus === "error" || targetStatus === "error";
      const skipped = sourceStatus === "skipped" || targetStatus === "skipped";
      const state: WorkflowEdgeState = failed
        ? "failed"
        : skipped
          ? "skipped"
          : running || taken
            ? "active"
            : "idle";

      return {
        id: `${source}-${target}`,
        source,
        target,
        // Explicit handle ids: nodes with several source/target handles would
        // otherwise attach the edge to the first rendered handle.
        sourceHandle: sourceHandle ?? "source-right",
        targetHandle: targetHandle ?? "target-left",
        animated: running && !failed,
        type: "workflow",
        label,
        data: { curve, state, labelDx, labelDy } satisfies WorkflowEdgeData,
      };
    }
  );

  return (
    <div className="h-full min-h-0 overflow-hidden rounded-[28px] border border-white bg-[#f7f9fe] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.16),0_24px_70px_rgba(79,70,229,0.08)]">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={fitViewOptions}
          minZoom={0.3}
          maxZoom={1.6}
          onNodeClick={(_, node) => onSelect(node.id as WorkflowStepKey)}
          proOptions={{ hideAttribution: true }}
        >
          <AutoFit trigger={fitTrigger} />
          <Background color="#d7deea" gap={26} size={1.4} />
          <Controls
            className="!left-5 !top-5 !bottom-auto !rounded-2xl !border !border-slate-200 !bg-white !shadow-lg"
            showInteractive={false}
          />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
