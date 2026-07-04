import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db/connection";

const router = Router();

// GET /api/sources
router.get("/", (_req, res) => {
  const db = getDb();
  const sources = db.prepare("SELECT * FROM sources ORDER BY category, name").all();
  res.json({ sources });
});

// POST /api/sources
const sourceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["rss", "reddit_rss", "reddit_json", "manual"]),
  url: z.string().url(),
  category: z.string().min(1),
  enabled: z.boolean().optional().default(true),
});

router.post("/", (req, res) => {
  const parsed = sourceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
  }

  const db = getDb();
  const { name, type, url, category, enabled } = parsed.data;

  try {
    const result = db
      .prepare(
        `INSERT INTO sources (name, type, url, category, enabled)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(name, type, url, category, enabled ? 1 : 0);

    const source = db.prepare("SELECT * FROM sources WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json({ source });
  } catch (err: any) {
    if (err.message?.includes("UNIQUE constraint")) {
      return res.status(409).json({ error: "Source with this URL already exists" });
    }
    throw err;
  }
});

// PATCH /api/sources/:id
router.patch("/:id", (req, res) => {
  const db = getDb();
  const source = db.prepare("SELECT * FROM sources WHERE id = ?").get(req.params.id);
  if (!source) return res.status(404).json({ error: "Source not found" });

  const { enabled } = req.body as { enabled?: boolean };
  if (typeof enabled === "undefined") {
    return res.status(400).json({ error: "No updatable fields provided" });
  }

  db.prepare("UPDATE sources SET enabled = ?, updated_at = datetime('now') WHERE id = ?").run(
    enabled ? 1 : 0,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM sources WHERE id = ?").get(req.params.id);
  res.json({ source: updated });
});

// DELETE /api/sources/:id
router.delete("/:id", (req, res) => {
  const db = getDb();
  const result = db.prepare("DELETE FROM sources WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Source not found" });
  res.json({ success: true });
});

export default router;
