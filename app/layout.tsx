import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { FeedbackProvider } from '@/contexts/FeedbackContext';
import { StorageProvider } from '@/contexts/StorageContext';
import { GamificationProvider } from '@/contexts/GamificationContext';
import { ScreenReaderProvider } from '@/components/accessibility/ScreenReaderAnnouncements';
import SkipLinks from '@/components/accessibility/SkipLinks';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { LearningPlanProvider } from '@/contexts/LearningPlanContext';
import { ToastProvider } from '@/components/ui/toast';
import { WhiteboardProvider } from '@/contexts/WhiteboardContext';
import Script from 'next/script';
import { cookies } from 'next/headers';
import Analytics from '@/components/Analytics';
import ConditionalLayout from '@/components/ConditionalLayout';

export const metadata: Metadata = {
  title: {
    default: 'System Designer - Learn System Design & Software Architecture',
    template: '%s | System Designer',
  },
  description: 'Master system design with interactive lessons, quizzes, and real-world case studies. Learn distributed systems, databases, caching, and more for tech interviews and career growth.',
  keywords: ['system design', 'software architecture', 'tech interviews', 'distributed systems', 'database design', 'scalability', 'microservices', 'engineering', 'learning', 'system design interview'],
  authors: [{ name: 'System Designer Team' }],
  creator: 'System Designer',
  publisher: 'System Designer',
  metadataBase: new URL('https://systemdesigner.net'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://systemdesigner.net',
    siteName: 'System Designer',
    title: 'System Designer - Learn System Design & Software Architecture',
    description: 'Master system design with interactive lessons, quizzes, and real-world case studies. Learn distributed systems, databases, caching, and more.',
    images: [
      {
        url: '/icons/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'System Designer - Interactive System Design Learning Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'System Designer - Learn System Design & Software Architecture',
    description: 'Master system design with interactive lessons, quizzes, and real-world case studies.',
    images: ['/icons/icon-512x512.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add your verification codes here when you have them
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'System Designer',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'System Designer',
    'application-name': 'System Designer',
    'msapplication-TileColor': '#6366f1',
    'theme-color': '#6366f1',
  },
};

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = cookies().get('theme')?.value;
  const isDark = theme ? theme === 'dark' : undefined;
  return (
    <html lang="en" className={isDark ? 'dark' : undefined} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark light" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <link rel="icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180x180.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icons/apple-touch-icon-120x120.png" />
        <link rel="apple-touch-icon" sizes="76x76" href="/icons/apple-touch-icon-76x76.png" />
      </head>
      <body className={`${inter.className} min-h-screen text-gray-900 dark:text-neutral-100 antialiased dark:bg-neutral-950`} suppressHydrationWarning> 
        <ScreenReaderProvider>
        <FeedbackProvider>
        <StorageProvider>
        <GamificationProvider>
        <NavigationProvider>
        <LearningPlanProvider>
        <WhiteboardProvider>
        <ToastProvider>
        
        {/* Google Analytics tracking */}
        <Analytics />
        
        {/* Skip links for screen readers and keyboard users */}
        <SkipLinks />
        {/* Ensure theme is applied before paint to prevent flash */}
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function(){
            try {
              var root = document.documentElement;
              var cookieMatch = document.cookie.match(/(?:^|; )theme=(dark|light)/);
              var cookieTheme = cookieMatch && cookieMatch[1];
              var stored = localStorage.getItem('theme');
              var prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
              var isDark = cookieTheme ? cookieTheme === 'dark' : (stored ? stored === 'dark' : prefers);
              if (isDark) {
                root.classList.add('dark');
                root.style.backgroundColor = '#0a0a0a';
                root.style.colorScheme = 'dark';
              } else {
                root.classList.remove('dark');
                root.style.backgroundColor = '#fafafa';
                root.style.colorScheme = 'light';
              }
            } catch (e) {}
          })();
        `}</Script>
        <ConditionalLayout>
          {children}
        </ConditionalLayout>
        </ToastProvider>
        </WhiteboardProvider>
        </LearningPlanProvider>
        </NavigationProvider>
        </GamificationProvider>
        </StorageProvider>
        </FeedbackProvider>
        </ScreenReaderProvider>
      </body>
    </html>
  );
}


