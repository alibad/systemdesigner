/**
 * Zod schema for the centralized quiz bank (lib/quiz-bank/all-quizzes.json).
 * Until now quiz JSON had no validation, so a question with a correctAnswer index out
 * of range or a missing explanation could ship silently. This is the app-side source of
 * truth for the shape; scripts/validate-content.cjs enforces the same rules in CI.
 */
import { z } from 'zod';

export const QuizQuestionSchema = z
  .object({
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    correctAnswer: z.number().int().nonnegative(),
    explanation: z.string().min(1),
  })
  .refine((q) => q.correctAnswer < q.options.length, {
    message: 'correctAnswer index is out of range for options',
    path: ['correctAnswer'],
  });

export const QuizSchema = z.object({
  title: z.string().min(1),
  section: z.string().optional(),
  difficulty: z.string().optional(),
  duration: z.string().optional(),
  questions: z.array(QuizQuestionSchema).min(1),
});

export const QuizBankSchema = z.record(z.string(), QuizSchema);

export type Quiz = z.infer<typeof QuizSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
