import JSZip from "jszip";

const stripTags = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");

export async function extractEpubText(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);
  const textFiles = Object.values(zip.files)
    .filter((file) => !file.dir && /\.(xhtml|html|htm|xml)$/i.test(file.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (textFiles.length === 0) {
    throw new Error("No readable XHTML/HTML content files were found in this EPUB.");
  }

  const parts = await Promise.all(textFiles.map((file) => file.async("string")));
  const text = parts.map(stripTags).join("\n\n").replace(/\s+/g, " ").trim();

  if (text.length < 80) {
    throw new Error("EPUB extraction produced too little text for question generation.");
  }

  return text;
}
