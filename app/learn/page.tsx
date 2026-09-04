import type { Metadata } from "next";
import DailyLearningPath from "@/components/learning/DailyLearningPath";

export const metadata: Metadata = {
  title: "Learn System Design, Coding, GenAI & ML",
  description:
    "Build engineering skills across four courses with 43 units, lesson checkpoints, runnable JavaScript exercises, and spaced reviews.",
  alternates: { canonical: "/learn" },
};

export default function LearnPage() {
  return <DailyLearningPath />;
}
