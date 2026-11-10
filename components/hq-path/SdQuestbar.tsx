"use client";

import { useEffect } from "react";
import { HqQuestbar } from "./hq-path";
import { syncSiteTheme } from "./path-theme";

const LINKS = [
  { label: "Daily path", href: "/learn" },
  { label: "Library", href: "/fundamentals" },
  { label: "Case studies", href: "/case-studies" },
  { label: "Quizzes", href: "/quiz" },
];

/** Aligns data-theme with the site's .dark class (also after client-side navigation). Render it before the questbar. */
function ThemeSync() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = root.classList.contains("dark") ? "night" : "day";
  }, []);
  return null;
}

export default function SdQuestbar() {
  return (
    <>
      <ThemeSync />
      <HqQuestbar
        product="System Designer"
        logo="/icons/icon-192x192.png"
        href="/path"
        territory="learning"
        links={LINKS}
        cta={{ label: "Start learning", href: "/learn" }}
        onTheme={syncSiteTheme}
      />
    </>
  );
}
