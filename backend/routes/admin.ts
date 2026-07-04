import { Router } from "express";
import { z } from "zod";
import { fetchAllSources } from "../services/feeds";
import { runGenerationPipeline } from "../services/generation";
import { getDb } from "../db/connection";

const router = Router();

// POST /api/admin/fetch-sources
router.post("/fetch-sources", async (_req, res) => {
  console.log(`[api/admin] POST /fetch-sources — starting feed fetch...`);
  try {
    const count = await fetchAllSources();
    console.log(`[api/admin]   Feed fetch complete: ${count} new items`);
    res.json({ success: true, newItems: count });
  } catch (err) {
    console.error(`[api/admin]   ❌ Feed fetch failed:`, (err as Error).message);
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
    console.error(`[api/admin] POST /generate — invalid body:`, parsed.error.issues);
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
  }

  console.log(`[api/admin] POST /generate — count=${parsed.data.count}, runType=${parsed.data.runType}`);
  try {
    const result = await runGenerationPipeline(parsed.data);
    console.log(`[api/admin]   Generation complete:`, result);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(`[api/admin]   ❌ Generation failed:`, (err as Error).message);
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
