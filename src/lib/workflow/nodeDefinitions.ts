import type { WorkflowStepKey, WorkflowStepState } from "./types";

export const workflowNodeDefinitions: Array<Pick<WorkflowStepState, "key" | "label" | "summary">> = [
  {
    key: "documentInput",
    label: "Document Input",
    summary: "Upload a real PDF or EPUB document.",
  },
  {
    key: "textExtraction",
    label: "Text Extraction",
    summary: "Extract readable text from the document.",
  },
  {
    key: "cleaning",
    label: "Cleaning",
    summary: "Normalize whitespace and remove obvious noise.",
  },
  {
    key: "segmentation",
    label: "Segmentation",
    summary: "Split the book text into VREAD-style analysis segments.",
  },
  {
    key: "segmentSelection",
    label: "Segment Selection",
    summary: "Pick a segment for question generation.",
  },
  {
    key: "questionGeneration",
    label: "Question Generation",
    summary: "Generate candidate reading-comprehension questions.",
  },
  {
    key: "fastJury",
    label: "Fast Jury",
    summary: "One-call low-cost jury screening.",
  },
  {
    key: "qualityGate",
    label: "Quality Gate",
    summary:
      "Routes the generated question based on Fast Jury results: approve, escalate to Strict Review, rewrite, or reject.",
  },
  {
    key: "strictJury",
    label: "Strict Review",
    summary: "Escalation branch: parallel specialized judges and Chief Judge aggregation.",
  },
  {
    key: "rewrite",
    label: "Rewrite",
    summary: "Correction branch: improve fixable weak questions, then re-judge.",
  },
  {
    key: "integrityChecks",
    label: "Integrity Checks",
    summary: "Validate evidence, jury quality, duplicates, and required fields.",
  },
  {
    key: "vreadExport",
    label: "VREAD Export",
    summary: "Produce VREAD-compatible JSON and SQL preview output.",
  },
  {
    key: "finalOutput",
    label: "Final Output",
    summary: "Approved question, answer, source excerpt, and export JSON.",
  },
];

export const workflowStepKeys = workflowNodeDefinitions.map((node) => node.key) as WorkflowStepKey[];

export function createInitialSteps(): Record<WorkflowStepKey, WorkflowStepState> {
  return workflowNodeDefinitions.reduce(
    (acc, node) => {
      acc[node.key] = {
        key: node.key,
        label: node.label,
        status: "idle",
        summary: node.summary,
      };
      return acc;
    },
    {} as Record<WorkflowStepKey, WorkflowStepState>
  );
}
