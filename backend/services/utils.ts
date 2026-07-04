import crypto from "crypto";

/**
 * Normalize a string for hashing/comparison:
 * lowercase, remove punctuation, collapse whitespace.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashContent(text: string): string {
  return crypto.createHash("sha256").update(normalizeText(text)).digest("hex");
}

/**
 * Simple Jaccard similarity between two normalized strings.
 * Returns 0..1 where 1 = identical.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(normalizeText(a).split(" "));
  const setB = new Set(normalizeText(b).split(" "));
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = new Set([...setA].filter((w) => setB.has(w)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}
