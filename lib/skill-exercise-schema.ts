import { z } from "zod";

const node = z.enum(["browser", "service", "database", "cache"]);
export const ExerciseSceneSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("flow"),
    nodes: z.array(node).min(2).max(4),
    actions: z.record(node),
    reverse: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("capacity"),
    traffic: z.number().positive(),
    perServer: z.number().positive(),
    failures: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("bottleneck"),
    appCapacity: z.number().positive(),
    databaseCapacity: z.number().positive(),
  }),
  z.object({
    kind: z.literal("cache"),
    traffic: z.number().positive(),
    hitRate: z.number().min(0).max(100),
  }),
  z.object({ kind: z.literal("durability") }),
  z.object({
    kind: z.literal("invalidation"),
    cached: z.string(),
    stored: z.string(),
  }),
]);
export type ExerciseScene = z.infer<typeof ExerciseSceneSchema>;

const common = {
  id: z.string().min(1),
  title: z.string().min(1),
  context: z.string().min(1),
  recap: z.boolean().optional(),
  prompt: z.string().min(1),
  explanation: z.string().min(1),
  hint: z.string().min(1),
  scene: ExerciseSceneSchema.optional(),
};
export const SkillExerciseSchema = z
  .discriminatedUnion("kind", [
    z.object({
      ...common,
      kind: z.literal("number"),
      answer: z.number().finite(),
      unit: z.string(),
      mistakes: z.array(z.object({ value: z.number(), feedback: z.string() })),
    }),
    z.object({
      ...common,
      kind: z.literal("sequence"),
      items: z.array(z.object({ id: z.string(), text: z.string() })).min(2),
      answer: z.array(z.string()).min(2),
    }),
    z.object({
      ...common,
      kind: z.literal("match"),
      pairs: z
        .array(
          z.object({
            id: z.string().min(1),
            label: z.string().min(1),
            detail: z.string().min(1),
            explanation: z.string().optional(),
          }),
        )
        .min(2)
        .max(8),
    }),
    z.object({
      ...common,
      kind: z.literal("choice"),
      options: z.array(z.string()).min(2),
      correctAnswer: z.number().int().nonnegative(),
      optionFeedback: z.array(z.string()),
    }),
  ])
  .superRefine((exercise, ctx) => {
    if (
      exercise.kind === "match" &&
      (new Set(exercise.pairs.map((p) => p.id)).size !==
        exercise.pairs.length ||
        new Set(exercise.pairs.map((p) => p.label)).size !==
          exercise.pairs.length ||
        new Set(exercise.pairs.map((p) => p.detail)).size !==
          exercise.pairs.length)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Matching pairs must have unique IDs, labels, and descriptions",
      });
    if (exercise.scene?.kind === "flow") {
      const scene = exercise.scene;
      if (
        exercise.kind !== "sequence" ||
        exercise.items.some((item) => !scene.actions[item.id]) ||
        Object.keys(scene.actions).some(
          (id) => !exercise.items.some((item) => item.id === id),
        ) ||
        Object.values(scene.actions).some(
          (target) => !scene.nodes.includes(target),
        )
      )
        ctx.addIssue({
          code: "custom",
          message:
            "A flow scene must map every sequence action to a visible node",
        });
    }
    if (
      exercise.kind === "choice" &&
      (exercise.correctAnswer >= exercise.options.length ||
        exercise.optionFeedback.length !== exercise.options.length)
    )
      ctx.addIssue({
        code: "custom",
        message: "Choice answers and feedback must match options",
      });
    if (
      exercise.kind === "sequence" &&
      (new Set(exercise.answer).size !== exercise.items.length ||
        new Set(exercise.items.map((item) => item.id)).size !==
          exercise.items.length ||
        exercise.answer.length !== exercise.items.length ||
        exercise.items.some((item) => !exercise.answer.includes(item.id)))
    )
      ctx.addIssue({
        code: "custom",
        message: "Sequence answer must contain every item exactly once",
      });
  });
export const SkillExercisePackSchema = z.object({
  version: z.number().int().positive(),
  groups: z
    .array(
      z.object({
        id: z.string().min(1),
        variants: z.array(SkillExerciseSchema).min(1),
      }),
    )
    .min(1),
});
export type SkillExercise = z.infer<typeof SkillExerciseSchema>;
export type SkillExercisePack = z.infer<typeof SkillExercisePackSchema>;

export function selectSkillExercises(
  pack: SkillExercisePack,
  review: number,
): SkillExercise[] {
  return pack.groups.map(
    (group) => group.variants[Math.max(0, review) % group.variants.length],
  );
}
