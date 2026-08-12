# CLAUDE.md — handoff & publishing instructions

This project is an **MCP App** ("Exam Sheet") that is already written and unit-tested.
Your job is to help the user verify it with real dependencies and publish it to npm
and the official MCP Registry. Read this whole file before acting.

## What this project is

An MCP App = a tool + a UI resource linked by `_meta.ui.resourceUri`. It generates
a timed exam on any topic (true/false, multiple choice, open questions) and renders
an interactive exam sheet inside an MCP host, with live grading and a final grade
out of 100. Architecture and file map are in `README.md`.

## What is already done

- All source in `src/` (types, pure logic, LLM client, exam store, UI HTML, server).
- Unit tests in `test/` — 29 tests, all passing, no network or API key required.
- `package.json`, `server.json`, `tsconfig.json`, `.gitignore`, `README.md`.

## Before you touch anything: ask the user for two values

The package and registry name contain placeholders that MUST be replaced with the
user's real accounts. Do not guess them — ask:

1. Their **npm username** (or scope) → replaces `YOUR_NPM_USERNAME`
2. Their **GitHub username** → replaces `YOUR_GITHUB_USERNAME`

Replace every occurrence in **`package.json`** and **`server.json`**:
- `package.json`: the `name` field (`@YOUR_NPM_USERNAME/...`) and `mcpName`
  (`io.github.YOUR_GITHUB_USERNAME/...`)
- `server.json`: `name`, `repository.url`, and `packages[0].identifier`

The npm scope and the `io.github.<user>` namespace must be consistent between the
two files, or the registry publish will fail verification.

## Step 1 — Verify locally

```bash
npm install
npm test        # expect: 29 passing
npm run typecheck
npm run build   # emits dist/
```

If `npm install` pulls SDK versions that differ from what's pinned, note it. In
particular, confirm the installed `@modelcontextprotocol/ext-apps` major version
matches the one imported via `esm.sh` in `src/ui.ts` (currently unpinned → latest).
If the API surface (`registerAppTool`, `registerAppResource`, `createUIResource`,
the `App` class methods `connect` / `callServerTool` / `sendMessage`) has changed in
the installed versions, adjust `src/index.ts` and `src/ui.ts` accordingly, then make
`npm run build` pass. Do not change the tested pure logic in `src/examLogic.ts`
unless a test tells you to.

## Step 2 — Smoke-test in a host (optional but recommended)

Set `ANTHROPIC_API_KEY`, run `npm start`, and wire the built server into Claude
Desktop (config example in `README.md`). Confirm `generate_exam` opens the sheet,
the timer runs, objective questions grade instantly, and an open answer gets a
score. Fix anything that breaks before publishing.

## Step 3 — Publish (requires the user's own credentials)

These steps use the user's npm and GitHub accounts. If you cannot authenticate as
them, hand these commands back to the user to run — do not attempt to publish under
any other identity.

```bash
# 3a. Publish the package to npm
npm login
npm run build
npm publish --access public

# 3b. Install the registry publisher CLI
brew install mcp-publisher   # or a release binary from modelcontextprotocol/registry

# 3c. Authenticate with the matching namespace
mcp-publisher login github   # namespace must match io.github.<user>/exam-sheet

# 3d. Publish metadata to the registry
mcp-publisher publish
```

## Step 4 — Verify

Search the registry for `io.github.<user>/exam-sheet` and confirm the version and
npm package reference resolve. Submissions are reviewed, so approval may lag.

## Guardrails

- The registry stores metadata only; the code lives on npm. Publish npm first.
- Never invent SDK method names — verify against the installed packages.
- Keep `ANTHROPIC_API_KEY` out of the repo and out of any committed file.
- If the user prefers not to ship an API key, swap `AnthropicClient` (in `src/llm.ts`)
  for an implementation backed by MCP sampling, and update the env-var requirement
  in `server.json` and `README.md`.
