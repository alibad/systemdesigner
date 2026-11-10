import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/components/hq-path/hq-path.css";
import "@/components/hq-path/system-designer-path.css";
import { PATH_THEME_SCRIPT } from "@/components/hq-path/path-theme";

// Preview of the Human Quest "Path" homepage. Kept out of search until it replaces the home page.
export const metadata: Metadata = {
  title: "The Path preview",
  robots: { index: false, follow: false },
};

const FONTS =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..800;1,9..144,300..600&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";

export default function PathLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* `precedence` lets React hoist the font stylesheet into <head>. */}
      <link rel="stylesheet" href={FONTS} {...({ precedence: "default" } as Record<string, string>)} />
      <script dangerouslySetInnerHTML={{ __html: PATH_THEME_SCRIPT }} />
      <div className="hqp-page sdp" data-hqp-t="learning">
        {children}
      </div>
    </>
  );
}
