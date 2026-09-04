"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { InteractiveQuiz } from "@/components/fundamentals/InteractiveLearning";
import { learningAssetUrl } from "@/lib/learning-assets";
import ExerciseScene from "./ExerciseScene";
import {
  exerciseAnswerCorrect,
  restoreExerciseIndex,
  type ExerciseResume,
  type ExerciseAnswer,
  type QuizResume,
} from "@/lib/learning-resume";
import {
  SkillExercisePackSchema,
  selectSkillExercises,
  type SkillExercise,
  type SkillExercisePack,
} from "@/lib/skill-exercise-schema";

export default function SkillPractice({
  file,
  review,
  revision,
  onAttempt,
  onComplete,
  onProgress,
  initialResume,
  onResume,
}: {
  initialResume?: ExerciseResume;
  onResume?: (value: ExerciseResume) => void;
  file: string;
  review: number;
  revision: string;
  onAttempt: (result: { correct: boolean; hinted: boolean }) => void;
  onComplete: () => void;
  onProgress?: (completed: number, total: number) => void;
}) {
  const [pack, setPack] = useState<SkillExercisePack>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [index, setIndex] = useState(0);
  const initial = useRef(initialResume);
  const completed = useRef<ExerciseAnswer[]>(initialResume?.completed || []);
  const currentAnswer = useRef<ExerciseAnswer>();
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch(learningAssetUrl(file, revision), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Unavailable");
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          const parsed = SkillExercisePackSchema.parse(data);
          const restored = restoreExerciseIndex(
            selectSkillExercises(parsed, review),
            initial.current,
          );
          completed.current = completed.current.slice(0, restored);
          setIndex(restored);
          setPack(parsed);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [file, revision, retry, review]);
  const exercises = useMemo(
    () => (pack ? selectSkillExercises(pack, review) : []),
    [pack, review],
  );
  useEffect(() => {
    if (exercises.length)
      onProgress?.(
        index +
          (exerciseAnswerCorrect(exercises[index], initial.current) ? 1 : 0),
        exercises.length,
      );
  }, [index, exercises, onProgress]);
  if (error)
    return (
      <div role="alert" className="rounded-xl border p-5">
        The practice couldn’t load.
        <button
          className="ml-2 underline"
          onClick={() => setRetry((value) => value + 1)}
        >
          Retry loading practice
        </button>
      </div>
    );
  if (!pack) return <p role="status">Loading interactive practice…</p>;
  const currentIndex = Math.min(index, exercises.length - 1);
  const current = exercises[currentIndex];
  return (
    <div>
      <p className="mb-4 text-xs font-medium uppercase tracking-wider text-neutral-500">
        Exercise {currentIndex + 1} of {exercises.length}
      </p>
      <Exercise
        key={current.id}
        exercise={current}
        initialResume={
          initial.current?.exerciseId === current.id
            ? initial.current
            : undefined
        }
        onResume={(value) => {
          currentAnswer.current = { ...value, exerciseId: current.id };
          onResume?.({
            ...currentAnswer.current,
            index: currentIndex,
            completed: completed.current,
          });
        }}
        onAttempt={onAttempt}
        onJudged={(correct) =>
          onProgress?.(currentIndex + (correct ? 1 : 0), exercises.length)
        }
        onNext={() => {
          if (currentIndex + 1 === exercises.length) onComplete();
          else {
            if (currentAnswer.current)
              completed.current = [
                ...completed.current.slice(0, currentIndex),
                currentAnswer.current,
              ];
            setIndex(currentIndex + 1);
          }
        }}
        final={currentIndex + 1 === exercises.length}
      />
    </div>
  );
}

function Exercise({
  exercise,
  onAttempt,
  onJudged,
  onNext,
  final,
  initialResume,
  onResume,
}: {
  initialResume?: ExerciseResume;
  onResume: (
    value: Omit<ExerciseResume, "index" | "exerciseId" | "completed">,
  ) => void;
  exercise: SkillExercise;
  onAttempt: (result: { correct: boolean; hinted: boolean }) => void;
  onJudged: (correct: boolean) => void;
  onNext: () => void;
  final: boolean;
}) {
  const [value, setValue] = useState(initialResume?.value || "");
  const [order, setOrder] = useState<string[]>(
    exercise.kind === "sequence" || exercise.kind === "match"
      ? (initialResume?.order || []).filter(
          (id, index, all) =>
            (exercise.kind === "sequence"
              ? exercise.items
              : exercise.pairs
            ).some((item) => item.id === id) && all.indexOf(id) === index,
        )
      : [],
  );
  const [hinted, setHinted] = useState(initialResume?.hinted || false);
  const [result, setResult] = useState<boolean | null>(
    initialResume?.checked ? exerciseAnswerCorrect(exercise, initialResume) : null,
  );
  const [attempt, setAttempt] = useState(0);
  const [quizResume, setQuizResume] = useState<QuizResume | undefined>(
    initialResume?.quiz,
  );
  const restoredChoice = initialResume?.quiz?.answers[0];
  const [choiceOutcome, setChoiceOutcome] = useState<boolean | null>(
    exercise.kind === "choice" &&
      restoredChoice !== undefined &&
      restoredChoice >= 0
      ? restoredChoice === exercise.correctAnswer
      : null,
  );
  const save = useRef(onResume);
  save.current = onResume;
  useEffect(() => {
    save.current({
      value,
      order,
      hinted,
      checked: result !== null,
      ...(quizResume ? { quiz: quizResume } : {}),
    });
  }, [value, order, hinted, result, quizResume]);
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const choices = useRef<HTMLDivElement>(null);
  const checkSequence = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (result !== null) {
      feedback.current?.focus();
      feedback.current?.scrollIntoView({ block: "center" });
    }
  }, [result]);
  const question = useMemo(
    () =>
      exercise.kind === "choice"
        ? [
            {
              id: exercise.id,
              question: exercise.prompt,
              options: exercise.options,
              correctAnswer: exercise.correctAnswer,
              explanation: exercise.explanation,
              optionFeedback: exercise.optionFeedback,
            },
          ]
        : [],
    [exercise],
  );
  const submit = () => {
    const correct =
      exercise.kind === "number"
        ? Number(value) === exercise.answer
        : (exercise.kind === "sequence" || exercise.kind === "match") &&
          JSON.stringify(order) ===
            JSON.stringify(
              exercise.kind === "sequence"
                ? exercise.answer
                : exercise.pairs.map((pair) => pair.id),
            );
    setResult(correct);
    onJudged(correct);
    onAttempt({ correct, hinted });
  };
  const restart = () => {
    setResult(null);
    setChoiceOutcome(null);
    setQuizResume(undefined);
    setAttempt((value) => value + 1);
    heading.current?.focus();
  };
  const button = "learning-primary";
  return (
    <div className="space-y-5">
      <div>
        <h2
          ref={heading}
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          {exercise.title}
        </h2>
        {exercise.recap ? <details className="mt-2 text-sm text-neutral-500">
          <summary className="min-h-11 cursor-pointer py-2">Need a reminder?</summary>
          <p className="py-2 leading-6">{exercise.context}</p>
        </details> : <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{exercise.context}</p>}
      </div>
      {exercise.kind !== "choice" && (
        <p className="font-medium leading-6">{exercise.prompt}</p>
      )}
      {exercise.scene && (
        <ExerciseScene
          scene={exercise.scene}
          order={order}
          value={value}
          outcome={exercise.kind === "choice" ? choiceOutcome : result}
        />
      )}
      {exercise.kind === "number" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (
              value.trim() &&
              Number.isFinite(Number(value)) &&
              result === null
            )
              submit();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="block text-sm">
            <span className="mb-2 block">Your answer</span>
            <input
              autoComplete="off"
              type="number"
              step="any"
              inputMode="decimal"
              required
              disabled={result !== null}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="w-36 rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-lg focus-visible:outline-emerald-500 dark:border-neutral-600"
            />
          </label>
          <span className="pb-3 text-sm text-neutral-500">{exercise.unit}</span>
          {result === null && (
            <div className="learning-actions">
              <button
                className={button}
                disabled={
                  result !== null ||
                  !value.trim() ||
                  !Number.isFinite(Number(value))
                }
              >
                Check answer
              </button>
            </div>
          )}
        </form>
      )}
      {exercise.kind === "sequence" && (
        <div className="space-y-4">
          <ol
            aria-label="Your sequence"
            className="space-y-2 rounded-2xl border border-dashed border-neutral-300 p-3 dark:border-neutral-600"
          >
            {order.length === 0 && (
              <li className="px-2 py-4 text-sm text-neutral-500">
                Choose the first action below.
              </li>
            )}
            {order.map((id, index) => (
              <li
                key={id}
                className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/40"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs text-white">
                  {index + 1}
                </span>
                <span className="flex-1 text-sm">
                  {exercise.items.find((item) => item.id === id)?.text}
                </span>
                <button
                  disabled={result !== null}
                  onClick={() => setOrder(order.filter((item) => item !== id))}
                  aria-label={`Remove action ${index + 1}`}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500 dark:hover:bg-neutral-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
          {order.length < exercise.items.length && (
            <div
              ref={choices}
              className="space-y-2"
              aria-label="Available actions"
            >
              {exercise.items
                .filter((item) => !order.includes(item.id))
                .map((item) => (
                  <button
                    key={item.id}
                    disabled={result !== null}
                    onClick={() => {
                      setOrder([...order, item.id]);
                      requestAnimationFrame(() =>
                        (
                          choices.current?.querySelector<HTMLButtonElement>(
                            "button",
                          ) || checkSequence.current
                        )?.focus(),
                      );
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 p-3 text-left text-sm hover:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400 dark:border-neutral-700"
                  >
                    <ArrowDown className="h-4 w-4 shrink-0 text-neutral-400" />
                    {item.text}
                  </button>
                ))}
            </div>
          )}
          {result === null && (
            <div className="learning-actions">
              <button
                ref={checkSequence}
                className={button}
                disabled={
                  result !== null || order.length !== exercise.items.length
                }
                onClick={submit}
              >
                Check sequence
              </button>
            </div>
          )}
        </div>
      )}
      {exercise.kind === "match" && (
        <div className="space-y-4">
          {order.length < exercise.pairs.length && (
            <div className="rounded-xl border border-sky-300 bg-sky-50 p-4 dark:border-sky-700 dark:bg-sky-950/30">
              <p className="mb-1 text-xs font-medium text-sky-700 dark:text-sky-300">
                Match {order.length + 1} of {exercise.pairs.length}
              </p>
              <h3 className="text-lg font-semibold">
                {exercise.pairs[order.length].label}
              </h3>
              <p className="mt-1 text-sm">Choose its responsibility below.</p>
            </div>
          )}
          {order.length > 0 && (
            <details open={order.length === exercise.pairs.length}>
              <summary className="min-h-11 cursor-pointer text-sm font-medium">
                Your matches ({order.length})
              </summary>
              <ol aria-label="Your matches" className="space-y-2">
                {order.map((id, index) => (
                  <li
                    key={exercise.pairs[index].id}
                    className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700"
                  >
                    <p className="text-sm font-semibold">
                      {exercise.pairs[index].label}
                    </p>
                    <div className="mt-2 flex items-start gap-2">
                      <p className="flex-1 text-sm leading-6">
                        {exercise.pairs.find((p) => p.id === id)?.detail}
                      </p>
                      <button
                        disabled={result !== null}
                        aria-label={`Change match ${index + 1}`}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg"
                        onClick={() => setOrder(order.slice(0, index))}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </details>
          )}
          {order.length < exercise.pairs.length && (
            <div
              ref={choices}
              aria-label="Available roles"
              className="space-y-2"
            >
              {[...exercise.pairs]
                .reverse()
                .filter((pair) => !order.includes(pair.id))
                .map((pair) => (
                  <button
                    key={pair.id}
                    disabled={result !== null}
                    className="w-full rounded-xl border border-neutral-200 p-3 text-left text-sm leading-6 hover:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-neutral-700"
                    onClick={() => {
                      setOrder([...order, pair.id]);
                      requestAnimationFrame(() =>
                        (
                          choices.current?.querySelector<HTMLButtonElement>(
                            "button",
                          ) || checkSequence.current
                        )?.focus(),
                      );
                    }}
                  >
                    {pair.detail}
                  </button>
                ))}
            </div>
          )}
          {result === null && (
            <div className="learning-actions">
              <button
                ref={checkSequence}
                className={button}
                disabled={order.length !== exercise.pairs.length}
                onClick={submit}
              >
                Check matches
              </button>
            </div>
          )}
        </div>
      )}
      {exercise.kind === "choice" && result === null && (
        <InteractiveQuiz
          key={attempt}
          title="Make the decision"
          initialResume={quizResume}
          onResume={setQuizResume}
          questions={question}
          sessionMode
          finishLabel={
            choiceOutcome === false
              ? "Try this exercise again"
              : final
                ? "Complete practice"
                : "Next exercise"
          }
          onAnswer={(answer) => {
            setChoiceOutcome(answer.correct);
            onJudged(answer.correct);
            onAttempt({ correct: answer.correct, hinted });
          }}
          onComplete={({ score, total }) =>
            score === total ? onNext() : restart()
          }
        />
      )}
      {result === null && choiceOutcome === null && (
        <div>
          <button
            className="min-h-11 text-sm font-medium underline underline-offset-4"
            aria-expanded={hinted}
            onClick={() => {
              setHinted(true);
              onAttempt({ correct: true, hinted: true });
            }}
          >
            Need a hint?
          </button>
          {hinted && (
            <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {exercise.hint}
            </p>
          )}
        </div>
      )}
      {result !== null && (
        <div
          ref={feedback}
          tabIndex={-1}
          className={`rounded-2xl border p-5 ${result ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40" : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"}`}
        >
          <div role="status">
            <h3 className="flex items-center gap-2 font-semibold">
              {result ? (
                <Check className="h-5 w-5 text-emerald-600" />
              ) : (
                <RotateCcw className="h-5 w-5 text-amber-600" />
              )}
              {result ? "That works." : "Look at the consequence."}
            </h3>
            <p className="mt-3 text-sm leading-6">
              {!result && exercise.kind === "number"
                ? exercise.mistakes.find(
                    (mistake) => mistake.value === Number(value),
                  )?.feedback || exercise.explanation
                : !result && exercise.kind === "match"
                  ? (() => {
                      const pair = exercise.pairs.find(
                        (pair, index) => pair.id !== order[index],
                      )!;
                      return `${pair.label}: ${pair.explanation || pair.detail}`;
                    })()
                  : exercise.explanation}
            </p>
            {!result && exercise.kind === "sequence" && (
              <p className="mt-2 text-sm">
                The first action to revisit is step{" "}
                {order.findIndex((id, index) => id !== exercise.answer[index]) +
                  1}
                .
              </p>
            )}
          </div>
          <div className="learning-actions">
            <button
              onClick={result ? onNext : restart}
              className={`${button} mt-4`}
            >
              {result
                ? final
                  ? "Complete practice"
                  : "Next exercise"
                : "Try this exercise again"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
