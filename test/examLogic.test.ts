import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ExamError,
  buildGenerationPrompt,
  buildGradingPrompt,
  computeExamResult,
  computeGrade,
  formatTime,
  minutesToSeconds,
  parseGrade,
  parseModelJSON,
  scoreObjective,
  validateAndNormalizeQuestions,
} from "../src/examLogic.js";
import type { Question } from "../src/types.js";

test("buildGenerationPrompt embeds topic, count and type labels", () => {
  const { system, user } = buildGenerationPrompt("IFRS inventories", 6, [
    "tf",
    "mc",
  ]);
  assert.match(user, /IFRS inventories/);
  assert.match(user, /exactly 6/);
  assert.match(user, /True or False/);
  assert.match(user, /Multiple choice/);
  assert.match(system, /valid JSON array/);
});

test("buildGradingPrompt includes ideal and student answers", () => {
  const q = {
    type: "open" as const,
    question: "Define break-even.",
    correctAnswer: "Where revenue equals total cost.",
  };
  const { user } = buildGradingPrompt(q, "when profit is zero");
  assert.match(user, /Where revenue equals total cost/);
  assert.match(user, /when profit is zero/);
});

test("parseModelJSON handles plain, fenced and wrapped JSON", () => {
  assert.deepEqual(parseModelJSON('[{"a":1}]'), [{ a: 1 }]);
  assert.deepEqual(parseModelJSON('```json\n[{"a":1}]\n```'), [{ a: 1 }]);
  assert.deepEqual(
    parseModelJSON('Here you go: [{"a":1}] hope it helps'),
    [{ a: 1 }],
  );
});

test("parseModelJSON throws on garbage", () => {
  assert.throws(() => parseModelJSON("not json at all"), ExamError);
});

test("validateAndNormalizeQuestions accepts a valid mixed set", () => {
  const raw = [
    { type: "tf", question: "Q1", correctAnswer: "True" },
    {
      type: "mc",
      question: "Q2",
      options: ["a", "b", "c", "d"],
      correctAnswer: 2,
    },
    { type: "open", question: "Q3", correctAnswer: "ideal" },
  ];
  const out = validateAndNormalizeQuestions(raw);
  assert.equal(out.length, 3);
  assert.equal(out[1].type, "mc");
});

test("validateAndNormalizeQuestions rejects an empty array", () => {
  assert.throws(() => validateAndNormalizeQuestions([]), ExamError);
});

test("validateAndNormalizeQuestions rejects unknown type", () => {
  assert.throws(
    () => validateAndNormalizeQuestions([{ type: "essay", question: "Q" }]),
    ExamError,
  );
});

test("validateAndNormalizeQuestions rejects out-of-range mc index", () => {
  assert.throws(
    () =>
      validateAndNormalizeQuestions([
        { type: "mc", question: "Q", options: ["a", "b"], correctAnswer: 5 },
      ]),
    ExamError,
  );
});

test("validateAndNormalizeQuestions rejects bad tf answer", () => {
  assert.throws(
    () =>
      validateAndNormalizeQuestions([
        { type: "tf", question: "Q", correctAnswer: "maybe" },
      ]),
    ExamError,
  );
});

test("validateAndNormalizeQuestions rejects empty open ideal answer", () => {
  assert.throws(
    () =>
      validateAndNormalizeQuestions([
        { type: "open", question: "Q", correctAnswer: "  " },
      ]),
    ExamError,
  );
});

test("scoreObjective grades tf and mc correctly", () => {
  const tf: Question = { type: "tf", question: "Q", correctAnswer: "False" };
  assert.equal(scoreObjective(tf, "False"), 100);
  assert.equal(scoreObjective(tf, "True"), 0);

  const mc: Question = {
    type: "mc",
    question: "Q",
    options: ["a", "b", "c"],
    correctAnswer: 1,
  };
  assert.equal(scoreObjective(mc, 1), 100);
  assert.equal(scoreObjective(mc, 0), 0);
});

test("scoreObjective throws on open questions", () => {
  const open: Question = { type: "open", question: "Q", correctAnswer: "x" };
  assert.throws(() => scoreObjective(open, "x"), ExamError);
});

test("parseGrade clamps and rounds the score", () => {
  assert.deepEqual(parseGrade('{"score": 150, "feedback": "ok"}'), {
    score: 100,
    feedback: "ok",
  });
  assert.deepEqual(parseGrade('{"score": -20, "feedback": "no"}'), {
    score: 0,
    feedback: "no",
  });
  assert.deepEqual(parseGrade('{"score": 73.6, "feedback": "good"}'), {
    score: 74,
    feedback: "good",
  });
});

test("parseGrade falls back to empty feedback and zero score", () => {
  assert.deepEqual(parseGrade('{"score": "abc"}'), { score: 0, feedback: "" });
});

test("computeGrade maps percentages to the 0-100 scale", () => {
  assert.equal(computeGrade(59).grade, null);
  assert.equal(computeGrade(59).passed, false);
  assert.equal(computeGrade(60).grade, 60);
  assert.equal(computeGrade(100).grade, 100);
  assert.equal(computeGrade(100).honors, true);
  assert.equal(computeGrade(96).honors, false);
  assert.equal(computeGrade(97).honors, true);
});

test("computeExamResult averages scores and counts blanks as zero", () => {
  const r = computeExamResult([100, 100, null, 0]); // avg 50 -> fail
  assert.equal(r.percent, 50);
  assert.equal(r.passed, false);

  const r2 = computeExamResult([100, 80, 90]); // avg 90 -> pass
  assert.equal(r2.percent, 90);
  assert.equal(r2.passed, true);
});

test("computeExamResult handles the empty case", () => {
  assert.deepEqual(computeExamResult([]), {
    percent: 0,
    grade: null,
    passed: false,
    honors: false,
  });
});

test("formatTime formats mm:ss and clamps negatives", () => {
  assert.equal(formatTime(50 * 60), "50:00");
  assert.equal(formatTime(65), "01:05");
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(-5), "00:00");
});

test("minutesToSeconds converts and preserves null", () => {
  assert.equal(minutesToSeconds(50), 3000);
  assert.equal(minutesToSeconds(null), null);
});
