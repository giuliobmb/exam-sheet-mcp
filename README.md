# Exam Sheet — an MCP App

Generate a timed exam on any topic and take it in an interactive exam sheet that
renders directly inside an MCP host (Claude Desktop, VS Code, etc.). Supports
true/false, multiple-choice, and open questions. Objective questions are graded
instantly; open answers are graded by the model. At the end you get a report
with a grade out of 100.

## How it works

An MCP App is a **tool + a UI resource** linked by `_meta.ui.resourceUri`:

- `generate_exam` — the entry tool. Generates the questions and opens the sheet.
- `get_exam` — called by the sheet on load to fetch questions and the answer key.
- `grade_answer` — called by the sheet to grade an open answer.
- `ui://exam-sheet/exam.html` — the interactive sheet, rendered in a sandboxed iframe.

```
src/
  types.ts       shared types
  examLogic.ts   pure logic (prompts, parsing, scoring, grade conversion) — fully tested
  llm.ts         LLM client interface + Anthropic implementation (lazy-loaded)
  examStore.ts   generation + grading orchestration, in-memory exam store
  ui.ts          the exam sheet HTML (vanilla JS, talks to the host via ext-apps)
  index.ts       MCP server: registers the resource and the three tools
test/
  examLogic.test.ts
  examStore.test.ts
```

## Local development

```bash
npm install
npm test          # runs the unit tests (no network, no API key needed)
npm run typecheck
npm run build     # compiles TypeScript to dist/
export ANTHROPIC_API_KEY=sk-ant-...
npm start         # runs the server over stdio
```

To try it in Claude Desktop, add to your MCP config:

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

Then ask the host to run **generate_exam** with a topic.

## Publishing

The MCP Registry stores **metadata only** — it does not host your code. So you
publish the package to npm first, then register the metadata. Run these from
**your own machine**, logged into your own npm and GitHub accounts.

Before you start, replace the placeholders in `package.json` and `server.json`:

- `YOUR_NPM_USERNAME` → your npm username (the `@scope`)
- `YOUR_GITHUB_USERNAME` → your GitHub username (used for the `io.github.*` namespace)

### 1. Publish the package to npm

```bash
npm login
npm run build
npm publish --access public
```

### 2. Install the registry publisher CLI

```bash
# macOS/Linux (Homebrew)
brew install mcp-publisher
# or download a release binary from the modelcontextprotocol/registry repo
```

### 3. Authenticate with a namespace that matches your server name

The server name is `io.github.YOUR_GITHUB_USERNAME/exam-sheet`, so authenticate
with GitHub — the namespace must match:

```bash
mcp-publisher login github
```

### 4. Publish to the registry

```bash
mcp-publisher publish
```

This validates `server.json`, checks that the npm package carries the matching
`mcpName` field (already set in `package.json`), and submits the metadata.

### 5. Verify

Search the registry for `io.github.YOUR_GITHUB_USERNAME/exam-sheet` and confirm
the version and package reference resolve. Submissions are reviewed, so approval
may not be instant.

## Notes

- Keep the `@modelcontextprotocol/ext-apps` version used via `esm.sh` in
  `src/ui.ts` aligned with the dependency version in `package.json`.
- The server generates questions and grades open answers with the Anthropic API.
  If you prefer not to ship an API key, swap `AnthropicClient` for an
  implementation backed by MCP sampling (ask the host's model instead).
