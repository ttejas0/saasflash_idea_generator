import Parser from "rss-parser";
import { getDb } from "../db/connection";
import { hashContent, normalizeText } from "./utils";

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "IdeaGenerator/1.0 (RSS Fetcher)",
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
    const feed = await parser.parseURL(source.url);

    const insertItem = db.prepare(`
      INSERT OR IGNORE INTO source_items
        (source_id, external_id, title, summary, url, author, published_at, fetched_at, raw_json, content_hash)
      VALUES
        (@source_id, @external_id, @title, @summary, @url, @author, @published_at, datetime('now'), @raw_json, @content_hash)
    `);

    const insertMany = db.transaction((items: Parser.Item[]) => {
      let count = 0;
      for (const item of items) {
        const title = item.title?.trim() || "";
        const url = item.link?.trim() || "";
        if (!title || !url) continue;

        const summary = (item.contentSnippet || item.content || item.summary || "").slice(0, 2000);
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
        if (res.changes > 0) count++;
      }
      return count;
    });

    inserted = insertMany(feed.items || []);
    console.log(`[feeds] ${source.name}: ${inserted} new items`);
  } catch (err) {
    console.error(`[feeds] Failed to fetch ${source.name} (${source.url}):`, (err as Error).message);
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
  // Fetch in parallel batches of 4
  for (let i = 0; i < sources.length; i += 4) {
    const batch = sources.slice(i, i + 4);
    const counts = await Promise.all(batch.map((s) => fetchRssFeed(s)));
    total += counts.reduce((a, b) => a + b, 0);
  }

  console.log(`[feeds] Done. Total new items: ${total}`);
  return total;
}
