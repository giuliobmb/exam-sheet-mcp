import type {
  ExamResult,
  Grade,
  Question,
  QuestionType,
} from "./types.js";

/** Thrown when model output cannot be parsed or is structurally invalid. */
export class ExamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExamError";
  }
}

export const QUESTION_TYPES: QuestionType[] = ["tf", "mc", "open"];

export const TYPE_LABELS: Record<QuestionType, string> = {
  tf: "True or False",
  mc: "Multiple choice",
  open: "Open question",
};

// ── Prompt building ─────────────────────────────────────────

export function buildGenerationPrompt(
  topic: string,
  numQuestions: number,
  types: QuestionType[],
): { system: string; user: string } {
  const label = types.map((t) => TYPE_LABELS[t]).join(", ");
  const system =
    "You are a university professor writing rigorous but clear exam questions. " +
    "Reply ONLY with a valid JSON array, no preamble, no markdown, no comments. " +
    "Each element has exactly this shape: " +
    '{"type": "tf" | "mc" | "open", "question": string, ' +
    '"options": [4 strings] (only when type is "mc"), ' +
    '"correctAnswer": (for tf the string "True" or "False"; ' +
    "for mc a 0-3 integer index; for open a concise ideal answer, max 2 sentences), " +
    '"explanation": short string, max 1 sentence}. ' +
    "Be concise: the token budget is limited.";
  const user =
    `Generate exactly ${numQuestions} university-level exam questions on the topic "${topic}". ` +
    `Mix these question types: ${label}. Vary the difficulty. Reply with the JSON array only.`;
  return { system, user };
}

export function buildGradingPrompt(
  question: Extract<Question, { type: "open" }>,
  studentAnswer: string,
): { system: string; user: string } {
  const system =
    "You are a university professor grading open exam answers. " +
    "Compare the student's answer with the ideal answer, judging understanding and " +
    "completeness rather than wording. Reply ONLY with valid JSON of the exact shape: " +
    '{"score": integer 0-100, "feedback": "short comment, max 2 sentences"}.';
  const user =
    `Question: ${question.question}\n` +
    `Ideal answer: ${question.correctAnswer}\n` +
    `Student answer: ${studentAnswer}`;
  return { system, user };
}

// ── Model output parsing ────────────────────────────────────

/** Strip markdown fences and parse JSON, tolerating minor wrapping text. */
export function parseModelJSON(raw: string): unknown {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall back to extracting the first array or object in the text.
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* fall through */
      }
    }
    throw new ExamError("Model did not return valid JSON.");
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Validate and normalize raw parsed data into a typed Question array. */
export function validateAndNormalizeQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ExamError("Expected a non-empty array of questions.");
  }
  return raw.map((item, i) => normalizeQuestion(item, i));
}

function normalizeQuestion(item: unknown, i: number): Question {
  if (typeof item !== "object" || item === null) {
    throw new ExamError(`Question ${i} is not an object.`);
  }
  const q = item as Record<string, unknown>;
  if (!isNonEmptyString(q.question)) {
    throw new ExamError(`Question ${i} is missing question text.`);
  }
  const explanation = isNonEmptyString(q.explanation)
    ? q.explanation
    : undefined;

  switch (q.type) {
    case "tf": {
      const a = String(q.correctAnswer);
      if (a !== "True" && a !== "False") {
        throw new ExamError(
          `Question ${i} (tf) correctAnswer must be "True" or "False".`,
        );
      }
      return { type: "tf", question: q.question, correctAnswer: a, explanation };
    }
    case "mc": {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new ExamError(`Question ${i} (mc) needs at least 2 options.`);
      }
      const options = q.options.map((o) => String(o));
      const idx = Number(q.correctAnswer);
      if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
        throw new ExamError(
          `Question ${i} (mc) correctAnswer index is out of range.`,
        );
      }
      return {
        type: "mc",
        question: q.question,
        options,
        correctAnswer: idx,
        explanation,
      };
    }
    case "open": {
      if (!isNonEmptyString(q.correctAnswer)) {
        throw new ExamError(`Question ${i} (open) needs an ideal answer.`);
      }
      return {
        type: "open",
        question: q.question,
        correctAnswer: q.correctAnswer,
        explanation,
      };
    }
    default:
      throw new ExamError(`Question ${i} has an unknown type: ${String(q.type)}.`);
  }
}

/** Parse and clamp a grade returned by the model. */
export function parseGrade(raw: string): Grade {
  const parsed = parseModelJSON(raw) as Record<string, unknown>;
  const scoreNum = Number(parsed.score);
  const score = Number.isFinite(scoreNum)
    ? Math.max(0, Math.min(100, Math.round(scoreNum)))
    : 0;
  const feedback = isNonEmptyString(parsed.feedback) ? parsed.feedback : "";
  return { score, feedback };
}

// ── Scoring ─────────────────────────────────────────────────

/** Score an objective (tf/mc) question. Returns 100 or 0. */
export function scoreObjective(
  question: Question,
  chosen: string | number,
): number {
  if (question.type === "tf") {
    return chosen === question.correctAnswer ? 100 : 0;
  }
  if (question.type === "mc") {
    return chosen === question.correctAnswer ? 100 : 0;
  }
  throw new ExamError("scoreObjective was called on an open question.");
}

// ── Grade conversion (0–100 scale) ──────────────────────────

export function computeGrade(percent: number): ExamResult {
  if (percent < 60) {
    return { percent, grade: null, passed: false, honors: false };
  }
  return { percent, grade: percent, passed: true, honors: percent >= 97 };
}

export function computeExamResult(
  scores: Array<number | null>,
): ExamResult {
  if (scores.length === 0) {
    return { percent: 0, grade: null, passed: false, honors: false };
  }
  const total = scores.reduce<number>((sum, s) => sum + (s ?? 0), 0);
  const percent = Math.round(total / scores.length);
  return computeGrade(percent);
}

// ── Helpers ─────────────────────────────────────────────────

export function formatTime(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function minutesToSeconds(minutes: number | null): number | null {
  if (minutes === null) return null;
  return Math.max(0, Math.round(minutes * 60));
}
