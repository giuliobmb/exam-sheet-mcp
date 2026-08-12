export type QuestionType = "tf" | "mc" | "open";

export interface BaseQuestion {
  type: QuestionType;
  question: string;
  explanation?: string;
}

export interface TFQuestion extends BaseQuestion {
  type: "tf";
  /** Correct answer for a true/false question. */
  correctAnswer: "True" | "False";
}

export interface MCQuestion extends BaseQuestion {
  type: "mc";
  options: string[];
  /** Index (0-based) of the correct option. */
  correctAnswer: number;
}

export interface OpenQuestion extends BaseQuestion {
  type: "open";
  /** A concise ideal answer used as the grading reference. */
  correctAnswer: string;
}

export type Question = TFQuestion | MCQuestion | OpenQuestion;

export interface Exam {
  id: string;
  topic: string;
  timeLimitSeconds: number | null;
  questions: Question[];
  createdAt: number;
}

export interface Grade {
  /** 0-100 integer score. */
  score: number;
  feedback: string;
}

export interface ExamResult {
  percent: number;
  /** Final grade out of 100, or null if failed. */
  grade: number | null;
  passed: boolean;
  honors: boolean;
}

export interface GenerateExamInput {
  topic: string;
  numQuestions: number;
  timeLimitMinutes: number | null;
  types: QuestionType[];
}
