import { NextResponse } from "next/server";
import { z } from "zod";
import { generateQuestionsForSegment } from "@/lib/workflow/generation";

const SegmentSchema = z.object({
  index: z.number().int().min(0),
  wordCount: z.number().int().min(1),
  text: z.string().min(1),
  analysisWindow: z.object({
    startWord: z.number().int().min(1),
    endWord: z.number().int().min(1),
    excerpt: z.string().min(50),
  }),
});

const RequestSchema = z.object({
  segment: SegmentSchema,
  forceFallback: z.boolean().optional(),
  runtimeRunMode: z.enum(["demo", "live"]).optional(),
});

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await request.json());
    const questions = await generateQuestionsForSegment(body.segment, {
      forceFallback: body.forceFallback,
      runtimeMode: body.runtimeRunMode,
    });
    return NextResponse.json({ questions });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join(" ")
        : error instanceof Error
          ? error.message
          : "Question generation failed.";
    return NextResponse.json({ error: message, fallbackAvailable: true }, { status: 400 });
  }
}
