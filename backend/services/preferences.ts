import { getDb } from "../db/connection";

export interface PreferenceSummary {
  preferredTags: string[];
  rejectedTags: string[];
  preferredAudiences: string[];
  preferredIdeaTypes: string[];
  recentApprovedExamples: string[];
  recentRejectedExamples: string[];
}

/**
 * Updates preference_signals table based on a feedback action on an idea.
 */
export function updatePreferences(
  ideaId: number,
  action: "approved" | "rejected" | "skipped"
): void {
  if (action === "skipped") return; // skips don't update preferences

  const db = getDb();
  const idea = db.prepare("SELECT * FROM ideas WHERE id = ?").get(ideaId) as any;
  if (!idea) return;

  const tags: string[] = JSON.parse(idea.tags || "[]");
  const audiences: string[] = JSON.parse(idea.audience || "[]");
  const delta = action === "approved" ? 1 : -1;

  const upsert = db.prepare(`
    INSERT INTO preference_signals (signal_type, signal_value, score, approved_count, rejected_count, updated_at)
    VALUES (@type, @value, @score, @approved, @rejected, datetime('now'))
    ON CONFLICT(signal_type, signal_value) DO UPDATE SET
      score = score + @score,
      approved_count = approved_count + @approved,
      rejected_count = rejected_count + @rejected,
      updated_at = datetime('now')
  `);

  const updateAll = db.transaction(() => {
    for (const tag of tags) {
      upsert.run({
        type: "tag",
        value: tag,
        score: delta,
        approved: action === "approved" ? 1 : 0,
        rejected: action === "rejected" ? 1 : 0,
      });
    }
    for (const aud of audiences) {
      upsert.run({
        type: "audience",
        value: aud,
        score: delta,
        approved: action === "approved" ? 1 : 0,
        rejected: action === "rejected" ? 1 : 0,
      });
    }
    upsert.run({
      type: "idea_type",
      value: idea.idea_type,
      score: delta,
      approved: action === "approved" ? 1 : 0,
      rejected: action === "rejected" ? 1 : 0,
    });
  });

  updateAll();
}

/**
 * Returns a structured preference summary for use in generation prompts.
 */
export function getPreferenceSummary(): PreferenceSummary {
  const db = getDb();

  const tagSignals = db
    .prepare(
      `SELECT signal_value, score FROM preference_signals
       WHERE signal_type = 'tag' ORDER BY score DESC LIMIT 20`
    )
    .all() as { signal_value: string; score: number }[];

  const audSignals = db
    .prepare(
      `SELECT signal_value, score FROM preference_signals
       WHERE signal_type = 'audience' ORDER BY score DESC LIMIT 10`
    )
    .all() as { signal_value: string; score: number }[];

  const typeSignals = db
    .prepare(
      `SELECT signal_value, score FROM preference_signals
       WHERE signal_type = 'idea_type' ORDER BY score DESC LIMIT 5`
    )
    .all() as { signal_value: string; score: number }[];

  const recentApproved = db
    .prepare(
      `SELECT title || ': ' || opportunity as text
       FROM ideas WHERE status = 'approved'
       ORDER BY decided_at DESC LIMIT 5`
    )
    .all() as { text: string }[];

  const recentRejected = db
    .prepare(
      `SELECT title || ': ' || opportunity as text
       FROM ideas WHERE status = 'rejected'
       ORDER BY decided_at DESC LIMIT 5`
    )
    .all() as { text: string }[];

  return {
    preferredTags: tagSignals.filter((s) => s.score > 0).map((s) => s.signal_value),
    rejectedTags: tagSignals.filter((s) => s.score < 0).map((s) => s.signal_value),
    preferredAudiences: audSignals.filter((s) => s.score > 0).map((s) => s.signal_value),
    preferredIdeaTypes: typeSignals.filter((s) => s.score > 0).map((s) => s.signal_value),
    recentApprovedExamples: recentApproved.map((r) => r.text),
    recentRejectedExamples: recentRejected.map((r) => r.text),
  };
}
