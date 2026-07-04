import { getDb } from "../db/connection";

const DEFAULT_SOURCES = [
  // --- Tech / Product launches ---
  {
    name: "Hacker News",
    type: "rss",
    url: "https://news.ycombinator.com/rss",
    category: "tech_news",
  },
  {
    name: "Product Hunt Daily",
    type: "rss",
    url: "https://www.producthunt.com/feed",
    category: "product_launches",
  },
  {
    name: "TechCrunch Startups",
    type: "rss",
    url: "https://techcrunch.com/category/startups/feed/",
    category: "startups",
  },
  // --- Builder / Indie ---
  {
    name: "Indie Hackers",
    type: "rss",
    url: "https://www.indiehackers.com/feed.rss",
    category: "indie_builders",
  },
  {
    name: "TLDR Newsletter",
    type: "rss",
    url: "https://tldr.tech/rss",
    category: "tech_news",
  },
  // --- Reddit ---
  {
    name: "r/SaaS",
    type: "reddit_rss",
    url: "https://www.reddit.com/r/SaaS/.rss",
    category: "saas",
  },
  {
    name: "r/startups",
    type: "reddit_rss",
    url: "https://www.reddit.com/r/startups/.rss",
    category: "startups",
  },
  {
    name: "r/indiehackers",
    type: "reddit_rss",
    url: "https://www.reddit.com/r/indiehackers/.rss",
    category: "indie_builders",
  },
  {
    name: "r/growthhacking",
    type: "reddit_rss",
    url: "https://www.reddit.com/r/growthhacking/.rss",
    category: "growth",
  },
  {
    name: "r/MachineLearning",
    type: "reddit_rss",
    url: "https://www.reddit.com/r/MachineLearning/.rss",
    category: "ai_ml",
  },
  {
    name: "r/artificial",
    type: "reddit_rss",
    url: "https://www.reddit.com/r/artificial/.rss",
    category: "ai_ml",
  },
  {
    name: "r/webdev",
    type: "reddit_rss",
    url: "https://www.reddit.com/r/webdev/.rss",
    category: "developer_tools",
  },
  {
    name: "r/devops",
    type: "reddit_rss",
    url: "https://www.reddit.com/r/devops/.rss",
    category: "operations",
  },
  {
    name: "r/ProductManagement",
    type: "reddit_rss",
    url: "https://www.reddit.com/r/ProductManagement/.rss",
    category: "product_launches",
  },
];

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
