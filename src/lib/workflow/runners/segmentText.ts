import type { TextSegment } from "../types";

const DEFAULT_SEGMENT_WORDS = 220;
const DEFAULT_WINDOW_WORDS = 140;

const normalizeWords = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

export function segmentText(
  text: string,
  options: { segmentWordCount?: number; analysisWindowWords?: number } = {}
): TextSegment[] {
  const words = normalizeWords(text);
  const segmentSize = options.segmentWordCount ?? DEFAULT_SEGMENT_WORDS;
  const windowSize = options.analysisWindowWords ?? DEFAULT_WINDOW_WORDS;
  const segments: TextSegment[] = [];

  for (let start = 0; start < words.length; start += segmentSize) {
    const segmentWords = words.slice(start, start + segmentSize);
    const mid = Math.floor(segmentWords.length / 2);
    const windowStart = Math.max(0, mid - Math.floor(windowSize / 2));
    const windowEnd = Math.min(segmentWords.length, windowStart + windowSize);

    segments.push({
      index: segments.length,
      wordCount: segmentWords.length,
      text: segmentWords.join(" "),
      analysisWindow: {
        startWord: windowStart + 1,
        endWord: windowEnd,
        excerpt: segmentWords.slice(windowStart, windowEnd).join(" "),
      },
    });
  }

  return segments;
}
