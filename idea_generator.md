# Daily Tech Idea Generator - Detailed Plan

## 1. Product Goal

Build a single-page web app that surfaces fresh technology, product, operations, and content ideas every day, based on current signals from RSS feeds, subreddits, and other public sources. The app is optimized for creators, writers, and builders who produce content, build products, or optimize workflows for founders, operators, and builders. The app should avoid repeating ideas, learn from the user's approvals and rejections, and present ideas as suggestive prompts or angles rather than instructional "how-to" content.

The core experience is simple:

1. The app gathers recent tech and business signals.
2. An LLM turns those signals into distinct idea cards, categorized by type (Product, Content, Operations).
3. The user approves or rejects each card.
4. The system stores feedback and uses it to improve future ideas.

## 2. Target Audience

Primary users:
- **Content Creators / Writers**: People making newsletters, podcasts, or social content targeting founders, operators, and builders.
- **Builders / Solopreneurs**: Engineers and designers looking for SaaS, open-source, or developer tool product ideas.
- **Operators / Startup Teams**: Professionals seeking workflow automations, efficiency improvements, and tool-stack optimization concepts.

The app should optimize for:

- Fast review of many ideas.
- Novelty and freshness.
- Audience relevance mapping.
- Preference learning over time.
- Low friction daily usage.
- Avoiding duplicate or near-duplicate suggestions.

## 3. Core Experience

### Daily Flow

1. User opens the app.
2. App shows a stack or grid of idea cards generated for the current day.
3. Each card has:
   - **Idea Type**: Designated as `Product`, `Content`, or `Operations`.
   - **Idea Title**: Punchy and descriptive.
   - **Target Audience**: Who this idea serves (e.g., `Founders`, `Operators`, `Builders`).
   - **Recent Context**: What happened recently (the trigger signal).
   - **Suggestive Opportunity**: The hook/angle to explore.
   - **Source Links**: Links to original articles/posts.
   - **Topic Tags**: such as `AI`, `SaaS`, `developer tools`, `marketing/growth`, `workflow automation`, `scaling`.
4. User marks each idea as:
   - Approved.
   - Rejected.
   - Skipped or undecided.
5. Approved ideas are saved in a selected ideas view.
6. Feedback is stored and later used to bias generation toward similar qualities.

### Tone of Generated Ideas

The generated ideas should not be framed as tutorials.

Avoid:

- "How to build..."
- "Step-by-step guide..."
- "Create an app that..."

Prefer:

- "A new shift is happening in..."
- "Teams are struggling with..."
- "This opens room for..."
- "A lightweight product could help..."
- "What if there was a way to..."
- "An analytical deep-dive into..." (for Content ideas)

### Examples by Type

#### 1. Product Idea
```text
Type: Product
Title: Compliance Copilot for AI-Generated Code
Target Audience: Builders, Operators
What happened:
More companies are adopting AI coding assistants while legal and security teams are increasing scrutiny around generated code, licensing, and sensitive data exposure.
Opportunity:
A tool that reviews AI-generated pull requests for policy, license, and data-risk issues before merge could become useful for engineering teams with stricter governance needs.
```

#### 2. Content Idea
```text
Type: Content
Title: The Hidden Stack of Single-Person Unicorns
Target Audience: Founders, Builders
What happened:
Several solo developers have recently reached multi-million ARR using advanced AI agents, serverless stacks, and automated customer support.
Opportunity:
A case study breakdown analyzing the exact software stack, API costs, and operational workflows used by single-person startups to handle high scale.
```

#### 3. Operations Idea
```text
Type: Operations
Title: Auto-Triage for Multi-Channel Startup Support
Target Audience: Operators, Founders
What happened:
With products launching rapidly across Product Hunt, Twitter, Reddit, and Discord, startups struggle to aggregate and prioritize bug reports and feature requests.
Opportunity:
An automated workflow blueprint (e.g., n8n/Make) that gathers posts from these channels, classifies priority via LLM, and pushes issues directly into Linear/GitHub.
```

## 4. MVP Scope

### Must Have

- Single-page frontend.
- Node.js backend.
- SQLite database.
- OpenRouter integration for idea generation.
- RSS ingestion for tech news sources.
- Reddit ingestion using RSS and/or JSON endpoints.
- Daily idea generation job.
- Duplicate detection.
- Card UI with approve and reject actions.
- Persistence of shown, approved, rejected, and skipped ideas.
- Basic preference tracking based on user feedback.

### Should Have

- Source links on each idea.
- Tags and categories.
- "Approved ideas" list.
- Manual "generate more" action.
- Basic search or filtering by tag.
- Configurable source list.
- Admin/dev page or CLI command for testing ingestion and generation.

### Later

- User accounts.
- Multiple profiles or workspaces.
- Email digest.
- Saved idea notes.
- Export approved ideas to Markdown, CSV, Notion, or Linear.
- Embedding-based semantic duplicate detection.
- Scheduled background workers.
- Trending topic clustering.
- Personalized ranking model.

## 5. Recommended Stack

### Frontend

Use React if the app will grow beyond a basic prototype.

Recommended:

- Vite.
- React.
- TypeScript.
- Plain CSS or Tailwind CSS.
- Fetch API or TanStack Query.

Reasoning:

- The card review interface will likely gain filters, saved views, loading states, and preference controls.
- React is a reasonable fit even for a single-page app because state management matters here.

### Backend

Recommended:

- Node.js.
- Express or Fastify.
- TypeScript.
- SQLite.
- Drizzle ORM or Prisma.
- Zod for request validation.

Reasoning:

- Node.js keeps frontend/backend language consistent.
- SQLite is enough for local-first or single-user usage.
- A typed ORM makes migrations and schema changes easier.

### LLM Provider

Use OpenRouter for model access.

Backend responsibilities:

- Store the OpenRouter API key in environment variables.
- Build prompts from current source items, duplicate history, and preference data.
- Parse structured JSON responses from the model.
- Validate model output before saving.

## 6. Data Sources

### Initial RSS Sources

Start with a small, high-signal set. Too many feeds will create noisy ideas.

Suggested categories:

- Tech product launches and startup growth.
- AI development and tooling.
- Developer ecosystems and open source.
- Operational scaling, productivity, and SaaS workflows.
- Startup strategy and business models.

Potential sources:

- Hacker News RSS.
- Product Hunt RSS.
- TechCrunch (Startup & Enterprise feeds).
- Indie Hackers RSS (or popular articles feed).
- RSS feeds of top newsletters targeting operators/builders (e.g., Ben's Bites, TLDR, etc.).
- Reddit RSS feeds for selected subreddits.
- GitHub trending feeds (for developer/builder signals).

### Reddit Sources

Start with subreddits such as:

- `r/SaaS`
- `r/startups`
- `r/indiehackers`
- `r/growthhacking`
- `r/webdev`
- `r/programming`
- `r/MachineLearning`
- `r/artificial`
- `r/devops`
- `r/selfhosted`
- `r/ProductManagement`

The app should not blindly trust Reddit content. It should treat Reddit as a signal source, not a factual authority.

## 7. Data Model

### `sources`

Stores feed/source definitions.

Fields:

- `id`
- `name`
- `type`: `rss`, `reddit_rss`, `reddit_json`, `manual`
- `url`
- `category`
- `enabled`
- `created_at`
- `updated_at`

### `source_items`

Stores fetched articles/posts.

Fields:

- `id`
- `source_id`
- `external_id`
- `title`
- `summary`
- `url`
- `author`
- `published_at`
- `fetched_at`
- `raw_json`
- `content_hash`

Unique constraints:

- `source_id + external_id`
- `url`
- `content_hash`

### `idea_batches`

Represents one generation run.

Fields:

- `id`
- `run_type`: `daily`, `manual`, `retry`
- `status`: `pending`, `running`, `completed`, `failed`
- `model`
- `prompt_version`
- `started_at`
- `completed_at`
- `error_message`

### `ideas`

Stores generated ideas.

Fields:

- `id`
- `batch_id`
- `title`
- `idea_type`: `product`, `content`, `operations`
- `context`
- `opportunity`
- `why_now`
- `audience`: array or comma-separated string (e.g., `founders`, `operators`, `builders`)
- `tags`
- `source_item_ids`
- `novelty_score`
- `relevance_score`
- `duplicate_score`
- `status`: `new`, `shown`, `approved`, `rejected`, `skipped`, `archived`
- `created_at`
- `shown_at`
- `decided_at`

### `idea_feedback`

Stores user decisions and optional feedback.

Fields:

- `id`
- `idea_id`
- `action`: `approved`, `rejected`, `skipped`
- `reason`
- `created_at`

### `preference_signals`

Aggregated signals derived from feedback.

Fields:

- `id`
- `signal_type`: `tag`, `audience`, `source`, `phrase`, `category`
- `signal_value`
- `score`
- `approved_count`
- `rejected_count`
- `updated_at`

## 8. Duplicate Prevention

Use multiple layers.

### Layer 1: Source Item Dedupe

When fetching feeds:

- Deduplicate by URL.
- Deduplicate by source external ID.
- Deduplicate by normalized title hash.

### Layer 2: Exact Idea Dedupe

Before saving an idea:

- Normalize title.
- Normalize opportunity text.
- Generate a content hash.
- Reject exact hash matches.

### Layer 3: Similarity Dedupe

MVP option:

- Use simple text similarity over normalized title plus opportunity.
- Reject ideas above a similarity threshold.

Later option:

- Store embeddings.
- Compare against recently shown and approved ideas.
- Reject ideas above a semantic similarity threshold.

### Layer 4: Prompt-Level Dedupe

Send recent approved, rejected, and shown idea summaries into the generation prompt with instructions to avoid similar concepts.

## 9. Preference Learning

The MVP should use simple explicit feedback, not a complex ranking model.

When an idea is approved:

- Increase scores for its tags.
- Increase scores for its audience type.
- Increase scores for source categories that contributed to it.
- Record common positive phrases or themes.

When an idea is rejected:

- Decrease scores for its tags.
- Decrease scores for audience type.
- Record negative themes if the user provides a reason.

Generation prompt should include:

- Preferred tags.
- Rejected tags.
- Recently approved examples.
- Recently rejected examples.
- Instruction to vary ideas while respecting preferences.

Ranking should combine:

- Freshness of source material.
- Novelty against previous ideas.
- Preference match.
- Diversity across categories.

## 10. Generation Pipeline

### Daily Job

1. Fetch enabled sources.
2. Store new source items.
3. Select recent, relevant source items from the last 24-72 hours.
4. Cluster or group related items lightly by keyword/tag.
5. Build OpenRouter prompt.
6. Ask model for structured JSON output.
7. Validate response.
8. Deduplicate ideas.
9. Score ideas.
10. Save accepted ideas.
11. Mark generation batch as completed or failed.

### Manual Generation

The user can click "Generate more" to run the same pipeline on demand.

Differences:

- Use fewer source items.
- Return faster.
- Prefer diversity compared to currently visible cards.

## 11. Prompt Design

Use structured output.

Expected model response:

```json
{
  "ideas": [
    {
      "title": "string",
      "idea_type": "product | content | operations",
      "context": "string",
      "opportunity": "string",
      "why_now": "string",
      "audience": ["founders" | "operators" | "builders"],
      "tags": ["string"],
      "source_item_ids": ["string"],
      "novelty_score": 0.0,
      "relevance_score": 0.0
    }
  ]
}
```

Prompt requirements:

- **Target Audience Alignment**: Every idea must target at least one of: Founders (business strategy, growth, funding, PMF), Operators (workflows, scaling, tool-stacks, automation, productivity), or Builders (code, architecture, APIs, developer tools).
- **Idea Types**:
  - `product`: SaaS tools, open-source software, browser extensions, or developer tools.
  - `content`: Case study teardowns, trend reports, newsletter hooks, or analytical breakdowns.
  - `operations`: Automation blueprints, workflow templates (n8n/Make), productivity systems, or operational frameworks.
- **No Tutorials**: Do not write tutorials or instructional "how-to" guides. Frame ideas as suggestive opportunities or analysis topics.
- **Signal-Driven**: Every idea must derive from actual recent signals in the ingested feeds.
- **Deduplicated & Diverse**: Avoid repeating past concepts and ensure a balanced mix of idea types and audiences.
- Cite which source items influenced each idea.

## 12. API Design

### `GET /api/ideas/today`

Returns today's ideas.

Query params:

- `status`
- `limit`
- `tag`

### `POST /api/ideas/:id/feedback`

Stores approve/reject/skip action.

Body:

```json
{
  "action": "approved",
  "reason": "optional string"
}
```

### `GET /api/ideas/approved`

Returns approved ideas.

### `POST /api/generate`

Triggers manual generation.

Body:

```json
{
  "count": 10
}
```

### `GET /api/sources`

Returns configured sources.

### `POST /api/sources`

Adds a source.

### `POST /api/admin/fetch-sources`

Dev/admin endpoint to fetch latest source items.

## 13. Frontend Plan

### Main Screen

Single-page layout:

- Header with app name, date, and generation status.
- Filter bar for tags, status, and idea type (Product, Content, Operations).
- Idea card area.
- Approved ideas side panel or tab.

### Idea Card

Each card should include:

- **Idea Type Badge** (Product, Content, Operations) with distinct color coding.
- Title.
- **Audience Badges** (Founders, Operators, Builders).
- Recent context.
- Opportunity.
- Why now.
- Tags.
- Source links.
- Approve button.
- Reject button.
- Skip button.

### Views

MVP views can be tabs on the same page:

- `Today`
- `Approved`
- `Rejected`
- `Sources`

### Interaction Details

- Approving or rejecting should update instantly.
- Show a loading state while generating ideas.
- Show an empty state when no ideas are available.
- Show an error state if generation fails.
- Keep card density high enough for quick review.

## 14. Backend Plan

### Modules

- `server.ts`: app entrypoint.
- `db/`: SQLite connection, schema, migrations.
- `routes/ideas.ts`: idea APIs.
- `routes/sources.ts`: source APIs.
- `services/feeds.ts`: RSS and Reddit fetching.
- `services/openrouter.ts`: LLM calls.
- `services/generation.ts`: pipeline orchestration.
- `services/dedupe.ts`: duplicate checks.
- `services/preferences.ts`: preference scoring.
- `jobs/dailyGeneration.ts`: scheduled generation.

### Environment Variables

```text
DATABASE_URL=file:./data/app.db
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
APP_PORT=3000
```

## 15. Build Phases

### Phase 1: Project Setup

- Create Node.js backend project.
- Create React frontend project.
- Add TypeScript.
- Add linting and formatting.
- Configure environment variables.
- Set up SQLite and migrations.

Deliverable:

- App boots locally with frontend and backend.

### Phase 2: Database and Core API

- Implement database schema.
- Add CRUD for sources.
- Add API for listing ideas.
- Add API for feedback actions.
- Seed initial sources.

Deliverable:

- Ideas and feedback can be stored and retrieved.

### Phase 3: Feed Ingestion

- Implement RSS parser.
- Implement Reddit RSS ingestion.
- Optionally implement Reddit JSON ingestion.
- Store source items.
- Add dedupe for fetched items.

Deliverable:

- Backend can fetch recent technology source items into SQLite.

### Phase 4: LLM Generation

- Add OpenRouter client.
- Build prompt from recent source items and preference signals.
- Request structured JSON.
- Validate output.
- Store generated ideas.

Deliverable:

- Manual backend command or endpoint generates idea records.

### Phase 5: Duplicate Detection and Scoring

- Add normalized title/content hashing.
- Add simple similarity scoring.
- Reject duplicate generated ideas.
- Add freshness, novelty, and preference scoring.

Deliverable:

- Generated ideas are materially different from previous ideas.

### Phase 6: Frontend MVP

- Build single-page UI.
- Display today's idea cards.
- Add approve/reject/skip actions.
- Add approved ideas view.
- Add loading and error states.

Deliverable:

- User can review and save ideas from the browser.

### Phase 7: Preference Loop

- Aggregate feedback into preference signals.
- Include preference summary in prompts.
- Rank ideas by preference fit and novelty.

Deliverable:

- Future ideas gradually reflect user approvals and rejections.

### Phase 8: Daily Automation

- Add scheduled generation.
- Ensure one daily batch runs.
- Add retry behavior.
- Add logging for failed fetches and failed LLM calls.

Deliverable:

- New ideas are generated automatically each day.

### Phase 9: Polish and Reliability

- Add source management UI.
- Add manual regenerate button.
- Add tests for dedupe, scoring, and API routes.
- Add basic observability logs.
- Document local setup.

Deliverable:

- App is usable as a daily personal tool.

## 16. Testing Plan

### Unit Tests

- Normalize and hash source items.
- Detect duplicate ideas.
- Score preference signals.
- Validate OpenRouter response shape.
- Parse RSS feeds.

### Integration Tests

- Fetch source items and store them.
- Generate ideas from mocked LLM response.
- Approve/reject ideas and update preferences.
- Ensure duplicate ideas are not saved.

### Manual Tests

- Start backend and frontend.
- Fetch sources.
- Generate ideas.
- Approve and reject cards.
- Refresh page and confirm state persists.
- Run generation again and confirm old ideas are not repeated.

## 17. Key Risks

### Repetitive Ideas

Mitigation:

- Store all generated ideas.
- Use similarity checks.
- Include recent history in prompts.

### Low-Quality Source Noise

Mitigation:

- Start with fewer sources.
- Rank sources by historical usefulness.
- Let rejected ideas reduce source/category weight.

### LLM Output Invalid JSON

Mitigation:

- Validate with Zod.
- Retry once with a repair prompt.
- Log failed raw output.

### Preference Overfitting

Mitigation:

- Keep some daily exploration slots.
- Enforce category diversity.
- Avoid using only approved tags.

### API Cost

Mitigation:

- Generate in batches.
- Limit source items sent to the model.
- Cache generation results.
- Use smaller models for extraction and larger models only for final idea synthesis.

## 18. MVP Acceptance Criteria

The MVP is complete when:

- The app can fetch recent tech signals from configured feeds.
- The backend can generate at least 10 daily ideas using OpenRouter.
- The ideas are stored in SQLite.
- Previously shown ideas are not repeated exactly.
- The frontend shows idea cards on one page.
- The user can approve, reject, or skip each idea.
- Approved ideas remain accessible.
- User feedback affects later idea generation.
- The app can run locally from documented commands.

## 19. Suggested Initial Implementation Order

1. Scaffold project.
2. Add SQLite schema.
3. Add seed sources.
4. Build source ingestion.
5. Add idea storage APIs.
6. Add feedback APIs.
7. Add OpenRouter generation.
8. Add dedupe.
9. Build React card UI.
10. Add approved ideas view.
11. Add preference scoring.
12. Add daily scheduler.
13. Add tests and setup docs.

## 20. Open Decisions

- Should this be single-user only or support accounts from the start?
- Should approved ideas support notes?
- Should the app expose source management in the UI or keep it config-based first?
- Which OpenRouter model should be the default?
- Should daily generation happen on server startup, cron, or a hosted scheduler?
- Should source links be shown on every card or hidden behind an expand action?
