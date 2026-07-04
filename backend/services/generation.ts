import { getDb } from "../db/connection";
import { generateIdeasFromLLM } from "./openrouter";
import { isDuplicate, computeDuplicateScore } from "./dedupe";
import { hashContent } from "./utils";

interface SourceItem {
  id: number;
  title: string;
  summary: string;
  url: string;
  category: string;
  published_at: string | null;
}

/**
 * Fetches recent source items from the DB (last 72 hours).
 */
function getRecentSourceItems(limit = 60): SourceItem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT si.id, si.title, si.summary, si.url, s.category, si.published_at
       FROM source_items si
       JOIN sources s ON si.source_id = s.id
       WHERE si.fetched_at >= datetime('now', '-72 hours')
       ORDER BY si.published_at DESC, si.fetched_at DESC
       LIMIT ?`
    )
    .all(limit) as SourceItem[];
}

/**
 * Core generation pipeline. Creates a batch, calls the LLM, deduplicates,
 * and saves accepted ideas. Returns the batch ID and counts.
 */
export async function runGenerationPipeline(options?: {
  count?: number;
  runType?: "daily" | "manual" | "retry";
}): Promise<{ batchId: number; saved: number; rejected: number }> {
  const db = getDb();
  const count = options?.count ?? 10;
  const runType = options?.runType ?? "manual";
  const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-r1:free";

  // 1. Create batch record
  const batchResult = db
    .prepare(
      `INSERT INTO idea_batches (run_type, status, model, prompt_version, started_at)
       VALUES (?, 'running', ?, 'v1', datetime('now'))`
    )
    .run(runType, model);
  const batchId = batchResult.lastInsertRowid as number;

  let saved = 0;
  let rejected = 0;

  try {
    // 2. Get recent source items
    const sourceItems = getRecentSourceItems(60);
    if (sourceItems.length === 0) {
      throw new Error("No source items available. Run /api/admin/fetch-sources first.");
    }
    console.log(`[generation] Using ${sourceItems.length} source items for batch ${batchId}`);

    // 3. Call LLM
    const ideas = await generateIdeasFromLLM(sourceItems, count);
    console.log(`[generation] LLM returned ${ideas.length} ideas`);

    // 4. Deduplicate (outside transaction so intra-batch dupes are caught)
    const deduped = ideas.filter((idea) => {
      if (isDuplicate(idea)) {
        rejected++;
        console.log(`[generation] Rejected duplicate: "${idea.title}"`);
        return false;
      }
      return true;
    });

    // 5. Save accepted ideas
    const insert = db.prepare(`
      INSERT OR IGNORE INTO ideas
        (batch_id, title, idea_type, context, opportunity, why_now, audience, tags,
         source_item_ids, novelty_score, relevance_score, duplicate_score, content_hash, status)
      VALUES
        (@batch_id, @title, @idea_type, @context, @opportunity, @why_now, @audience, @tags,
         @source_item_ids, @novelty_score, @relevance_score, @duplicate_score, @content_hash, 'new')
    `);

    const saveAll = db.transaction(() => {
      for (const idea of deduped) {
        const dupScore = computeDuplicateScore(idea);
        const contentHash = hashContent(`${idea.title} ${idea.opportunity}`);

        const res = insert.run({
          batch_id: batchId,
          title: idea.title,
          idea_type: idea.idea_type,
          context: idea.context,
          opportunity: idea.opportunity,
          why_now: idea.why_now || "",
          audience: JSON.stringify(idea.audience),
          tags: JSON.stringify(idea.tags),
          source_item_ids: JSON.stringify(idea.source_item_ids),
          novelty_score: idea.novelty_score,
          relevance_score: idea.relevance_score,
          duplicate_score: dupScore,
          content_hash: contentHash,
        });

        if (res.changes > 0) saved++;
      }
    });

    saveAll();

    // 5. Mark batch completed
    db.prepare(
      `UPDATE idea_batches SET status = 'completed', completed_at = datetime('now') WHERE id = ?`
    ).run(batchId);

    console.log(
      `[generation] Batch ${batchId} complete: ${saved} saved, ${rejected} rejected as duplicates`
    );
  } catch (err) {
    const message = (err as Error).message;
    db.prepare(
      `UPDATE idea_batches SET status = 'failed', completed_at = datetime('now'), error_message = ? WHERE id = ?`
    ).run(message, batchId);
    console.error(`[generation] Batch ${batchId} failed:`, message);
    throw err;
  }

  return { batchId, saved, rejected };
}
