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
