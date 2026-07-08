import type { WorkflowStepKey, WorkflowStepState } from "./types";

export const workflowNodeDefinitions: Array<Pick<WorkflowStepState, "key" | "label" | "summary">> = [
  {
    key: "documentInput",
    label: "Document Input",
    summary: "Upload PDF/EPUB or choose a built-in sample.",
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
    key: "strictJury",
    label: "Strict Jury",
    summary: "Parallel specialized judges and Chief Judge aggregation.",
  },
  {
    key: "rewrite",
    label: "Rewrite",
    summary: "Improve fixable weak questions.",
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
