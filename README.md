# Exam Sheet — an MCP App

Generate a timed exam on any topic and take it in an interactive exam sheet that
renders directly inside an MCP host (Claude Desktop, VS Code, etc.). Supports
true/false, multiple-choice, and open questions. Objective questions are graded
instantly; open answers are graded by the model. At the end you get a report
with a grade out of 100.

## Installation

Add the server to your MCP host config, e.g. `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "exam-sheet": {
      "command": "npx",
      "args": ["-y", "@giuliobmb/exam-sheet-mcp"],
      "env": { "ANTHROPIC_API_KEY": "sk-ant-..." }
    }
  }
}
```

Restart the host after saving the config.

### As a remote connector (Claude.ai or ChatGPT)

The same server also runs as a remote Streamable HTTP endpoint at `/mcp`
(`src/httpServer.ts`), so it can be added as a connector by URL instead of a
local install — on Claude.ai directly, or on ChatGPT via Settings → Apps →
Advanced settings → Developer mode → Add connector. In that mode it has no
API key of its own — question generation and grading go through MCP
sampling, i.e. the connected client's own model — and each session gets its
own isolated exam store.

The exam sheet UI is registered twice: once as an MCP Apps resource for
Claude, once adapted for ChatGPT's Apps SDK (`_meta["openai/outputTemplate"]`
on `generate_exam`, via `@mcp-ui/server`'s `appsSdk` adapter) — same HTML,
no changes needed between hosts.

Deploy it anywhere that runs a Node web service (a `render.yaml` blueprint is
included for Render's free tier); then add `https://<your-deployment>/mcp` as
a connector URL.

## Usage

Ask the host to run **generate_exam** with a topic, e.g. "Generate an exam on
the French Revolution." The interactive sheet opens with a timer; answer each
question and submit to see instant grading (or model-graded feedback for open
questions). At the end you get a full report with a grade out of 100.

## Local development

```bash
npm install
npm test          # runs the unit tests (no network, no API key needed)
npm run typecheck
npm run build     # compiles TypeScript to dist/
export ANTHROPIC_API_KEY=sk-ant-...
npm start         # runs the server over stdio
npm run start:http  # runs the remote (Streamable HTTP) entrypoint on :3000
```

To try a local build in Claude Desktop, point the config at the compiled file
instead of the npm package:

```json
{
  "mcpServers": {
    "exam-sheet": {
      "command": "node",
      "args": ["/absolute/path/to/exam-mcp/dist/index.js"],
      "env": { "ANTHROPIC_API_KEY": "sk-ant-..." }
    }
  }
}
```
