import { getDb } from "../db/connection";
import { jaccardSimilarity } from "./utils";

const SIMILARITY_THRESHOLD = 0.45;

interface IdeaCandidate {
  title: string;
  news: string;
}

/**
 * Returns existing recent idea titles+opportunity for comparison.
 */
function getRecentIdeaTexts(limit = 200): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT title || ' ' || news as text
       FROM ideas
       WHERE status NOT IN ('archived')
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit) as { text: string }[];
  return rows.map((r) => r.text);
}

/**
 * Checks whether a candidate idea is too similar to any existing idea.
 * Returns the similarity score (higher = more duplicate).
 */
export function computeDuplicateScore(candidate: IdeaCandidate): number {
  const existing = getRecentIdeaTexts();
  const candidateText = `${candidate.title} ${candidate.news}`;
  let maxSim = 0;
  for (const text of existing) {
    const sim = jaccardSimilarity(candidateText, text);
    if (sim > maxSim) maxSim = sim;
  }
  return maxSim;
}

/**
 * Returns true if a candidate idea should be rejected as a duplicate.
 */
export function isDuplicate(candidate: IdeaCandidate): boolean {
  return computeDuplicateScore(candidate) >= SIMILARITY_THRESHOLD;
}
