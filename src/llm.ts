import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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

/**
 * LLM client backed by MCP sampling: asks the connected host's own model to
 * complete the request instead of calling a model API directly. Used for the
 * remote HTTP deployment, where the server has no API key of its own and
 * every connected client brings its own model.
 *
 * `getServer` is a getter rather than a direct reference because the store
 * (and this client) are constructed before the `McpServer` they'll be
 * attached to; by the time `complete` actually runs, the server exists.
 */
export class SamplingLLMClient implements LLMClient {
  private maxTokens: number;

  constructor(
    private getServer: () => McpServer,
    opts: { maxTokens?: number } = {},
  ) {
    this.maxTokens = opts.maxTokens ?? 1000;
  }

  async complete(system: string, user: string): Promise<string> {
    const result = await this.getServer().server.createMessage({
      messages: [{ role: "user", content: { type: "text", text: user } }],
      systemPrompt: system,
      maxTokens: this.maxTokens,
    });
    const text = result.content.type === "text" ? result.content.text : "";
    if (!text.trim()) {
      throw new Error("The model returned an empty response.");
    }
    return text;
  }
}
