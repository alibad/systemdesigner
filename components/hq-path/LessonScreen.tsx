import { Inter } from "next/font/google";
import { Sparkles } from "lucide-react";
import LearningLab from "@/components/learning/LearningLab";
import sessions from "@/content/learning/sessions.json";

type Session = { title: string; minutes: number; concept: string; summary: string };
const first = (sessions as unknown as Record<string, Session>)["request-journey"];
// Same font options as the root layout, so the lesson inside the frame looks exactly like the app.
const inter = Inter({ subsets: ["latin"], display: "swap" });

/**
 * The first lesson of the daily path, live: the same header, words and "Try the idea" lab
 * a learner sees on day 1, inside the family's browser frame.
 */
export default function LessonScreen() {
  return (
    <div className="sdp-lesson-wrap">
      <span className="sdp-sticker" aria-hidden="true">
        Day 1 · try it
      </span>
      <div className="hqp-screen sdp-lesson">
        <div className="hqp-chrome">
          <i />
          <i />
          <i />
          <span className="sdp-url">systemdesigner.net/learn</span>
        </div>
        <div className={`sdp-lesson-body ${inter.className}`}>
          <p className="learning-eyebrow sdp-lesson-eyebrow">
            <Sparkles aria-hidden className="h-4 w-4" /> {first.minutes}-minute practice
          </p>
          <p className="sdp-lesson-title">{first.title}</p>
          <div className="sdp-lesson-bar" aria-hidden="true">
            <span />
          </div>
          <p className="sdp-lesson-concept">{first.concept}</p>
          <p className="sdp-lesson-summary">{first.summary}</p>
          <LearningLab kind="request" />
        </div>
      </div>
    </div>
  );
}
