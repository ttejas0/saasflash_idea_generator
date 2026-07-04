import { getDb } from "../db/connection";

import { DEFAULT_SOURCES } from "../config/feeds";

export function seedSources() {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO sources (name, type, url, category, enabled)
    VALUES (@name, @type, @url, @category, 1)
  `);

  const insertMany = db.transaction((sources: typeof DEFAULT_SOURCES) => {
    let count = 0;
    for (const source of sources) {
      const res = insert.run(source);
      if (res.changes > 0) count++;
    }
    return count;
  });

  const inserted = insertMany(DEFAULT_SOURCES);
  if (inserted > 0) {
    console.log(`[seed] Inserted ${inserted} default sources.`);
  }
}
