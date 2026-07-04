import { Router } from "express";
import { z } from "zod";
import { fetchAllSources } from "../services/feeds";
import { runGenerationPipeline } from "../services/generation";
import { getDb } from "../db/connection";

const router = Router();

// POST /api/admin/fetch-sources
router.post("/fetch-sources", async (_req, res) => {
  try {
    const count = await fetchAllSources();
    res.json({ success: true, newItems: count });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/generate
const generateSchema = z.object({
  count: z.number().int().min(1).max(30).optional().default(10),
  runType: z.enum(["daily", "manual", "retry"]).optional().default("manual"),
});

router.post("/generate", async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
  }

  try {
    const result = await runGenerationPipeline(parsed.data);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/admin/stats
router.get("/stats", (_req, res) => {
  const db = getDb();

  const stats = {
    sources: db.prepare("SELECT COUNT(*) as count FROM sources WHERE enabled = 1").get(),
    sourceItems: db.prepare("SELECT COUNT(*) as count FROM source_items").get(),
    totalIdeas: db.prepare("SELECT COUNT(*) as count FROM ideas").get(),
    approved: db.prepare("SELECT COUNT(*) as count FROM ideas WHERE status = 'approved'").get(),
    rejected: db.prepare("SELECT COUNT(*) as count FROM ideas WHERE status = 'rejected'").get(),
    todayIdeas: db
      .prepare("SELECT COUNT(*) as count FROM ideas WHERE created_at >= date('now')")
      .get(),
    lastBatch: db
      .prepare("SELECT * FROM idea_batches ORDER BY created_at DESC LIMIT 1")
      .get(),
  };

  res.json(stats);
});

export default router;
