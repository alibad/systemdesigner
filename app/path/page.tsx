import { readFile } from "fs/promises";
import type { Route } from "next";
import Link from "next/link";
import { join } from "path";
import { HqFamilyFooter, HqHero, HqPhone, HqScreen, HqStones, HqSunset } from "@/components/hq-path/hq-path";
import LessonScreen from "@/components/hq-path/LessonScreen";
import SdQuestbar from "@/components/hq-path/SdQuestbar";
import sessions from "@/content/learning/sessions.json";
import { CONTENT_REGISTRY, type ContentNode } from "@/lib/content-registry";
import { ALL_STEPS, LEARNING_TRACKS } from "@/lib/learning-path";

// Every number on this page is counted from the site's own content when the page renders.

const COURSE_SHOTS: Record<string, { src: string; alt: string }> = {
  design: { src: "/hq-path/course-design.jpg", alt: "System design practice: trace a web request from browser to database" },
  coding: { src: "/hq-path/course-coding.jpg", alt: "Coding practice: write serversNeeded in JavaScript, then run the tests" },
  genai: { src: "/hq-path/course-genai.jpg", alt: "Generative AI lesson: what is a large language model?" },
  ml: { src: "/hq-path/course-ml.jpg", alt: "Machine learning lesson: what is machine learning?" },
};

const SHELF: { section: ContentNode["section"]; label: string; href: Route }[] = [
  { section: "fundamentals", label: "Fundamentals", href: "/fundamentals" },
  { section: "technology", label: "Technology", href: "/technology" },
  { section: "genai", label: "GenAI systems", href: "/genai" },
  { section: "ml-systems", label: "ML systems", href: "/ml-systems" },
  { section: "case-studies", label: "Case studies", href: "/case-studies" },
  { section: "practice", label: "Interview questions", href: "/practice" },
  { section: "reference", label: "Reference", href: "/reference" },
  { section: "tools", label: "Interactive tools", href: "/tools" },
];

async function quizCounts() {
  const bank = JSON.parse(await readFile(join(process.cwd(), "lib", "quiz-bank", "all-quizzes.json"), "utf8")) as Record<string, { questions: unknown[] }>;
  const quizzes = Object.values(bank);
  return { quizzes: quizzes.length, questions: quizzes.reduce((n, quiz) => n + quiz.questions.length, 0) };
}

const n = (value: number) => value.toLocaleString("en-US");

export default async function PathHome() {
  const active = CONTENT_REGISTRY.filter((node) => node.status === "active");
  const count = (section: ContentNode["section"]) => active.filter((node) => node.section === section).length;
  const { quizzes, questions } = await quizCounts();
  const minutes = Object.values(sessions as unknown as Record<string, { minutes: number }>).map((s) => s.minutes);

  return (
    <>
      <SdQuestbar />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <HqHero
          territory="learning"
          eyebrow="System design · coding · GenAI · ML"
          title={
            <>
              A little practice.
              <br />A better <em>engineer.</em>
            </>
          }
          lede="Build a daily habit with bite-sized system design lessons and hands-on coding. Learn a concept, put it into practice, take the next step."
          actions={
            <>
              <Link className="hqp-btn hqp-btn-solid" href="/learn">
                Start your daily path <span aria-hidden="true">→</span>
              </Link>
              <Link className="hqp-btn hqp-btn-ghost" href="/fundamentals">
                Browse the library
              </Link>
            </>
          }
          art={<LessonScreen />}
        >
          <p className="sdp-note">No account needed to start. Sign in to sync across devices.</p>
        </HqHero>

        <section className="hqp-section sdp-how" aria-labelledby="how-title">
          <div className="hqp-inner">
            <div className="hqp-head">
              <div>
                <p className="hqp-eyebrow">How it works</p>
                <h2 id="how-title" className="hqp-display">
                  Learn it, try it, <em>keep it.</em>
                </h2>
              </div>
              <p className="hqp-lede">
                Each session is one short stop on the path: {Math.min(...minutes)} to {Math.max(...minutes)} minutes.
              </p>
            </div>
            <HqStones
              steps={[
                { title: "Learn a concept", text: "A short lesson with a picture you can play with, like the one above." },
                { title: "Put it into practice", text: "Put the steps in order, answer the checks, and write code until the tests pass." },
                { title: "Take the next step", text: "Each session builds on the last. Mistakes come back for review sooner." },
              ]}
            />
          </div>
        </section>

        <section className="hqp-section hqp-tint" aria-labelledby="courses-title">
          <div className="hqp-inner">
            <div className="hqp-head">
              <div>
                <p className="hqp-eyebrow">
                  {LEARNING_TRACKS.length} courses · {n(ALL_STEPS.length)} sessions
                </p>
                <h2 id="courses-title" className="hqp-display">
                  Pick your <em>direction.</em>
                </h2>
              </div>
              <p className="hqp-lede">Start at the beginning, or take the placement test and skip what you know.</p>
            </div>
            <div className="hqp-cards sdp-courses">
              {LEARNING_TRACKS.map((course) => {
                const shot = COURSE_SHOTS[course.id];
                return (
                  <Link key={course.id} className="hqp-card" href="/learn">
                    {shot && (
                      <div className="hqp-shot">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={shot.src} alt={shot.alt} loading="lazy" width={800} height={500} />
                      </div>
                    )}
                    <div className="hqp-body">
                      <h3>{course.title}</h3>
                      <p>{course.subtitle}</p>
                      <p className="sdp-meta">
                        {course.units.length} units · {course.steps.length} sessions
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="hqp-section sdp-habit" aria-labelledby="habit-title">
          <div className="hqp-inner sdp-split">
            <div className="sdp-split-art">
              <div className="sdp-desk">
                <HqScreen src="/hq-path/daily-courses.jpg" alt="The daily path on a computer: up next, today's goal, your week and your progress in the course" />
              </div>
              <div className="sdp-pocket">
                <HqPhone src="/hq-path/daily-phone.jpg" alt="The daily path on a phone: start here with How a web request works, then the next sessions" />
              </div>
            </div>
            <div>
              <p className="hqp-eyebrow">The daily path</p>
              <h2 id="habit-title" className="hqp-display">
                A little progress,
                <br />
                <em>every day.</em>
              </h2>
              <ul className="sdp-points">
                <li>
                  <b>Set a daily goal.</b> One session a day is enough to keep moving.
                </li>
                <li>
                  <b>Keep your week.</b> A streak and points show the habit forming.
                </li>
                <li>
                  <b>Review on a schedule.</b> Mistakes return sooner. Successful recall earns longer gaps.
                </li>
              </ul>
              <div className="hqp-ctas">
                <Link className="hqp-btn hqp-btn-solid" href="/learn">
                  Start day 1 <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="hqp-section sdp-library" aria-labelledby="library-title">
          <div className="hqp-inner">
            <div className="hqp-head">
              <div>
                <p className="hqp-eyebrow">The library</p>
                <h2 id="library-title" className="hqp-display">
                  Go deeper <em>any time.</em>
                </h2>
              </div>
              <p className="hqp-lede">
                Every session links to a full lesson. {n(active.length)} pages in all, plus {n(quizzes)} quizzes with {n(questions)} questions.
              </p>
            </div>
            <ul className="sdp-shelf">
              {SHELF.map((item) => (
                <li key={item.section}>
                  <Link href={item.href}>
                    <b>{count(item.section)}</b>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="hqp-section sdp-close" aria-labelledby="close-title">
          <div className="hqp-inner">
            <p className="hqp-eyebrow">The point of it all</p>
            <h2 id="close-title" className="hqp-quote">
              Great engineering, with or without AI assistance, still needs engineering <em>judgment.</em>
            </h2>
            <p className="hqp-lede">Learn the trade-offs, one short session at a time.</p>
            <div className="hqp-ctas">
              <Link className="hqp-btn hqp-btn-ember" href="/learn">
                Start your daily path <span aria-hidden="true">→</span>
              </Link>
              <Link className="hqp-btn hqp-btn-ghost" href="/fundamentals">
                Browse the library
              </Link>
            </div>
          </div>
        </section>
      </main>
      <HqSunset />
      <HqFamilyFooter
        current="System Designer"
        territory="learning"
        extra={[
          { label: "Daily learning path", href: "/learn" },
          { label: "Library", href: "/fundamentals" },
          { label: "Knowledge quizzes", href: "/quiz" },
        ]}
      />
    </>
  );
}
