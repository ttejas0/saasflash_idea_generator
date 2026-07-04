import { chatCompletion } from "../config/openrouter";
import { getPreferenceSummary, PreferenceSummary } from "./preferences";
import { z } from "zod";

// --- Zod schema for LLM response ---
const IdeaSchema = z.object({
  title: z.string().min(5),
  idea_type: z.enum(["product", "content", "operations"]),
  news: z.string().min(10),
  attention_point: z.string().min(10),
  angle_1: z.string().min(10),
  angle_2: z.string().min(10),
  audience: z.array(z.enum(["founders", "operators", "builders"])).min(1),
  tags: z.array(z.string()).min(1),
  source_item_ids: z.array(z.string()).default([]),
  novelty_score: z.number().min(0).max(1).default(0.5),
  relevance_score: z.number().min(0).max(1).default(0.5),
});

export const IdeasResponseSchema = z.object({
  ideas: z.array(IdeaSchema),
});

export type GeneratedIdea = z.infer<typeof IdeaSchema>;

interface SourceItem {
  id: number;
  title: string;
  summary: string;
  url: string;
  category: string;
  published_at: string | null;
}

function buildPrompt(sourceItems: SourceItem[], prefs: PreferenceSummary, count: number): string {
  const sourceSummaries = sourceItems
    .slice(0, 30)
    .map((s, i) => `[${i + 1}] (${s.category}) ${s.title}\n${s.summary?.slice(0, 300) || ""}`)
    .join("\n\n");

  const prefSection = `
Preferred tags: ${prefs.preferredTags.length > 0 ? prefs.preferredTags.join(", ") : "none yet"}
Rejected tags: ${prefs.rejectedTags.length > 0 ? prefs.rejectedTags.join(", ") : "none"}
Preferred audience: ${prefs.preferredAudiences.length > 0 ? prefs.preferredAudiences.join(", ") : "all"}
Preferred idea types: ${prefs.preferredIdeaTypes.length > 0 ? prefs.preferredIdeaTypes.join(", ") : "all"}

Recently approved ideas (generate similar quality, not duplicates):
${prefs.recentApprovedExamples.length > 0 ? prefs.recentApprovedExamples.map((e) => `- ${e}`).join("\n") : "- none yet"}

Recently rejected ideas (avoid these angles):
${prefs.recentRejectedExamples.length > 0 ? prefs.recentRejectedExamples.map((e) => `- ${e}`).join("\n") : "- none"}
`;

  return `You are an expert idea generator for a daily briefing tool targeting founders, operators, and builders.

Your job is to analyze recent tech and business signals, then generate ${count} distinct, actionable idea cards.

## Source Signals (recent articles/posts):
${sourceSummaries}

## User Preferences:
${prefSection}

## Rules:
- Each idea MUST be grounded in at least one source signal above. Reference its number in source_item_ids.
- NEVER write tutorials, how-to guides, or step-by-step instructions.
- Frame each idea as an opportunity, gap, angle, or shift — not a prescription.
- Target audience must be one or more of: founders, operators, builders.
- Idea types: "product" (SaaS/tools/extensions), "content" (newsletters/essays/teardowns/reports), "operations" (workflow automation, process blueprints, productivity systems).
- Balance idea types: aim for roughly equal mix across product/content/operations.
- Avoid ideas similar to recently rejected ones.
- Prefer ideas matching the user's preferred tags when possible, but maintain diversity.
- novelty_score: how fresh/novel this idea is (0=stale, 1=very novel).
- relevance_score: how relevant to the target audience (0=low, 1=very high).

## Response Format:
Return ONLY valid JSON matching this exact structure:
{
  "ideas": [
    {
      "title": "concise punchy title",
      "idea_type": "product|content|operations",
      "news": "the recent news or signal (2-3 sentences)",
      "attention_point": "what's important to pay attention to here (2-3 sentences)",
      "angle_1": "first angle suggestion (actionable opportunity)",
      "angle_2": "second angle suggestion (alternative or complementary approach)",
      "audience": ["founders"|"operators"|"builders"],
      "tags": ["tag1", "tag2"],
      "source_item_ids": ["1", "3"],
      "novelty_score": 0.8,
      "relevance_score": 0.9
    }
  ]
}`;
}

/**
 * Calls the LLM to generate ideas from source items.
 * Returns raw validated ideas from the model.
 */
export async function generateIdeasFromLLM(
  sourceItems: SourceItem[],
  count = 10
): Promise<GeneratedIdea[]> {
  const prefs = getPreferenceSummary();
  const prompt = buildPrompt(sourceItems, prefs, count);

  const response = await chatCompletion({
    messages: [
      {
        role: "system",
        content:
          "You are an expert idea generator. Always respond with valid JSON only. No markdown, no explanation.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.85,
    max_tokens: 4000,
  });

  console.log("Raw LLM response object:", JSON.stringify(response, null, 2));
  const raw = response.choices?.[0]?.message?.content || "";

  // Strip markdown code fences, then extract JSON
  const stripped = raw.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "");
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`LLM returned non-JSON response: ${raw.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const validated = IdeasResponseSchema.safeParse(parsed);

  if (!validated.success) {
    console.error("[openrouter] Validation errors:", validated.error.issues);
    throw new Error(`LLM response failed validation: ${validated.error.message}`);
  }

  return validated.data.ideas;
}
