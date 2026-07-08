import { PDFParse } from "pdf-parse";

export async function extractPdfText(buffer: ArrayBuffer) {
  const parser = new PDFParse({ data: Buffer.from(buffer) });
  const parsed = await parser.getText();
  await parser.destroy();
  const text = (parsed.text ?? "").replace(/\s+/g, " ").trim();

  if (text.length < 80) {
    throw new Error(
      "PDF extraction produced too little text. This demo supports text-based PDFs, not scanned image-only PDFs."
    );
  }

  return {
    text,
    pages: parsed.total,
  };
}
