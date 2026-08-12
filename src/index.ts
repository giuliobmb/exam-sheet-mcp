#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { createUIResource } from "@mcp-ui/server";
import { z } from "zod";
import { ExamStore } from "./examStore.js";
import { AnthropicClient } from "./llm.js";
import { QUESTION_TYPES } from "./examLogic.js";
import { examAppHtml } from "./ui.js";
import type { GenerateExamInput } from "./types.js";

const RESOURCE_URI = "ui://exam-sheet/exam.html";

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: data as Record<string, unknown>,
  };
}

export function createServer(store = new ExamStore(new AnthropicClient())): McpServer {
  const server = new McpServer({ name: "exam-sheet", version: "1.0.0" });

  // UI resource (the exam sheet).
  const ui = createUIResource({
    uri: RESOURCE_URI,
    content: { type: "rawHtml", htmlString: examAppHtml() },
    encoding: "text",
  });
  registerAppResource(server, "exam_sheet_ui", ui.resource.uri, {}, async () => ({
    contents: [ui.resource],
  }));

  // Entry tool: generate an exam and open the sheet.
  registerAppTool(
    server,
    "generate_exam",
    {
      title: "Generate exam",
      description:
        "Generate an exam on a topic and open an interactive exam sheet with a timer.",
      inputSchema: {
        topic: z.string().describe("Subject or topic for the exam."),
        numQuestions: z.number().int().min(1).max(20).default(10),
        timeLimitMinutes: z
          .number()
          .int()
          .min(1)
          .nullable()
          .default(50)
          .describe("Time limit in minutes, or null for no limit."),
        types: z
          .array(z.enum(["tf", "mc", "open"]))
          .default([...QUESTION_TYPES])
          .describe("Question types to mix."),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (args) => {
      const input: GenerateExamInput = {
        topic: args.topic,
        numQuestions: args.numQuestions,
        timeLimitMinutes: args.timeLimitMinutes,
        types: args.types.length ? args.types : [...QUESTION_TYPES],
      };
      const exam = await store.generateExam(input);
      return jsonResult({
        examId: exam.id,
        topic: exam.topic,
        questionCount: exam.questions.length,
        timeLimitSeconds: exam.timeLimitSeconds,
      });
    },
  );

  // Called by the UI on load to fetch the questions and answer key.
  server.registerTool(
    "get_exam",
    {
      description: "Return the most recent exam for the sheet to render.",
      inputSchema: { examId: z.string().optional() },
    },
    async ({ examId }) =>
      jsonResult({
        exam: store.getPublicView(examId),
        answerKey: store.getAnswerKey(examId),
      }),
  );

  // Called by the UI to grade an open-question answer.
  server.registerTool(
    "grade_answer",
    {
      description: "Grade a single open-question answer and return score plus feedback.",
      inputSchema: {
        examId: z.string().optional(),
        questionIndex: z.number().int().min(0),
        studentAnswer: z.string(),
      },
    },
    async ({ examId, questionIndex, studentAnswer }) => {
      const grade = await store.gradeOpenAnswer(examId, questionIndex, studentAnswer);
      return jsonResult(grade);
    },
  );

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr so it never corrupts the stdio JSON-RPC stream.
  console.error("exam-sheet MCP server running on stdio");
}

// Run only when executed directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
