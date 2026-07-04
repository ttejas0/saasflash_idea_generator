import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db/connection";
import { updatePreferences } from "../services/preferences";

const router = Router();

/** Safely parse a JSON string, returning fallback on any error. */
function safeParseJson<T>(val: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(val || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

// GET /api/ideas/today
router.get("/today", (req, res) => {
  const db = getDb();
  const { status, tag, idea_type, audience, limit = "30" } = req.query as Record<string, string>;
  console.log(`[api/ideas] GET /today — filters: status=${status}, tag=${tag}, idea_type=${idea_type}, audience=${audience}, limit=${limit}`);

  let sql = `
    SELECT * FROM ideas
    WHERE created_at >= date('now')
  `;
  const params: any[] = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (idea_type) {
    sql += " AND idea_type = ?";
    params.push(idea_type);
  }
  if (audience) {
    sql += " AND audience LIKE ?";
    params.push(`%${audience}%`);
  }
  if (tag) {
    sql += " AND tags LIKE ?";
    params.push(`%${tag}%`);
  }

  sql += " ORDER BY novelty_score DESC, relevance_score DESC LIMIT ?";
  const rawLimit = parseInt(limit, 10);
  const safeLimit = isNaN(rawLimit) || rawLimit < 1 ? 30 : Math.min(rawLimit, 100);
  params.push(safeLimit);

  const ideas = db.prepare(sql).all(...params);
  console.log(`[api/ideas]   Raw DB results: ${(ideas as any[]).length} ideas`);

  // Mark as shown
  const ids = (ideas as any[]).map((i: any) => i.id);
  if (ids.length > 0) {
    db.prepare(
      `UPDATE ideas SET status = 'shown', shown_at = datetime('now')
       WHERE id IN (${ids.map(() => "?").join(",")}) AND status = 'new'`
    ).run(...ids);
  }

  // Parse JSON fields
  const parsed = (ideas as any[]).map((idea: any) => ({
    ...idea,
    tags: safeParseJson(idea.tags, []),
    audience: safeParseJson(idea.audience, []),
    source_item_ids: safeParseJson(idea.source_item_ids, []),
  }));

  // Log a sample to verify data shape
  if (parsed.length > 0) {
    const sample = parsed[0];
    console.log(`[api/ideas]   Sample idea shape: title="${sample.title?.slice(0, 50)}...", audience=${JSON.stringify(sample.audience)}, tags=${JSON.stringify(sample.tags)}, audience_isArray=${Array.isArray(sample.audience)}, tags_isArray=${Array.isArray(sample.tags)}`);
  }

  console.log(`[api/ideas]   Returning ${parsed.length} parsed ideas`);
  res.json({ ideas: parsed, count: parsed.length });
});

// GET /api/ideas/approved
router.get("/approved", (req, res) => {
  const db = getDb();
  const { limit = "50" } = req.query as Record<string, string>;
  const rawLimit = parseInt(limit, 10);
  const safeLimit = isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 100);
  console.log(`[api/ideas] GET /approved — limit=${safeLimit}`);

  const ideas = db
    .prepare(
      `SELECT * FROM ideas WHERE status = 'approved'
       ORDER BY decided_at DESC LIMIT ?`
    )
    .all(safeLimit);

  const parsed = (ideas as any[]).map((idea: any) => ({
    ...idea,
    tags: safeParseJson(idea.tags, []),
    audience: safeParseJson(idea.audience, []),
    source_item_ids: safeParseJson(idea.source_item_ids, []),
  }));

  console.log(`[api/ideas]   Returning ${parsed.length} approved ideas`);
  res.json({ ideas: parsed });
});

// GET /api/ideas/rejected
router.get("/rejected", (req, res) => {
  const db = getDb();
  console.log(`[api/ideas] GET /rejected`);
  const ideas = db
    .prepare(
      `SELECT * FROM ideas WHERE status = 'rejected'
       ORDER BY decided_at DESC LIMIT 50`
    )
    .all();

  const parsed = (ideas as any[]).map((idea: any) => ({
    ...idea,
    tags: safeParseJson(idea.tags, []),
    audience: safeParseJson(idea.audience, []),
    source_item_ids: safeParseJson(idea.source_item_ids, []),
  }));

  console.log(`[api/ideas]   Returning ${parsed.length} rejected ideas`);
  res.json({ ideas: parsed });
});

// GET /api/ideas/:id
router.get("/:id", (req, res) => {
  const db = getDb();
  const idea = db.prepare("SELECT * FROM ideas WHERE id = ?").get(req.params.id) as any;
  if (!idea) return res.status(404).json({ error: "Idea not found" });

  res.json({
    ...idea,
    tags: safeParseJson(idea.tags, []),
    audience: safeParseJson(idea.audience, []),
    source_item_ids: safeParseJson(idea.source_item_ids, []),
  });
});

// POST /api/ideas/:id/feedback
const feedbackSchema = z.object({
  action: z.enum(["approved", "rejected", "skipped"]),
  reason: z.string().optional(),
});

router.post("/:id/feedback", (req, res) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
  }

  const db = getDb();
  const ideaId = parseInt(req.params.id, 10);
  const idea = db.prepare("SELECT id FROM ideas WHERE id = ?").get(ideaId);
  if (!idea) return res.status(404).json({ error: "Idea not found" });

  const { action, reason } = parsed.data;

  db.prepare(
    `INSERT INTO idea_feedback (idea_id, action, reason) VALUES (?, ?, ?)`
  ).run(ideaId, action, reason || null);

  db.prepare(
    `UPDATE ideas SET status = ?, decided_at = datetime('now') WHERE id = ?`
  ).run(action, ideaId);

  updatePreferences(ideaId, action);

  res.json({ success: true, ideaId, action });
});

export default router;
