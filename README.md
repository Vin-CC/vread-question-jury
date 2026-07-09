# VREAD Document Jury Workflow

Standalone VREAD workflow application for transforming a book document into verified reading-comprehension questions through a visual AI workflow.

The app ingests a real PDF or EPUB document, extracts text, cleans it, segments it, generates candidate questions, evaluates them with LLM-as-a-Jury, optionally rewrites weak questions, runs lightweight integrity checks, and exports VREAD-compatible JSON.

## Project Purpose

VREAD validates reading by asking comprehension questions grounded in source excerpts. The hard part is not only generating questions; it is proving that each question is explicitly supported, unambiguous, hard to guess, clear, and pedagogically useful.

This application makes that pipeline visible as a node-based workflow:

1. Document Input
2. Text Extraction
3. Cleaning / Normalization
4. Segmentation
5. Segment Selection
6. Question Generation
7. Fast Jury
8. Strict Multi-Agent Jury
9. Rewrite
10. Integrity Checks
11. VREAD Export
12. Final Output

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

Known extraction limitations:

- Scanned image-only PDFs are not OCRed.
- Complex EPUB ordering may be imperfect because this application uses a lightweight archive/content extraction path.
- The extraction step is hackathon-friendly, not production-grade.

## Historical VREAD Alignment

This standalone application borrows concepts from the historical VREAD workflow project without modifying it:

- Job-like step sequencing.
- `process -> questions -> review/output` thinking.
- Segment records with `index`, `wordCount`, `text`, and `analysisWindow`.
- Prompt principles that favor explicit source evidence, memorable scene details, no yes/no questions, and answers grounded in the excerpt.
- Integrity validation before export.
- VREAD-shaped export objects for `book` and `reading_questions`.
- A local run summary that resembles production job metadata without a database.

This is not the full production workflow. The application intentionally does not implement:

- Anna's Archive, RapidAPI, or other search/download integrations.
- Supabase persistence or production job tables.
- Real batch CSV processing.
- Cover search, cover upload, or media metadata management.
- A full SQL production pipeline.
- Persistent prompt editing or prompt version management.
- Claude/Gemini provider integrations.
- Admin dashboards.

## Integrity Checks

The Integrity Checks node runs local deterministic validation after Jury/Rewrite and before export. It produces a structured report with `pass`, `warning`, or `fail` checks.

Checks include:

- question, answer, and source excerpt presence.
- answer is not revealed inside the question.
- answer appears in the source excerpt by exact text match.
- final jury decision is not `reject`.
- Evidence Judge did not reject.
- global jury score is above the configured threshold.
- selected question is not duplicated among generated candidates.
- segment index and segment length are present.
- final output has required fields.

Missing evidence is treated as `fail`. Medium scores that are not rejected can produce `warning`. If all critical checks pass, the report status is `pass`.

## VREAD Export

The VREAD Export node transforms the approved question into a lightweight VREAD-compatible object. It does not insert into Supabase and does not execute SQL.

The export contains:

- `book`: title, slug, language, expected segment count, source type, word count, and workflow origin.
- `reading_questions`: segment index, question, answer, source excerpt, jury decision, jury score, and integrity status.
- `run_summary`: local run metadata for the current workflow execution.

The UI supports copying VREAD JSON, exporting VREAD JSON, and copying a clearly labeled SQL preview string. The SQL string is preview-only and is not executed by the application.

## Local Run Summary

Each workflow execution records local state only:

- run id, start/end time, and duration.
- number of requested steps, successful steps, and failed steps.
- provider and models used when available.
- final jury decision, global score, and integrity status.

This is intentionally not persisted to a database. It is included in the VREAD JSON export for audit-style workflow context.

## LLM-as-a-Jury

The jury evaluates generated questions through specialized roles:

- Evidence Judge: verifies that the answer is explicitly supported by the excerpt.
- Ambiguity Judge: checks whether several answers could be valid.
- Anti-Cheat Judge: checks whether the question can be answered without reading.
- Clarity Judge: checks wording and specificity.
- Pedagogy Judge: checks meaningful comprehension value.
- Chief Judge: aggregates results into `approve`, `rewrite`, or `reject`.

Fast Jury Mode uses one AI provider call to simulate all judges. Strict Multi-Agent Mode runs separate judge calls in parallel and then sends the validated judge outputs to a Chief Judge.

## AI Provider Configuration

All runtime LLM calls go through `src/lib/ai`. Workflow and jury code call the generic AI gateway, so switching providers is an environment change.

Environment variables:

```bash
AI_PROVIDER=openrouter # openrouter | openai | anthropic

OPENROUTER_API_KEY=
OPENAI_API_KEY=

AI_QUESTION_MODEL=
AI_FAST_MODEL=
AI_STRICT_MODEL=
AI_CHIEF_MODEL=
AI_REWRITE_MODEL=

AI_PROVIDER_SORT=price # optional: price | throughput | latency
AI_TEMPERATURE=0.2
AI_MAX_OUTPUT_TOKENS=2000
AI_REASONING_EFFORT=low # none | low | medium | high
```

Task-specific routing:

- `questionGeneration` uses `AI_QUESTION_MODEL`
- `fastJury` uses `AI_FAST_MODEL`
- `evidenceJudge`, `ambiguityJudge`, `antiCheatJudge`, `clarityJudge`, and `pedagogyJudge` use `AI_STRICT_MODEL`
- `chiefJudge` uses `AI_CHIEF_MODEL`
- `rewrite` uses `AI_REWRITE_MODEL`

Legacy OpenRouter model variables are still supported for compatibility:

```bash
OPENROUTER_FAST_MODEL=openai/gpt-4o-mini
OPENROUTER_STRICT_MODEL=openai/gpt-4o-mini
OPENROUTER_CHIEF_MODEL=openai/gpt-4o-mini
OPENROUTER_REWRITE_MODEL=openai/gpt-4o-mini
```

The generic `AI_*` model variables take precedence when both are set.

All model responses are parsed as JSON and validated with Zod before use.

### Runtime Provider

Every run calls the live provider configured through `AI_PROVIDER`. The provider API key is required: if it is missing, the API returns a clear configuration error (for example `OPENROUTER_API_KEY is not configured.`) and the UI keeps the failure visible.

`OPENROUTER_API_KEY`, `OPENAI_API_KEY`, and `ANTHROPIC_API_KEY` are read only on the server and are never exposed to client-side code.

### OpenRouter Setup

```bash
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_key
AI_FAST_MODEL=openai/gpt-4o-mini
AI_STRICT_MODEL=openai/gpt-4o-mini
AI_CHIEF_MODEL=openai/gpt-4o-mini
AI_REWRITE_MODEL=openai/gpt-4o-mini
AI_QUESTION_MODEL=openai/gpt-4o-mini
```

OpenRouter provider sorting is supported with `AI_PROVIDER_SORT=price`, `throughput`, or `latency`.

### OpenAI Setup

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
AI_FAST_MODEL=gpt-4o-mini
AI_STRICT_MODEL=gpt-4o-mini
AI_CHIEF_MODEL=gpt-4o-mini
AI_REWRITE_MODEL=gpt-4o-mini
AI_QUESTION_MODEL=gpt-4o-mini
```

`AI_PROVIDER=codex` is treated as an OpenAI runtime provider alias. Codex itself is a development agent, so this app still needs `OPENAI_API_KEY` and runtime model names.

## Run Locally

```bash
cd /home/vincent/Documents/Tests/vread-question-jury
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by Next.js.

OpenRouter mode:

```bash
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_key
```

OpenAI mode:

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
```

Quality checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Suggested Presentation Flow

1. Show the dark workflow graph and explain the document-to-question pipeline.
2. Upload a real text-based PDF/EPUB.
3. Click **Run full** and watch nodes progress.
4. Click Segmentation to inspect segment outputs.
5. Click Question Generation to inspect candidate questions.
6. Show Fast Jury and Strict Jury scores in the jury detail panel.
7. Show Rewrite for a weak question.
8. Show Integrity Checks and explain the production-inspired validation layer.
9. Show VREAD Export and copy/export the JSON or copy the SQL preview.
10. Show Final Output and export/copy the JSON.

## Project Boundary

This is a standalone project under `/home/vincent/Documents/Tests/vread-question-jury`. It does not modify the historical VREAD workflow project.
