#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer } from "./index.js";
import { ExamStore } from "./examStore.js";
import { SamplingLLMClient } from "./llm.js";
import { OpenAuthProvider } from "./oauth.js";

/**
 * Remote (Streamable HTTP) entrypoint, for use as a Claude.ai connector.
 *
 * Unlike the stdio entrypoint (one private process per user, its own
 * ANTHROPIC_API_KEY), this serves many concurrent users from one shared
 * process. Each session gets its own McpServer + ExamStore so exams never
 * leak across sessions, and question generation/grading is done via MCP
 * sampling (the connected client's own model) instead of a server-held API
 * key — see SamplingLLMClient in src/llm.ts.
 */

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const PUBLIC_URL = process.env.PUBLIC_URL ?? `http://localhost:${PORT}`;

const app = createMcpExpressApp({ host: "0.0.0.0" });

app.get("/", (_req: Request, res: Response) => {
  res.status(200).send("exam-sheet MCP server is running. Connect at /mcp.");
});

// OAuth surface for hosts whose connector flow always attempts Dynamic
// Client Registration (see OpenAuthProvider docstring). /mcp is not gated
// behind it — clients that skip auth entirely keep working.
app.use(
  mcpAuthRouter({
    provider: new OpenAuthProvider(),
    issuerUrl: new URL(PUBLIC_URL),
    scopesSupported: ["mcp:tools"],
  }),
);

// One transport (and one McpServer + ExamStore) per active session.
const transports: Record<string, StreamableHTTPServerTransport> = {};

function buildServer(): McpServer {
  let server: McpServer;
  const store = new ExamStore(new SamplingLLMClient(() => server));
  server = createServer(store);
  return server;
}

const mcpPostHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  try {
    let transport: StreamableHTTPServerTransport;
    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
        },
      });
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) delete transports[sid];
      };
      const server = buildServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      });
      return;
    }
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("Error handling MCP request:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
};

const mcpSessionHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
};

app.post("/mcp", mcpPostHandler);
app.get("/mcp", mcpSessionHandler);
app.delete("/mcp", mcpSessionHandler);

app.listen(PORT, () => {
  // stderr-equivalent: this is the HTTP entrypoint, stdout is not a JSON-RPC
  // stream here, so plain console.log is fine.
  console.log(`exam-sheet MCP server listening on port ${PORT}`);
});
