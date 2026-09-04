"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import NavBar from "@/components/ui/NavBar";
import UserMenu from "@/components/ui/UserMenu";
import SideNav from "@/components/ui/SideNav";
import ControlsWrapper from "@/components/ControlsWrapper";
import AdminHeaderNotifications from "@/components/admin/AdminHeaderNotifications";
import TextSelectionFeedback from "@/components/TextSelectionFeedback";
import GamificationDisplay from "@/components/GamificationDisplay";
import SignupNudgeProvider from "@/components/SignupNudgeProvider";

interface ConditionalLayoutProps {
  children: ReactNode;
}

export default function ConditionalLayout({
  children,
}: ConditionalLayoutProps) {
  const pathname = usePathname();
  const isSharedWhiteboard = pathname.startsWith("/whiteboard/share/");
  const isAdminWhiteboardView = pathname.startsWith("/admin/whiteboard/");
  const isWhiteboardEditor =
    pathname === "/whiteboard" || pathname.startsWith("/whiteboard?");

  if (pathname === "/learn") {
    return (
      <div className="learning-page min-h-screen bg-[#fcfcf9] dark:bg-neutral-950">
        <header
          id="side-nav"
          className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6"
        >
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <Image
              src="/icons/icon-192x192.png"
              alt=""
              width={32}
              height={32}
              priority
              unoptimized
              className="h-8 w-8 shrink-0"
            />
            System Designer
          </Link>
          <div className="flex shrink-0 items-center gap-4">
            <Link
              href="/fundamentals"
              className="text-sm text-neutral-500 hover:text-emerald-700"
            >
              Library
            </Link>
            <div id="user-menu">
              <UserMenu compact />
            </div>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-6xl px-4 outline-none sm:px-6"
        >
          {children}
        </main>
      </div>
    );
  }

  if (isSharedWhiteboard || isAdminWhiteboardView) {
    // Minimal layout for shared whiteboards and admin whiteboard viewer
    return <div className="relative w-full min-h-screen">{children}</div>;
  }

  if (isWhiteboardEditor) {
    // Full-width layout for whiteboard editor (shifts with nav like other pages)
    return (
      <div className="relative w-full min-h-screen flex flex-col">
        {/* Mobile header */}
        <div className="flex items-center justify-between p-4 lg:hidden border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 sticky top-0 z-40 shadow-sm">
          <NavBar />
          <div className="flex items-center">
            <AdminHeaderNotifications />
            <div id="user-menu" className="ml-2">
              <UserMenu />
            </div>
          </div>
        </div>

        {/* Desktop user menu and notifications (right) */}
        <div className="hidden lg:flex items-center fixed top-3 right-3 z-50 pointer-events-auto">
          <AdminHeaderNotifications />
          <div id="user-menu" className="ml-3">
            <UserMenu />
          </div>
        </div>
        <div
          className="hidden lg:block fixed left-0 top-0 z-40 pt-2 pl-0"
          id="side-nav"
        >
          <SideNav />
        </div>

        {/* Full-width main content for whiteboard with content-shell for nav shifting */}
        <div className="flex-1 content-shell">
          <main id="main-content" tabIndex={-1} className="h-full">
            {children}
          </main>
        </div>

        {/* Feedback and theme controls in bottom-right */}
        <ControlsWrapper />

        {/* Text selection feedback intentionally omitted on whiteboard editor */}

        {/* Gamification notifications */}
        <GamificationDisplay />

        {/* Signup nudge modal */}
        <SignupNudgeProvider />
      </div>
    );
  }

  // Full app layout for regular pages
  return (
    <div className="relative w-full min-h-screen flex flex-col">
      {/* Mobile header */}
      <div className="flex items-center justify-between p-4 lg:hidden border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 sticky top-0 z-40 shadow-sm">
        <NavBar />
        <div className="flex items-center">
          <AdminHeaderNotifications />
          <div id="user-menu" className="ml-2">
            <UserMenu />
          </div>
        </div>
      </div>

      {/* Desktop user menu and notifications (right) */}
      <div className="hidden lg:flex items-center fixed top-3 right-3 z-50 pointer-events-auto">
        <AdminHeaderNotifications />
        <div id="user-menu" className="ml-3">
          <UserMenu />
        </div>
      </div>
      <div
        className="hidden lg:block fixed left-0 top-0 z-40 pt-2 pl-0"
        id="side-nav"
      >
        <SideNav />
      </div>

      {/* Main content */}
      <div className="flex-1 py-2 content-shell">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-8">
          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 bg-transparent focus:outline-none lg:pt-16"
          >
            {children}
          </main>
        </div>
      </div>

      {/* Feedback and theme controls in bottom-right */}
      <ControlsWrapper />

      {/* Text selection feedback */}
      <TextSelectionFeedback />

      {/* Gamification notifications */}
      <GamificationDisplay />

      {/* Signup nudge modal */}
      <SignupNudgeProvider />
    </div>
  );
}
