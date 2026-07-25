"use client";
import { useEffect, useState } from 'react';
import { CONTENT_REGISTRY } from '@/lib/content-registry';

interface CacheStatus {
  totalPages: number;
  cachedPages: number;
  cacheSize: string;
  lastUpdated: string | null;
}

interface DownloadProgress {
  isDownloading: boolean;
  current: number;
  total: number;
  section: string;
}

export default function SettingsPage() {
  const [dark, setDark] = useState<boolean>(false);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({
    totalPages: 0,
    cachedPages: 0,
    cacheSize: '0 MB',
    lastUpdated: null,
  });
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    isDownloading: false,
    current: 0,
    total: 0,
    section: '',
  });
  const [offlineMode, setOfflineMode] = useState<boolean>(false);
  const [autoDownload, setAutoDownload] = useState<boolean>(false);

  // Theme management
  useEffect(() => {
    try {
      const isDark = document.documentElement.classList.contains('dark');
      setDark(isDark);
    } catch {}
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark'); else root.classList.remove('dark');
    try { 
      window.localStorage.setItem('sd:theme', dark ? 'dark' : 'light'); 
      // Also update cookie for SSR
      document.cookie = `theme=${dark ? 'dark' : 'light'}; path=/; max-age=31536000`;
    } catch {}
  }, [dark]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('sd:theme');
      if (saved) setDark(saved === 'dark');
      
      // Load offline preferences
      const offlinePref = window.localStorage.getItem('sd:offline-mode');
      const autoDlPref = window.localStorage.getItem('sd:auto-download');
      if (offlinePref) setOfflineMode(offlinePref === 'true');
      if (autoDlPref) setAutoDownload(autoDlPref === 'true');
    } catch {}
  }, []);

  // Check cache status
  useEffect(() => {
    checkCacheStatus();
  }, []);

  const checkCacheStatus = async () => {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        let totalSize = 0;
        let cachedUrls = new Set();

        for (const name of cacheNames) {
          const cache = await caches.open(name);
          const requests = await cache.keys();
          requests.forEach(req => {
            if (req.url.includes('/fundamentals/') || 
                req.url.includes('/genai/') || 
                req.url.includes('/ml-systems/') || 
                req.url.includes('/technology/')) {
              cachedUrls.add(req.url);
            }
          });
        }

        // Estimate cache size (rough approximation)
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          const usage = estimate.usage || 0;
          totalSize = Math.round(usage / (1024 * 1024)); // Convert to MB
        }

        const registry = CONTENT_REGISTRY;
        const totalPages = registry.length;

        setCacheStatus({
          totalPages,
          cachedPages: cachedUrls.size,
          cacheSize: `${totalSize} MB`,
          lastUpdated: window.localStorage.getItem('sd:cache-last-updated'),
        });
      } catch (error) {
        console.error('Failed to check cache status:', error);
      }
    }
  };

  const downloadSection = async (section: string) => {
    const registry = CONTENT_REGISTRY;
    const sectionContent = registry.filter(item => item.section === section);
    
    setDownloadProgress({
      isDownloading: true,
      current: 0,
      total: sectionContent.length,
      section,
    });

    for (let i = 0; i < sectionContent.length; i++) {
      try {
        await fetch(sectionContent[i].path);
        setDownloadProgress(prev => ({ ...prev, current: i + 1 }));
      } catch (error) {
        console.error(`Failed to cache ${sectionContent[i].path}:`, error);
      }
    }

    window.localStorage.setItem('sd:cache-last-updated', new Date().toISOString());
    setDownloadProgress({ isDownloading: false, current: 0, total: 0, section: '' });
    checkCacheStatus();
  };

  const downloadAllContent = async () => {
    const sections = ['fundamentals', 'genai', 'ml-systems', 'technology'];
    for (const section of sections) {
      await downloadSection(section);
    }
  };

  const clearCache = async () => {
    if ('caches' in window && confirm('Are you sure you want to clear all offline content?')) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      window.localStorage.removeItem('sd:cache-last-updated');
      checkCacheStatus();
    }
  };

  const handleOfflineModeToggle = () => {
    const newValue = !offlineMode;
    setOfflineMode(newValue);
    window.localStorage.setItem('sd:offline-mode', String(newValue));
  };

  const handleAutoDownloadToggle = () => {
    const newValue = !autoDownload;
    setAutoDownload(newValue);
    window.localStorage.setItem('sd:auto-download', String(newValue));
  };

  return (
    <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-300">Customize your learning experience and manage offline content</p>
      </div>
      
      {/* Appearance Section */}
      <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-card mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Appearance
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Theme</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-300">Choose your appearance preference</div>
            </div>
            <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
              <button
                onClick={() => setDark(false)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  !dark
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Light
                </span>
              </button>
              <button
                onClick={() => setDark(true)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  dark
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  Dark
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Offline & PWA Section */}
      <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-card mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Offline Learning
        </h2>
        
        {/* Cache Status */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-5 mb-4 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-5">
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 00-2 2v2a2 2 0 002 2m0 0h14m-14 0a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 01-2 2" />
                </svg>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Cached Content</div>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {cacheStatus.cachedPages}
                <span className="text-lg font-normal text-gray-500 dark:text-gray-400"> / {cacheStatus.totalPages}</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">pages available offline</div>
            </div>
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 4v12a1 1 0 001 1h8a1 1 0 001-1V8M7 8V6a1 1 0 011-1h8a1 1 0 011 1v2" />
                </svg>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Storage Used</div>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{cacheStatus.cacheSize}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {cacheStatus.lastUpdated ? `Updated ${new Date(cacheStatus.lastUpdated).toLocaleDateString()}` : 'Not cached yet'}
              </div>
            </div>
          </div>

          {/* Enhanced Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progress</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {Math.round((cacheStatus.cachedPages / Math.max(cacheStatus.totalPages, 1)) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
                style={{ width: `${(cacheStatus.cachedPages / Math.max(cacheStatus.totalPages, 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Download Progress */}
        {downloadProgress.isDownloading && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Downloading {downloadProgress.section}...</span>
              <span className="text-sm">{downloadProgress.current} / {downloadProgress.total}</span>
            </div>
            <div className="w-full bg-indigo-200 dark:bg-indigo-800 rounded-full h-2">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(downloadProgress.current / Math.max(downloadProgress.total, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Offline Options */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Offline Mode</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-300">Prefer cached content when available</div>
            </div>
            <button
              onClick={handleOfflineModeToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                offlineMode ? 'bg-indigo-600' : 'bg-neutral-200 dark:bg-neutral-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                offlineMode ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Auto-Download on WiFi</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-300">Automatically cache new content</div>
            </div>
            <button
              onClick={handleAutoDownloadToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                autoDownload ? 'bg-indigo-600' : 'bg-neutral-200 dark:bg-neutral-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                autoDownload ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>

        {/* Download Actions */}
        <div className="mt-6 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Download by Section</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => downloadSection('fundamentals')}
                disabled={downloadProgress.isDownloading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Fundamentals
              </button>
              <button
                onClick={() => downloadSection('genai')}
                disabled={downloadProgress.isDownloading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                GenAI Systems
              </button>
              <button
                onClick={() => downloadSection('ml-systems')}
                disabled={downloadProgress.isDownloading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                ML Systems
              </button>
              <button
                onClick={() => downloadSection('technology')}
                disabled={downloadProgress.isDownloading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                Technology
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={downloadAllContent}
              disabled={downloadProgress.isDownloading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download All Content
            </button>
            <button
              onClick={clearCache}
              disabled={downloadProgress.isDownloading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Cache
            </button>
          </div>
        </div>
      </div>

      {/* PWA Installation */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 p-6 shadow-card">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Install App
        </h2>
        <div className="space-y-4">
          <p className="text-sm text-indigo-700 dark:text-indigo-300">
            Install System Designer as a Progressive Web App for a native app experience with fast loading and offline access.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-4 border border-white/20 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                <div className="font-medium text-sm text-gray-900 dark:text-white">Desktop</div>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Look for the install icon in your browser's address bar (Chrome, Edge, Safari)
              </div>
            </div>
            <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-4 border border-white/20 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <div className="font-medium text-sm text-gray-900 dark:text-white">Mobile</div>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Use "Add to Home Screen" option from your browser menu (Safari, Chrome)
              </div>
            </div>
          </div>

          <div className="bg-white/40 dark:bg-gray-800/40 rounded-lg p-3 border border-white/30 dark:border-gray-700/30">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs text-gray-700 dark:text-gray-300">
                <strong>Benefits:</strong> Faster loading, offline access to downloaded content, native app feel, and reduced data usage
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}