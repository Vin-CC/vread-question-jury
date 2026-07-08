# VREAD Document Jury Workflow

Standalone hackathon demo for showing how VREAD can transform a book document into verified reading-comprehension questions through a visual AI workflow.

The app ingests a PDF, EPUB, or built-in sample document, extracts text, cleans it, segments it, generates candidate questions, evaluates them with LLM-as-a-Jury, optionally rewrites weak questions, and exports the final approved output as JSON.

## Project Purpose

VREAD validates reading by asking comprehension questions grounded in source excerpts. The hard part is not only generating questions; it is proving that each question is explicitly supported, unambiguous, hard to guess, clear, and pedagogically useful.

This demo makes that pipeline visible as a node-based workflow:

1. Document Input
2. Text Extraction
3. Cleaning / Normalization
4. Segmentation
5. Segment Selection
6. Question Generation
7. Fast Jury
8. Strict Multi-Agent Jury
9. Rewrite
10. Final Output

## Visual Workflow

The home page is a dark workflow canvas built with React Flow. Each node shows its state:

- `idle`
- `running`
- `success`
- `error`

Click a node to inspect its input/output in the right panel. The bottom panels show workflow logs, detailed jury cards, and raw workflow JSON.

## Supported Document Types

- PDF: text-based PDFs only.
- EPUB: extracts readable XHTML/HTML content from the EPUB archive.
- Built-in samples: included for reliable demos.

Known extraction limitations:

- Scanned image-only PDFs are not OCRed.
- Complex EPUB ordering may be imperfect because this demo uses a lightweight archive/content extraction path.
- The extraction step is hackathon-friendly, not production-grade.

## Historical VREAD Alignment

This standalone demo borrows concepts from the historical VREAD workflow project without modifying it:

- Job-like step sequencing.
- `process -> questions -> review/output` thinking.
- Segment records with `index`, `wordCount`, `text`, and `analysisWindow`.
- Prompt principles that favor explicit source evidence, memorable scene details, no yes/no questions, and answers grounded in the excerpt.

## LLM-as-a-Jury

The jury evaluates generated questions through specialized roles:

- Evidence Judge: verifies that the answer is explicitly supported by the excerpt.
- Ambiguity Judge: checks whether several answers could be valid.
- Anti-Cheat Judge: checks whether the question can be answered without reading.
- Clarity Judge: checks wording and specificity.
- Pedagogy Judge: checks meaningful comprehension value.
- Chief Judge: aggregates results into `approve`, `rewrite`, or `reject`.

Fast Jury Mode uses one OpenRouter call to simulate all judges. Strict Multi-Agent Mode runs separate judge calls in parallel and then sends the validated judge outputs to a Chief Judge.

## OpenRouter

All live LLM calls go through `src/lib/jury/openrouter.ts`.

Environment variables:

```bash
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_FAST_MODEL=openai/gpt-4o-mini
OPENROUTER_STRICT_MODEL=openai/gpt-4o-mini
OPENROUTER_CHIEF_MODEL=openai/gpt-4o-mini
OPENROUTER_REWRITE_MODEL=openai/gpt-4o-mini
```

All model responses are parsed as JSON and validated with Zod before use.

## Demo Fallback Mode

For presentations, set:

```bash
DEMO_FALLBACK_MODE=true
```

Fallback mode prevents the demo from depending on network access, rate limits, or an API key. It provides deterministic document workflow outputs, question generation outputs, jury results, and rewrite results. The UI labels fallback outputs as **Demo fallback**.

If fallback mode is disabled and a live OpenRouter call fails, the workflow automatically attempts a deterministic fallback for that step and logs the failure.

## Run Locally

```bash
cd /home/vincent/Documents/Tests/vread-question-jury
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by Next.js.

Real OpenRouter mode:

```bash
OPENROUTER_API_KEY=your_openrouter_key
DEMO_FALLBACK_MODE=false
```

Presentation fallback mode:

```bash
DEMO_FALLBACK_MODE=true
```

Quality checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Suggested Demo Flow

1. Start in fallback mode for a guaranteed presentation.
2. Show the dark workflow graph and explain the document-to-question pipeline.
3. Select the built-in Bakery Orders sample or upload a text-based PDF/EPUB.
4. Click **Run full** and watch nodes progress.
5. Click Segmentation to inspect segment outputs.
6. Click Question Generation to inspect candidate questions.
7. Show Fast Jury and Strict Jury scores in the jury detail panel.
8. Show Rewrite for a weak question.
9. Show Final Output and export/copy the JSON.

## Project Boundary

This is a standalone project under `/home/vincent/Documents/Tests/vread-question-jury`. It does not modify the historical VREAD workflow project.
