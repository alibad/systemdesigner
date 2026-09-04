/** A review rotates through the source assessment without changing lesson quizzes. */
export function selectSessionQuestions<T>(
  questions: T[],
  count?: number,
  offset = 0,
): T[] {
  if (!count || questions.length <= count) return questions;
  const start =
    ((offset % questions.length) + questions.length) % questions.length;
  return Array.from(
    { length: Math.min(count, questions.length) },
    (_, index) => questions[(start + index) % questions.length],
  );
}
