import type { Metadata } from "next";
import DailyLearningPath from "@/components/learning/DailyLearningPath";

export const metadata: Metadata = {
  title: "Daily Learning Path",
  description:
    "Build a daily habit with short system design lessons, JavaScript coding exercises, skill reviews, and a clear path forward.",
  alternates: { canonical: "/learn" },
};

export default function LearnPage() {
  return <DailyLearningPath />;
}
