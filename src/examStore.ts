import { randomUUID } from "node:crypto";
import type { Exam, GenerateExamInput, Grade } from "./types.js";
import type { LLMClient } from "./llm.js";
import {
  ExamError,
  buildGenerationPrompt,
  buildGradingPrompt,
  minutesToSeconds,
  parseGrade,
  parseModelJSON,
  validateAndNormalizeQuestions,
} from "./examLogic.js";

/** A view of an exam that never leaks the answer key to the client. */
export interface ExamPublicView {
  id: string;
  topic: string;
  timeLimitSeconds: number | null;
  questions: Array<{
    type: Exam["questions"][number]["type"];
    question: string;
    options?: string[];
  }>;
}

export class ExamStore {
  private exams = new Map<string, Exam>();
  private latestId: string | null = null;

  constructor(private readonly llm: LLMClient) {}

  async generateExam(input: GenerateExamInput): Promise<Exam> {
    if (!input.topic.trim()) {
      throw new ExamError("A topic is required to generate an exam.");
    }
    if (input.types.length === 0) {
      throw new ExamError("At least one question type is required.");
    }
    const { system, user } = buildGenerationPrompt(
      input.topic.trim(),
      input.numQuestions,
      input.types,
    );
    const raw = await this.llm.complete(system, user);
    const questions = validateAndNormalizeQuestions(parseModelJSON(raw));
    const exam: Exam = {
      id: randomUUID(),
      topic: input.topic.trim(),
      timeLimitSeconds: minutesToSeconds(input.timeLimitMinutes),
      questions,
      createdAt: Date.now(),
    };
    this.exams.set(exam.id, exam);
    this.latestId = exam.id;
    return exam;
  }

  /** Get an exam by id, or the most recently generated one if id is omitted. */
  getExam(id?: string): Exam {
    const key = id ?? this.latestId;
    if (!key) throw new ExamError("No exam has been generated yet.");
    const exam = this.exams.get(key);
    if (!exam) throw new ExamError(`Exam not found: ${key}`);
    return exam;
  }

  /** Client-safe view: keeps question text and options, drops the answer key. */
  getPublicView(id?: string): ExamPublicView {
    const exam = this.getExam(id);
    return {
      id: exam.id,
      topic: exam.topic,
      timeLimitSeconds: exam.timeLimitSeconds,
      questions: exam.questions.map((q) => ({
        type: q.type,
        question: q.question,
        ...(q.type === "mc" ? { options: q.options } : {}),
      })),
    };
  }

  /** Answer key kept separate so objective grading can happen client-side. */
  getAnswerKey(id?: string): Array<string | number | null> {
    const exam = this.getExam(id);
    return exam.questions.map((q) =>
      q.type === "open" ? null : q.correctAnswer,
    );
  }

  async gradeOpenAnswer(
    examId: string | undefined,
    questionIndex: number,
    studentAnswer: string,
  ): Promise<Grade> {
    const exam = this.getExam(examId);
    const q = exam.questions[questionIndex];
    if (!q) throw new ExamError(`Question index out of range: ${questionIndex}`);
    if (q.type !== "open") {
      throw new ExamError("Only open questions are graded by the model.");
    }
    if (!studentAnswer.trim()) {
      return { score: 0, feedback: "No answer provided." };
    }
    const { system, user } = buildGradingPrompt(q, studentAnswer.trim());
    const raw = await this.llm.complete(system, user);
    return parseGrade(raw);
  }
}
