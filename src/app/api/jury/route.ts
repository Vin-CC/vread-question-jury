import { NextResponse } from "next/server";
import { z } from "zod";
import { runFastJury, runStrictJury } from "@/lib/jury/run";
import { JuryInputSchema } from "@/lib/jury/types";

const JuryRequestSchema = JuryInputSchema.extend({
  mode: z.enum(["fast", "strict"]),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = JuryRequestSchema.parse(body);
    const result = input.mode === "fast" ? await runFastJury(input) : await runStrictJury(input);
    return NextResponse.json({ result });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join(" ")
        : error instanceof Error
          ? error.message
          : "Unexpected jury error.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
