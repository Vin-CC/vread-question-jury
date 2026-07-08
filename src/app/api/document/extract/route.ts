import { NextResponse } from "next/server";
import { extractEpubText } from "@/lib/document/epub";
import { extractPdfText } from "@/lib/document/pdf";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a PDF or EPUB file." }, { status: 400 });
    }

    const lower = file.name.toLowerCase();
    const buffer = await file.arrayBuffer();

    if (lower.endsWith(".pdf") || file.type === "application/pdf") {
      const extracted = await extractPdfText(buffer);
      return NextResponse.json({
        text: extracted.text,
        metadata: {
          name: file.name,
          kind: "pdf",
          size: file.size,
          pages: extracted.pages,
          wordCount: extracted.text.split(/\s+/).filter(Boolean).length,
          source: "upload",
        },
      });
    }

    if (lower.endsWith(".epub") || file.type.includes("epub")) {
      const text = await extractEpubText(buffer);
      return NextResponse.json({
        text,
        metadata: {
          name: file.name,
          kind: "epub",
          size: file.size,
          wordCount: text.split(/\s+/).filter(Boolean).length,
          source: "upload",
        },
      });
    }

    return NextResponse.json({ error: "Unsupported file type. Use PDF or EPUB." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Document extraction failed." },
      { status: 400 }
    );
  }
}
