"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV_GROUPS, getWhiteboardNavItems } from '@/components/ui/nav-config';
import { REFERENCE_NAV } from '@/components/reference/reference-nav-config';
import { FUNDAMENTALS_NAV } from '@/components/fundamentals/fundamentals-nav-config';
import { TECHNOLOGY_NAV } from '@/components/technology/technology-nav-config';
import { GENAI_NAV } from '@/components/genai/genai-nav-config';
import { ML_SYSTEMS_NAV } from '@/components/ml-systems/ml-systems-nav-config';
import { INTERVIEW_QUESTIONS_NAV } from '@/components/practice/interview-questions-nav-config';
import { CASE_STUDIES_NAV } from '@/components/case-studies/case-studies-nav-config';
import LearningPlansNav from '@/components/LearningPlansNav';
import { useProgressTracking } from '@/hooks/useProgressTracking';
import { useLearningPlanNavigation } from '@/hooks/useLearningPlanNavigation';
import { useWhiteboards } from '@/contexts/WhiteboardContext';

export default function SideNav() {
  const pathname = usePathname();
  const [isReferenceOpen, setIsReferenceOpen] = useState<boolean>(Boolean(pathname?.startsWith('/reference')));
  const [isFundamentalsOpen, setIsFundamentalsOpen] = useState<boolean>(Boolean(pathname?.startsWith('/fundamentals')));
  const [isGenAIOpen, setIsGenAIOpen] = useState<boolean>(Boolean(pathname?.startsWith('/genai')));
  const [isMLSystemsOpen, setIsMLSystemsOpen] = useState<boolean>(Boolean(pathname?.startsWith('/ml-systems')));
  const [isTechnologyOpen, setIsTechnologyOpen] = useState<boolean>(Boolean(pathname?.startsWith('/technology')));
  const [isInterviewQuestionsOpen, setIsInterviewQuestionsOpen] = useState<boolean>(Boolean(pathname?.startsWith('/practice')));
  const [isCaseStudiesOpen, setIsCaseStudiesOpen] = useState<boolean>(Boolean(pathname?.startsWith('/case-studies')));
  const [isDesignOpen, setIsDesignOpen] = useState<boolean>(Boolean(pathname?.startsWith('/tools') || pathname?.startsWith('/workshop') || pathname?.startsWith('/patterns')));
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState<boolean>(Boolean(pathname?.startsWith('/whiteboard')));
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Get learning plan navigation context
  const learningPlanNav = useLearningPlanNavigation(pathname || '');
  
  // Get user's whiteboards for dynamic navigation
  const { whiteboards } = useWhiteboards();

  // Add progress tracking for all learning categories
  const { isCompleted: isFundamentalsCompleted } = useProgressTracking('fundamentals');
  const { isCompleted: isTechnologyCompleted } = useProgressTracking('technology');
  const { isCompleted: isReferenceCompleted } = useProgressTracking('reference');
  const { isCompleted: isGenAICompleted } = useProgressTracking('genai');
  const { isCompleted: isMLSystemsCompleted } = useProgressTracking('ml-systems');
  const { isCompleted: isInterviewQuestionsCompleted } = useProgressTracking('practice');
  const { isCompleted: isCaseStudiesCompleted } = useProgressTracking('case-studies');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('sd:sidenav:collapsed');
      const shouldAutoCollapse = pathname === '/' || 
                                 pathname?.startsWith('/whiteboard') || 
                                 pathname?.startsWith('/projects/');
      
      if (saved === null) {
        setIsCollapsed(shouldAutoCollapse);
      } else {
        // If user has manually set preference, respect it unless on auto-collapse pages
        if (shouldAutoCollapse) {
          setIsCollapsed(true);
        } else {
          setIsCollapsed(saved === '1');
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    try {
      window.localStorage.setItem('sd:sidenav:collapsed', isCollapsed ? '1' : '0');
    } catch {}
  }, [isCollapsed]);

  // Reflect collapsed state into body class so layout can reclaim space
  useEffect(() => {
    const apply = () => {
      const isLg = window.matchMedia('(min-width: 1024px)').matches; // lg breakpoint
      if (!isLg) {
        document.body.classList.remove('nav-collapsed');
        return;
      }
      if (isCollapsed) document.body.classList.add('nav-collapsed');
      else document.body.classList.remove('nav-collapsed');
    };
    apply();
    const listener = () => apply();
    window.addEventListener('resize', listener);
    return () => window.removeEventListener('resize', listener);
  }, [isCollapsed]);

  return (
    <aside className="hidden lg:block">
      {isCollapsed ? (
        <div className="fixed left-2 top-2 z-40">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setIsCollapsed(false)}
            title="Open sidebar"
            className="w-9 h-9 grid place-items-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card hover:bg-indigo-50 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[20px] h-[20px]">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 6l6 6-6 6" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3 overflow-y-auto">
        <div className="flex items-center justify-between px-1 py-1">
          <Link href={"/" as any} className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
            System Designer
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Collapse navigation"
              onClick={() => setIsCollapsed(true)}
              title="Close sidebar"
              className="w-9 h-9 grid place-items-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card hover:bg-indigo-50 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[20px] h-[20px]">
                <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
              {/* Settings entry removed to keep profile menu as the single entry point */}
          </div>
        </div>
        <nav aria-label="Primary" className="mt-2 space-y-4">
          {/* Learning Plans Section */}
          {!learningPlanNav.isFromLearningPlan && <LearningPlansNav />}

          {/* Learning Plan Navigation */}
          {learningPlanNav.isFromLearningPlan && (
            <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-4">
              <div className="px-3 mb-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                  Learning Plan
                </div>
                <Link
                  href={`/learn/plan/${learningPlanNav.planSlug}` as any}
                  className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate"
                >
                  {learningPlanNav.planTitle || 'Custom Plan'}
                </Link>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {learningPlanNav.completedTopics} of {learningPlanNav.totalTopics} completed
                </div>
              </div>

              <div className="space-y-1">
                {learningPlanNav.items.map((item) => {
                  const isActive = pathname === item.path;
                  return (
                    <Link
                      key={item.contentId}
                      href={`${item.path}?fromLearningPlan=true&planTitle=${encodeURIComponent(learningPlanNav.planTitle || '')}&planSlug=${learningPlanNav.planSlug}&planId=${learningPlanNav.planId || ''}` as any}
                      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500 ${
                        isActive
                          ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 border border-indigo-200 dark:border-indigo-800'
                          : item.isCompleted
                          ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                          : item.isCurrent
                          ? 'text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/70 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {/* Sequential number */}
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium ${
                        item.isCompleted
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : item.isCurrent
                          ? 'bg-indigo-500 border-indigo-500 text-white'
                          : 'border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400'
                      }`}>
                        {item.isCompleted ? (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <span>{item.index}</span>
                        )}
                      </div>

                      {/* Title with section badge */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {item.title}
                        </div>
                        <div className={`text-xs mt-0.5 ${
                          item.section === 'genai' ? 'text-purple-600 dark:text-purple-400' :
                          item.section === 'technology' ? 'text-orange-600 dark:text-orange-400' :
                          item.section === 'fundamentals' ? 'text-blue-600 dark:text-blue-400' :
                          'text-neutral-500 dark:text-neutral-400'
                        }`}>
                          {item.section === 'genai' ? 'GenAI' :
                           item.section === 'technology' ? 'Technology' :
                           item.section === 'fundamentals' ? 'Fundamentals' :
                           item.section}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {!learningPlanNav.isFromLearningPlan && NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2 px-3">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
                  return (
                    <div key={item.href}>
                <div className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm transition focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500 ${
                  isActive
                    ? 'bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 shadow-sm'
                    : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100/70 dark:hover:bg-neutral-800'
                }`}>
                  <Link
                    href={item.href as any}
                    aria-current={isActive ? 'page' : undefined}
                    className="flex-1 inline-flex items-center gap-2"
                    onClick={() => {
                      if (item.href === '/reference') setIsReferenceOpen(v => !v);
                      if (item.href === '/fundamentals') setIsFundamentalsOpen(v => !v);
                      if (item.href === '/genai') setIsGenAIOpen(v => !v);
                      if (item.href === '/ml-systems') setIsMLSystemsOpen(v => !v);
                      if (item.href === '/technology') setIsTechnologyOpen(v => !v);
                      if (item.href === '/practice') setIsInterviewQuestionsOpen(v => !v);
                      if (item.href === '/case-studies') setIsCaseStudiesOpen(v => !v);
                      if (item.href === '/tools') setIsDesignOpen(v => !v);
                      if (item.href === '/whiteboard' || item.href === '/whiteboard/manage') setIsWhiteboardOpen(v => !v);
                    }}
                  >
                    {item.icon ? (
                      React.createElement(item.icon as any, { className: "h-4 w-4 text-neutral-500 dark:text-neutral-400" })
                    ) : null}
                    <span>{item.label}</span>
                  </Link>
                  {(item.href === '/reference' || item.href === '/fundamentals' || item.href === '/genai' || item.href === '/ml-systems' || item.href === '/technology' || item.href === '/practice' || item.href === '/case-studies' || item.href === '/whiteboard' || item.href === '/whiteboard/manage' || item.subItems) ? (
                    <button
                      type="button"
                      aria-label={(
                        item.href === '/reference' ? isReferenceOpen : 
                        item.href === '/fundamentals' ? isFundamentalsOpen :
                        item.href === '/genai' ? isGenAIOpen :
                        item.href === '/ml-systems' ? isMLSystemsOpen :
                        item.href === '/technology' ? isTechnologyOpen :
                        item.href === '/practice' ? isInterviewQuestionsOpen :
                        item.href === '/case-studies' ? isCaseStudiesOpen :
                        item.href === '/tools' ? isDesignOpen :
                        (item.href === '/whiteboard' || item.href === '/whiteboard/manage') ? isWhiteboardOpen : false
                      ) ? 'Collapse' : 'Expand'}
                      onClick={(e) => {
                        e.preventDefault();
                        if (item.href === '/reference') setIsReferenceOpen(v => !v);
                        else if (item.href === '/fundamentals') setIsFundamentalsOpen(v => !v);
                        else if (item.href === '/genai') setIsGenAIOpen(v => !v);
                        else if (item.href === '/ml-systems') setIsMLSystemsOpen(v => !v);
                        else if (item.href === '/technology') setIsTechnologyOpen(v => !v);
                        else if (item.href === '/practice') setIsInterviewQuestionsOpen(v => !v);
                        else if (item.href === '/case-studies') setIsCaseStudiesOpen(v => !v);
                        else if (item.href === '/tools') setIsDesignOpen(v => !v);
                        else if (item.href === '/whiteboard' || item.href === '/whiteboard/manage') setIsWhiteboardOpen(v => !v);
                      }}
                      className="ml-2 rounded p-1 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`${
                        item.href === '/reference' ? (isReferenceOpen ? 'rotate-90' : '') : 
                        item.href === '/fundamentals' ? (isFundamentalsOpen ? 'rotate-90' : '') :
                        item.href === '/genai' ? (isGenAIOpen ? 'rotate-90' : '') :
                        item.href === '/ml-systems' ? (isMLSystemsOpen ? 'rotate-90' : '') :
                        item.href === '/technology' ? (isTechnologyOpen ? 'rotate-90' : '') :
                        item.href === '/practice' ? (isInterviewQuestionsOpen ? 'rotate-90' : '') :
                        item.href === '/case-studies' ? (isCaseStudiesOpen ? 'rotate-90' : '') :
                        item.href === '/tools' ? (isDesignOpen ? 'rotate-90' : '') :
                        (item.href === '/whiteboard' || item.href === '/whiteboard/manage') ? (isWhiteboardOpen ? 'rotate-90' : '') : ''
                      } transition-transform`}>
                        <path d="M8 5l8 7-8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : null}
                </div>

                {item.href === '/reference' && isReferenceOpen ? (
                  <div className="mt-1 ml-2 pl-3 border-l border-neutral-200 dark:border-neutral-800 space-y-3">
                    {REFERENCE_NAV.map(group => (
                      <div key={group.title}>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">{group.title}</div>
                        <ul className="space-y-1">
                          {group.items.map(sub => {
                            const activeSub = pathname?.startsWith(sub.href);
                            // Extract lesson slug from href (/reference/lesson-slug -> lesson-slug)
                            const lessonSlug = sub.href.replace('/reference/', '');
                            const completed = isReferenceCompleted(lessonSlug);
                            
                            return (
                              <li key={sub.href}>
                                <Link
                                  href={sub.href as any}
                                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${activeSub ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/70 dark:hover:bg-neutral-800'}`}
                                  aria-current={activeSub ? 'page' : undefined}
                                >
                                  <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                                    completed 
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                                      : 'bg-neutral-200 dark:bg-neutral-700'
                                  }`}>
                                    {completed ? (
                                      <svg className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    ) : (
                                      <div className="w-1 h-1 bg-neutral-400 dark:bg-neutral-500 rounded-full"></div>
                                    )}
                                  </div>
                                  <span className="flex-1">{sub.label}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : item.href === '/fundamentals' && isFundamentalsOpen ? (
                  <div className="mt-1 ml-2 pl-3 border-l border-neutral-200 dark:border-neutral-800 space-y-3">
                    {FUNDAMENTALS_NAV.map(group => (
                      <div key={group.title}>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">{group.title}</div>
                        <ul className="space-y-1">
                          {group.items.map(sub => {
                            const activeSub = pathname?.startsWith(sub.href);
                            // Extract lesson slug from href (/fundamentals/lesson-slug -> lesson-slug)
                            const lessonSlug = sub.href.replace('/fundamentals/', '');
                            const completed = isFundamentalsCompleted(lessonSlug);
                            
                            return (
                              <li key={sub.href}>
                                <Link
                                  href={sub.href as any}
                                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${activeSub ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/70 dark:hover:bg-neutral-800'}`}
                                  aria-current={activeSub ? 'page' : undefined}
                                >
                                  <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                                    completed 
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                                      : 'bg-neutral-200 dark:bg-neutral-700'
                                  }`}>
                                    {completed ? (
                                      <svg className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    ) : (
                                      <div className="w-1 h-1 bg-neutral-400 dark:bg-neutral-500 rounded-full"></div>
                                    )}
                                  </div>
                                  <span className="flex-1">{sub.label}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : item.href === '/genai' && isGenAIOpen ? (
                  <div className="mt-1 ml-2 pl-3 border-l border-neutral-200 dark:border-neutral-800 space-y-3">
                    {GENAI_NAV.map(group => (
                      <div key={group.title}>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">{group.title}</div>
                        <ul className="space-y-1">
                          {group.items.map(sub => {
                            const activeSub = pathname?.startsWith(sub.href);
                            // Extract lesson slug from href (/genai/lesson-slug -> lesson-slug)
                            const lessonSlug = sub.href.replace('/genai/', '');
                            const completed = isGenAICompleted(lessonSlug);
                            
                            return (
                              <li key={sub.href}>
                                <Link
                                  href={sub.href as any}
                                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${activeSub ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/70 dark:hover:bg-neutral-800'}`}
                                  aria-current={activeSub ? 'page' : undefined}
                                >
                                  <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                                    completed 
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                                      : 'bg-neutral-200 dark:bg-neutral-700'
                                  }`}>
                                    {completed ? (
                                      <svg className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    ) : (
                                      <div className="w-1 h-1 bg-neutral-400 dark:bg-neutral-500 rounded-full"></div>
                                    )}
                                  </div>
                                  <span className="flex-1">{sub.label}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : item.href === '/ml-systems' && isMLSystemsOpen ? (
                  <div className="mt-1 ml-2 pl-3 border-l border-neutral-200 dark:border-neutral-800 space-y-3">
                    {ML_SYSTEMS_NAV.map(group => (
                      <div key={group.title}>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">{group.title}</div>
                        <ul className="space-y-1">
                          {group.items.map(sub => {
                            const activeSub = pathname?.startsWith(sub.href);
                            // Extract lesson slug from href (/ml-systems/lesson-slug -> lesson-slug)
                            const lessonSlug = sub.href.replace('/ml-systems/', '');
                            const completed = isMLSystemsCompleted(lessonSlug);
                            
                            return (
                              <li key={sub.href}>
                                <Link
                                  href={sub.href as any}
                                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${activeSub ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/70 dark:hover:bg-neutral-800'}`}
                                  aria-current={activeSub ? 'page' : undefined}
                                >
                                  <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                                    completed 
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                                      : 'bg-neutral-200 dark:bg-neutral-700'
                                  }`}>
                                    {completed ? (
                                      <svg className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    ) : (
                                      <div className="w-1 h-1 bg-neutral-400 dark:bg-neutral-500 rounded-full"></div>
                                    )}
                                  </div>
                                  <span className="flex-1">{sub.label}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : item.href === '/technology' && isTechnologyOpen ? (
                  <div className="mt-1 ml-2 pl-3 border-l border-neutral-200 dark:border-neutral-800 space-y-3">
                    {TECHNOLOGY_NAV.map(group => (
                      <div key={group.title}>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">{group.title}</div>
                        <ul className="space-y-1">
                          {group.items.map(sub => {
                            const activeSub = pathname?.startsWith(sub.href);
                            // Extract lesson slug from href (/technology/lesson-slug -> lesson-slug)
                            const lessonSlug = sub.href.replace('/technology/', '');
                            const completed = isTechnologyCompleted(lessonSlug);
                            
                            return (
                              <li key={sub.href}>
                                <Link
                                  href={sub.href as any}
                                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${activeSub ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/70 dark:hover:bg-neutral-800'}`}
                                  aria-current={activeSub ? 'page' : undefined}
                                >
                                  <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                                    completed 
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                                      : 'bg-neutral-200 dark:bg-neutral-700'
                                  }`}>
                                    {completed ? (
                                      <svg className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    ) : (
                                      <div className="w-1 h-1 bg-neutral-400 dark:bg-neutral-500 rounded-full"></div>
                                    )}
                                  </div>
                                  <span className="flex-1">{sub.label}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : item.href === '/practice' && isInterviewQuestionsOpen ? (
                  <div className="mt-1 ml-2 pl-3 border-l border-neutral-200 dark:border-neutral-800 space-y-3">
                    {/* Interview Questions */}
                    {INTERVIEW_QUESTIONS_NAV.map(group => (
                      <div key={group.title}>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">{group.title}</div>
                        <ul className="space-y-1">
                          {group.items.map(sub => {
                            const activeSub = pathname?.startsWith(sub.href);
                            // Extract lesson slug from href (/practice/lesson-slug -> lesson-slug)
                            const lessonSlug = sub.href.replace('/practice/', '');
                            const completed = isInterviewQuestionsCompleted(lessonSlug);

                            return (
                              <li key={`sidenav-practice-${sub.href}`}>
                                <Link
                                  href={sub.href as any}
                                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${activeSub ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/70 dark:hover:bg-neutral-800'}`}
                                  aria-current={activeSub ? 'page' : undefined}
                                >
                                  <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                                    completed 
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                                      : 'bg-neutral-200 dark:bg-neutral-700'
                                  }`}>
                                    {completed ? (
                                      <svg className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    ) : (
                                      <div className="w-1 h-1 bg-neutral-400 dark:bg-neutral-500 rounded-full"></div>
                                    )}
                                  </div>
                                  <span className="flex-1">{sub.label}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : item.href === '/case-studies' && isCaseStudiesOpen ? (
                  <div className="mt-1 ml-2 pl-3 border-l border-neutral-200 dark:border-neutral-800 space-y-3">
                    {CASE_STUDIES_NAV.map(group => (
                      <div key={group.title}>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">{group.title}</div>
                        <ul className="space-y-1">
                          {group.items.map(sub => {
                            const activeSub = pathname?.startsWith(sub.href);
                            // Extract lesson slug from href (/case-studies/lesson-slug -> lesson-slug)
                            const lessonSlug = sub.href.replace('/case-studies/', '');
                            const completed = isCaseStudiesCompleted(lessonSlug);
                            
                            return (
                              <li key={sub.href}>
                                <Link
                                  href={sub.href as any}
                                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${activeSub ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/70 dark:hover:bg-neutral-800'}`}
                                  aria-current={activeSub ? 'page' : undefined}
                                >
                                  <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                                    completed 
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                                      : 'bg-neutral-200 dark:bg-neutral-700'
                                  }`}>
                                    {completed ? (
                                      <svg className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    ) : (
                                      <div className="w-1 h-1 bg-neutral-400 dark:bg-neutral-500 rounded-full"></div>
                                    )}
                                  </div>
                                  <span className="flex-1">{sub.label}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (item.href === '/whiteboard' || item.href === '/whiteboard/manage') && isWhiteboardOpen ? (
                  <div className="mt-1 ml-2 pl-3 border-l border-neutral-200 dark:border-neutral-800 space-y-1">
                    {getWhiteboardNavItems(whiteboards).map(subItem => {
                      const isSubActive = pathname === subItem.href || (subItem.href !== '/' && pathname?.startsWith(subItem.href));
                      return subItem.label === '—' ? (
                        <div key="separator" className="border-t border-neutral-200 dark:border-neutral-700 my-2" />
                      ) : (
                        <Link
                          key={subItem.href}
                          href={subItem.href as any}
                          className={`block rounded px-2 py-1 text-sm ${isSubActive ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/70 dark:hover:bg-neutral-800'}`}
                          aria-current={isSubActive ? 'page' : undefined}
                        >
                          {subItem.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : item.subItems && (item.href === '/tools' && isDesignOpen) ? (
                  <div className="mt-1 ml-2 pl-3 border-l border-neutral-200 dark:border-neutral-800 space-y-1">
                    {item.subItems.map(subItem => {
                      const isSubActive = pathname === subItem.href || (subItem.href !== '/' && pathname?.startsWith(subItem.href));
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href as any}
                          className={`block rounded px-2 py-1 text-sm ${isSubActive ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/70 dark:hover:bg-neutral-800'}`}
                          aria-current={isSubActive ? 'page' : undefined}
                        >
                          {subItem.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    ))}
        </nav>
      </div>
      )}
    </aside>
  );
}


