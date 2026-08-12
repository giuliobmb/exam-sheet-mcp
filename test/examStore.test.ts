import { test } from "node:test";
import assert from "node:assert/strict";
import { ExamStore } from "../src/examStore.js";
import { ExamError } from "../src/examLogic.js";
import type { LLMClient } from "../src/llm.js";

const SAMPLE = JSON.stringify([
  { type: "tf", question: "Q1", correctAnswer: "True", explanation: "e" },
  { type: "mc", question: "Q2", options: ["a", "b", "c", "d"], correctAnswer: 2 },
  { type: "open", question: "Q3", correctAnswer: "ideal answer" },
]);

/** Fake client that returns queued responses in order. */
class FakeLLM implements LLMClient {
  public calls: Array<{ system: string; user: string }> = [];
  constructor(private queue: string[]) {}
  async complete(system: string, user: string): Promise<string> {
    this.calls.push({ system, user });
    const next = this.queue.shift();
    if (next === undefined) throw new Error("FakeLLM ran out of responses.");
    return next;
  }
}

const input = {
  topic: "Management accounting",
  numQuestions: 3,
  timeLimitMinutes: 50,
  types: ["tf", "mc", "open"] as const,
};

test("generateExam produces a stored exam with an id and time limit", async () => {
  const store = new ExamStore(new FakeLLM([SAMPLE]));
  const exam = await store.generateExam({ ...input, types: [...input.types] });
  assert.ok(exam.id);
  assert.equal(exam.questions.length, 3);
  assert.equal(exam.timeLimitSeconds, 3000);
  assert.equal(store.getExam(exam.id).topic, "Management accounting");
});

test("getExam without id returns the latest exam", async () => {
  const store = new ExamStore(new FakeLLM([SAMPLE, SAMPLE]));
  const first = await store.generateExam({ ...input, types: [...input.types] });
  const second = await store.generateExam({ ...input, types: [...input.types] });
  assert.notEqual(first.id, second.id);
  assert.equal(store.getExam().id, second.id);
});

test("getExam throws before any generation", () => {
  const store = new ExamStore(new FakeLLM([]));
  assert.throws(() => store.getExam(), ExamError);
});

test("public view hides answers, answer key exposes them", async () => {
  const store = new ExamStore(new FakeLLM([SAMPLE]));
  await store.generateExam({ ...input, types: [...input.types] });
  const view = store.getPublicView();
  assert.equal(view.questions[0].type, "tf");
  assert.equal("correctAnswer" in view.questions[0], false);
  assert.deepEqual(view.questions[1].options, ["a", "b", "c", "d"]);

  const key = store.getAnswerKey();
  assert.deepEqual(key, ["True", 2, null]);
});

test("gradeOpenAnswer grades an open question via the model", async () => {
  const store = new ExamStore(
    new FakeLLM([SAMPLE, '{"score": 80, "feedback": "solid"}']),
  );
  const exam = await store.generateExam({ ...input, types: [...input.types] });
  const grade = await store.gradeOpenAnswer(exam.id, 2, "my answer");
  assert.equal(grade.score, 80);
  assert.equal(grade.feedback, "solid");
});

test("gradeOpenAnswer refuses objective questions", async () => {
  const store = new ExamStore(new FakeLLM([SAMPLE]));
  const exam = await store.generateExam({ ...input, types: [...input.types] });
  await assert.rejects(() => store.gradeOpenAnswer(exam.id, 0, "x"), ExamError);
});

test("gradeOpenAnswer rejects an out-of-range index", async () => {
  const store = new ExamStore(new FakeLLM([SAMPLE]));
  const exam = await store.generateExam({ ...input, types: [...input.types] });
  await assert.rejects(() => store.gradeOpenAnswer(exam.id, 9, "x"), ExamError);
});

test("gradeOpenAnswer returns zero for a blank answer without calling the model", async () => {
  const fake = new FakeLLM([SAMPLE]); // only one response queued
  const store = new ExamStore(fake);
  const exam = await store.generateExam({ ...input, types: [...input.types] });
  const grade = await store.gradeOpenAnswer(exam.id, 2, "   ");
  assert.equal(grade.score, 0);
  assert.equal(fake.calls.length, 1); // generation only, no grading call
});

test("generateExam surfaces parse errors from bad model output", async () => {
  const store = new ExamStore(new FakeLLM(["totally not json"]));
  await assert.rejects(
    () => store.generateExam({ ...input, types: [...input.types] }),
    ExamError,
  );
});

test("generateExam rejects empty topic and empty types", async () => {
  const store = new ExamStore(new FakeLLM([SAMPLE, SAMPLE]));
  await assert.rejects(
    () =>
      store.generateExam({
        topic: "   ",
        numQuestions: 3,
        timeLimitMinutes: 50,
        types: ["tf"],
      }),
    ExamError,
  );
  await assert.rejects(
    () =>
      store.generateExam({
        topic: "x",
        numQuestions: 3,
        timeLimitMinutes: 50,
        types: [],
      }),
    ExamError,
  );
});
