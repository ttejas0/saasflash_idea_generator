export const openRouterConfig = {
  apiKey: process.env.OPENROUTER_API_KEY || "",
  siteUrl: process.env.SITE_URL || "http://localhost:3000",
  siteName: process.env.SITE_NAME || "Curation Tool",
  defaultModel: process.env.OPENROUTER_MODEL || "deepseek/deepseek-r1:free",
};

export function validateOpenRouterConfig() {
  if (!openRouterConfig.apiKey) {
    throw new Error(
      "Missing OPENROUTER_API_KEY. Please set it in your environment variables or .env file.",
    );
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

/**
 * Makes a chat completion request to OpenRouter.
 */
export async function chatCompletion(options: ChatCompletionOptions) {
  validateOpenRouterConfig();

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterConfig.apiKey}`,
        "HTTP-Referer": openRouterConfig.siteUrl,
        "X-Title": openRouterConfig.siteName,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openRouterConfig.defaultModel,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens,
      }),
    },
  );

  const data: any = await response.json();

  if (!response.ok) {
    throw new Error(
      `OpenRouter Error ${response.status}: ${data?.error?.message || "Unknown error"}`,
    );
  }

  return data;
}
