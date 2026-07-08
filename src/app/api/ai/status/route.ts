import { NextResponse } from "next/server";
import { getAiPublicStatus } from "@/lib/ai/config";

export async function GET() {
  try {
    return NextResponse.json({ status: getAiPublicStatus() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI configuration is invalid." },
      { status: 400 }
    );
  }
}
