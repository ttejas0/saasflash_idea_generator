import "dotenv/config";
import express from "express";
import cors from "cors";
import ideasRouter from "./routes/ideas";
import sourcesRouter from "./routes/sources";
import adminRouter from "./routes/admin";
import { getDb } from "./db/connection";
import { seedSources } from "./db/seed";
import { scheduleDailyGeneration } from "./jobs/dailyGeneration";

const app = express();
const PORT = parseInt(process.env.APP_PORT || "3001", 10);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/ideas", ideasRouter);
app.use("/api/sources", sourcesRouter);
app.use("/api/admin", adminRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server] Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Boot
const db = getDb(); // Run migrations
seedSources();      // Seed default sources
scheduleDailyGeneration();

app.listen(PORT, () => {
  console.log(`\n🚀 Idea Generator API running on http://localhost:${PORT}`);
  console.log(`   Health:     GET  http://localhost:${PORT}/api/health`);
  console.log(`   Today:      GET  http://localhost:${PORT}/api/ideas/today`);
  console.log(`   Generate:   POST http://localhost:${PORT}/api/admin/generate`);
  console.log(`   Fetch feeds:POST http://localhost:${PORT}/api/admin/fetch-sources`);
  console.log(`   Stats:      GET  http://localhost:${PORT}/api/admin/stats\n`);
});

export default app;
