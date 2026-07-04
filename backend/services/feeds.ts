import Parser from "rss-parser";
import { getDb } from "../db/connection";
import { hashContent, normalizeText } from "./utils";

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
  },
});

interface Source {
  id: number;
  name: string;
  type: string;
  url: string;
  category: string;
}

async function fetchRssFeed(source: Source): Promise<number> {
  const db = getDb();
  let inserted = 0;

  try {
    console.log(`[feeds] Fetching source: ${source.name} (${source.type}) — ${source.url}`);
    const feed = await parser.parseURL(source.url);
    console.log(`[feeds]   Feed title: "${feed.title || '(untitled)'}" — ${(feed.items || []).length} items in feed`);

    const insertItem = db.prepare(`
      INSERT OR IGNORE INTO source_items
        (source_id, external_id, title, summary, url, author, published_at, fetched_at, raw_json, content_hash)
      VALUES
        (@source_id, @external_id, @title, @summary, @url, @author, @published_at, datetime('now'), @raw_json, @content_hash)
    `);

    let skippedNoTitle = 0;
    let skippedNoUrl = 0;
    let skippedDuplicate = 0;
    let emptySummaryCount = 0;

    const insertMany = db.transaction((items: Parser.Item[]) => {
      let count = 0;
      for (const item of items) {
        const title = item.title?.trim() || "";
        const url = item.link?.trim() || "";
        if (!title) { skippedNoTitle++; continue; }
        if (!url) { skippedNoUrl++; continue; }

        // Build a meaningful summary from available content fields
        const rawSnippet = item.contentSnippet || "";
        const rawContent = item.content || "";
        const rawSummary = item.summary || "";
        // Prefer contentSnippet (plain text), fall back to content/summary, strip HTML
        let summary = (rawSnippet || rawContent || rawSummary || "").slice(0, 2000);
        // Clean minimal/garbage summaries (e.g. HN "Comments")
        if (summary.length < 10 || /^(Comments|\d+ points)$/i.test(summary.trim())) {
          summary = ""; // Will be empty but at least not misleading
          emptySummaryCount++;
        }

        const contentHash = hashContent(`${normalizeText(title)} ${normalizeText(url)}`);

        const row = {
          source_id: source.id,
          external_id: item.guid || url,
          title,
          summary,
          url,
          author: (item as any).creator || (item as any).author || null,
          published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
          raw_json: JSON.stringify({ title, link: url, pubDate: item.pubDate }),
          content_hash: contentHash,
        };

        const res = insertItem.run(row);
        if (res.changes > 0) {
          count++;
        } else {
          skippedDuplicate++;
        }
      }
      return count;
    });

    inserted = insertMany(feed.items || []);
    console.log(`[feeds]   ${source.name} result: ${inserted} new, ${skippedDuplicate} duplicates, ${skippedNoTitle} no-title, ${skippedNoUrl} no-url, ${emptySummaryCount} empty-summaries`);
  } catch (err) {
    console.error(`[feeds] ❌ Failed to fetch ${source.name} (${source.url}):`, (err as Error).message);
  }

  return inserted;
}

/**
 * Fetches all enabled sources and stores new items.
 * Returns total number of new items inserted.
 */
export async function fetchAllSources(): Promise<number> {
  const db = getDb();
  const sources = db.prepare("SELECT * FROM sources WHERE enabled = 1").all() as Source[];
  console.log(`[feeds] Fetching ${sources.length} enabled sources...`);

  let total = 0;
  // Fetch sequentially to avoid rate limits (especially from Reddit)
  for (const source of sources) {
    const count = await fetchRssFeed(source);
    total += count;
    // Add a short delay to be polite
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`[feeds] Done. Total new items: ${total}`);
  return total;
}
