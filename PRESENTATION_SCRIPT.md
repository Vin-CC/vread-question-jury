# VREAD Document Jury Workflow - 2-3 Minute Walkthrough

## 0:00 - Problem

"AI can generate questions, but VREAD needs verified questions that prove someone actually read the source."

## 0:20 - Workflow App

"This is the VREAD Document Jury Workflow. It turns a PDF or EPUB into validated reading-comprehension output."

Show the dark workflow canvas, node states, right-side controls, and logs panel.

## 0:35 - Document Input

Upload a real text-based PDF/EPUB.

"For a live presentation, I can run this in local mode, so the workflow remains reliable even without OpenRouter."

## 0:50 - Run Workflow

Click **Run full**.

"The document moves through extraction, cleaning, segmentation, and segment selection. Each node exposes its input and output."

Click the **Segmentation** node and show the segment count and selected excerpt.

## 1:20 - Question Generation

Click **Question Generation**.

"The generator produces candidate comprehension questions from the selected segment. The prompt follows VREAD rules: explicit evidence, no yes/no questions, clear scene-grounded answers."

## 1:40 - Fast Jury

Show **Fast Jury**.

"Fast mode uses one model call to simulate the full jury for low-cost screening."

Point out the decision badge, global score, and judge breakdown.

## 2:00 - Strict Multi-Agent Jury

Show **Strict Jury**.

"Strict mode runs independent judge agents, then a Chief Judge aggregates the decision."

Point out Evidence, Ambiguity, Anti-Cheat, Clarity, and Pedagogy cards.

## 2:25 - Rewrite

Show the rewrite step for a weak or broad question.

"If a question is fixable, the rewrite agent proposes a better grounded version."

## 2:45 - Final Output

Show **Integrity Checks** and **VREAD Export**.

"After the jury, the workflow runs integrity checks inspired by the production VREAD pipeline, then produces a VREAD-compatible export."

Click or show **Final Output**.

"The result is an auditable JSON object: question, answer, source excerpt, jury metadata, integrity status, and VREAD export data."

Copy or export JSON.

## Closing

"The goal is not just more generated questions. The goal is verified, auditable reading-comprehension questions."

## Running Modes

Real OpenRouter mode:

```bash
OPENROUTER_API_KEY=your_openrouter_key
DEMO_FALLBACK_MODE=false
```

Local presentation mode:

```bash
DEMO_FALLBACK_MODE=true
```

Local mode exists so a short presentation is not derailed by missing credentials, rate limits, slow model responses, or network issues.
