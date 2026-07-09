import { NextResponse } from "next/server";
import { z } from "zod";
import { rewriteQuestion } from "@/lib/jury/run";
import { JuryInputSchema, JuryResultSchema } from "@/lib/jury/types";

const RewriteRequestSchema = JuryInputSchema.extend({
  result: JuryResultSchema.pick({
    finalDecision: true,
    summary: true,
    judges: true,
  }).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = RewriteRequestSchema.parse(body);
    const rewrite = await rewriteQuestion(input, input.result);
    return NextResponse.json({ rewrite });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join(" ")
        : error instanceof Error
          ? error.message
          : "Unexpected rewrite error.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
