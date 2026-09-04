import fs from "node:fs";
import Markdoc from "@markdoc/markdoc";

const text = (node) =>
  !node
    ? ""
    : node.type === "text" || node.type === "code"
      ? node.attributes.content || ""
      : node.type.endsWith("break")
        ? " "
        : (node.children || []).map(text).join("");
const firstSentence = value => value.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || value;
const clean = (value) => value.replace(/\s+/g, " ").trim();
const paragraph = (node) =>
  clean(
    text(node?.children?.find((child) => child.type === "paragraph")) ||
      text(node),
  );

/** Reuse the actual lesson's authored roles and questions. Never infer a strict
 * execution order from a visual process: some flows contain optional/parallel work. */
export function sourcePractice(step, questions) {
  const ast = Markdoc.parse(
    fs.readFileSync(`content/entries${step.lessonPath}/index.mdoc`, "utf8"),
  );
  const nodes = [...ast.walk()];
  const models = [];
  let heading = step.title;
  for (const node of nodes) {
    if (node.type === "heading") heading = clean(text(node));
    if (
      !["interactive-block", "topology-lab", "traffic-split"].includes(node.tag)
    )
      continue;
    const { id, dataFile } = node.attributes;
    let data;
    if (dataFile)
      data = JSON.parse(
        fs.readFileSync(
          dataFile.replace("/api/content/", "content/entries/"),
          "utf8",
        ),
      );
    models.push({
      kind: node.tag,
      ...(id ? { id } : {}),
      ...(dataFile ? { dataFile } : {}),
      title: data?.title || heading,
    });
  }
  const groups = [];
  const collections = nodes.filter(
    (n) => n.tag === "process-flow" || n.tag === "concept-grid",
  );
  const roleSets = collections
    .map((node, index) => {
      const pairs = node.children
        .filter((child) => ["process-step", "concept-card"].includes(child.tag))
        .map((child, i) => ({
          id: `role-${i + 1}`,
          label: clean(child.attributes.title || ""),
          detail: firstSentence(paragraph(child)),
          explanation: paragraph(child),
        }))
        .filter(
          (pair) => pair.label && pair.detail && pair.detail.length < 600,
        );
      if (
        pairs.length < 2 ||
        pairs.length > 8 ||
        new Set(pairs.map((p) => p.label)).size !== pairs.length ||
        new Set(pairs.map((p) => p.detail)).size !== pairs.length
      )
        return null;
      return {
        id: `${step.id}-roles-${index + 1}`,
        kind: "match",
        title: "Give each part its job",
        context: step.summary,
        recap: true,
        prompt:
          "Match each part to its responsibility.",
        pairs,
        hint: pairs.map((p) => `${p.label}: ${p.detail}`).join("\n\n"),
        explanation:
          "Each part has a distinct responsibility. Keeping these boundaries clear helps you find the place to change when the system behaves unexpectedly.",
      };
    })
    .filter(Boolean);
  if (roleSets.length)
    groups.push({ id: `${step.id}-roles`, variants: roleSets });
  // Every source question remains in the rotation, with stable identity and its
  // original explanation. These are source-derived, not new authored variants.
  const decisions = Array.from(
    { length: Math.min(3, questions.length) },
    (_, group) => ({
      id: `${step.id}-decision-${group + 1}`,
      variants: questions
        .filter((_, index) => index % Math.min(3, questions.length) === group)
        .map((q) => ({
          id: q.id,
          kind: "choice",
          title: "Make the decision",
          context: step.summary,
        recap: true,
          prompt: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          optionFeedback:
            q.optionFeedback?.length === q.options.length
              ? q.optionFeedback
              : q.options.map(() => q.explanation),
          hint: q.explanation,
        })),
    }),
  );
  return {
    models,
    pack: {
      version: 1,
      source: { lessonPath: step.lessonPath, type: "lesson-derived" },
      groups: [...groups, ...decisions],
    },
  };
}
