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

    // Log quality summary of source items
    const withSummary = sourceItems.filter(si => si.summary && si.summary.length > 10);
    const withoutSummary = sourceItems.length - withSummary.length;
    console.log(`[generation]   Source item quality: ${withSummary.length} with summaries, ${withoutSummary} without`);

    // 3. Call LLM
    console.log(`[generation] Calling LLM for ${count} ideas...`);
    const ideas = await generateIdeasFromLLM(sourceItems, count);
    console.log(`[generation] LLM returned ${ideas.length} ideas`);

    // Log each idea from LLM for debugging
    for (const idea of ideas) {
      console.log(`[generation]   → "${idea.title}" [${idea.idea_type}] audience=${JSON.stringify(idea.audience)} tags=${JSON.stringify(idea.tags)} source_refs=${JSON.stringify(idea.source_item_ids)}`);
    }

    // 4. Deduplicate (outside transaction so intra-batch dupes are caught)
    const deduped = ideas.filter((idea) => {
      if (isDuplicate(idea)) {
        rejected++;
        console.log(`[generation]   ❌ Rejected duplicate: "${idea.title}"`);
        return false;
      }
      return true;
    });
    console.log(`[generation] After dedup: ${deduped.length} accepted, ${rejected} rejected`);

    // 5. Build source_item_ids mapping (LLM returns 1-indexed prompt positions, map to real DB IDs)
    // The prompt slices sourceItems to the first 30, so indices are 1-based into that slice
    const promptSourceItems = sourceItems.slice(0, 30);

    // 6. Save accepted ideas
    const insert = db.prepare(`
      INSERT OR IGNORE INTO ideas
        (batch_id, title, idea_type, news, attention_point, angle_1, angle_2, audience, tags,
         source_item_ids, novelty_score, relevance_score, duplicate_score, content_hash, status)
      VALUES
        (@batch_id, @title, @idea_type, @news, @attention_point, @angle_1, @angle_2, @audience, @tags,
         @source_item_ids, @novelty_score, @relevance_score, @duplicate_score, @content_hash, 'new')
    `);

    const saveAll = db.transaction(() => {
      for (const idea of deduped) {
        const dupScore = computeDuplicateScore(idea);
        const contentHash = hashContent(`${idea.title} ${idea.news}`);

        // Map LLM's 1-indexed prompt positions to actual source_item DB IDs
        const mappedSourceIds = idea.source_item_ids
          .map(ref => {
            const idx = parseInt(ref, 10) - 1; // LLM uses 1-based indexing
            if (idx >= 0 && idx < promptSourceItems.length) {
              return promptSourceItems[idx].id;
            }
            console.warn(`[generation]   ⚠️ Invalid source ref "${ref}" in idea "${idea.title}" — out of range`);
            return null;
          })
          .filter((id): id is number => id !== null);

        console.log(`[generation]   Saving "${idea.title}": dupScore=${dupScore.toFixed(3)}, sourceIds=${JSON.stringify(mappedSourceIds)}`);

        const res = insert.run({
          batch_id: batchId,
          title: idea.title,
          idea_type: idea.idea_type,
          news: idea.news,
          attention_point: idea.attention_point,
          angle_1: idea.angle_1,
          angle_2: idea.angle_2,
          audience: JSON.stringify(idea.audience),
          tags: JSON.stringify(idea.tags),
          source_item_ids: JSON.stringify(mappedSourceIds),
          novelty_score: idea.novelty_score,
          relevance_score: idea.relevance_score,
          duplicate_score: dupScore,
          content_hash: contentHash,
        });

        if (res.changes > 0) {
          saved++;
        } else {
          console.log(`[generation]   ⚠️ Skipped (content hash collision): "${idea.title}"`);
        }
      }
    });

    saveAll();

    // 7. Mark batch completed
    db.prepare(
      `UPDATE idea_batches SET status = 'completed', completed_at = datetime('now') WHERE id = ?`
    ).run(batchId);

    console.log(
      `[generation] ✅ Batch ${batchId} complete: ${saved} saved, ${rejected} rejected as duplicates`
    );
  } catch (err) {
    const message = (err as Error).message;
    db.prepare(
      `UPDATE idea_batches SET status = 'failed', completed_at = datetime('now'), error_message = ? WHERE id = ?`
    ).run(message, batchId);
    console.error(`[generation] ❌ Batch ${batchId} failed:`, message);
    console.error(`[generation] Stack:`, (err as Error).stack);
    throw err;
  }

  return { batchId, saved, rejected };
}
