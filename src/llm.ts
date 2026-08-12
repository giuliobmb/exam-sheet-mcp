/** Minimal completion interface so the store can be tested with a fake. */
export interface LLMClient {
  complete(system: string, user: string): Promise<string>;
}

export interface AnthropicClientOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Anthropic-backed client. The SDK is loaded lazily so that importing this
 * module (e.g. from tests) does not require `@anthropic-ai/sdk` to be present.
 */
export class AnthropicClient implements LLMClient {
  private apiKey: string | undefined;
  private model: string;
  private maxTokens: number;

  constructor(opts: AnthropicClientOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
    this.model = opts.model ?? "claude-sonnet-4-6";
    this.maxTokens = opts.maxTokens ?? 1000;
  }

  async complete(system: string, user: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Export it before starting the server.",
      );
    }
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: this.apiKey });
    const res = await client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = res.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
    if (!text.trim()) {
      throw new Error("The model returned an empty response.");
    }
    return text;
  }
}
