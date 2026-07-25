'use client';

import Link from 'next/link';
import { useState } from 'react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <nav className="w-full px-6 lg:px-12">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="6" cy="6" r="2" stroke="#0ea5e9" strokeWidth="1.8" />
              <circle cx="18" cy="6" r="2" stroke="#0ea5e9" strokeWidth="1.8" />
              <circle cx="12" cy="18" r="2" stroke="#0ea5e9" strokeWidth="1.8" />
              <path d="M8 7.5 L12 16 M16 7.5 L12 16" stroke="#0ea5e9" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M8 6h8" stroke="#0ea5e9" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              System Designer
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href={"/features" as any} className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">
              Features
            </Link>
            <Link href={"/pricing" as any} className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">
              Pricing
            </Link>
            <Link href={"/about" as any} className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">
              About
            </Link>
            <Link href={`${APP_URL}/login` as any} className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">
              Login
            </Link>
            <Link
              href={`${APP_URL}/signup` as any}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Start Free
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex flex-col space-y-4">
              <Link href={"/features" as any} className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">
                Features
              </Link>
              <Link href={"/pricing" as any} className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">
                Pricing
              </Link>
              <Link href={"/about" as any} className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">
                About
              </Link>
              <Link href={`${APP_URL}/login` as any} className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">
                Login
              </Link>
              <Link
                href={`${APP_URL}/signup` as any}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-center transition-colors"
              >
                Start Free
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
