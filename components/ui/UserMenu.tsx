"use client";
import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import AppGlyph from '@/components/ui/AppGlyph';
import GlobalSearch from '@/components/ui/GlobalSearch';
import ThemeToggle, { useThemePreference } from '@/components/ui/ThemeToggle';
import StreakIndicator from '@/components/StreakIndicator';
import SignInModal from '@/components/ui/SignInModal';
import { useAuth } from '@/hooks/useAuth';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { useFocusManagement } from '@/hooks/useFocusManagement';
import { trackAuthAction } from '@/lib/firebase';

export default function UserMenu() {
  const [open, setOpen] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const { user, isAuthenticated, isAnonymous, isAdmin, signIn, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [menuImageError, setMenuImageError] = useState(false);
  const { isDark, toggleTheme } = useThemePreference();

  const { saveFocus, restoreFocus, trapFocus } = useFocusManagement();
  
  const navigationItems = [
    { id: 'achievements' as const, label: 'Achievements', href: '/achievements' as const },
    { id: 'settings' as const, label: 'Settings', href: '/settings' as const },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin Dashboard', href: '/admin' as const }] : []),
  ];
  
  const allMenuItems = [
    ...navigationItems,
    { id: 'theme' as const, label: 'Theme' },
    { id: 'auth' as const, label: isAuthenticated ? 'Sign out' : 'Sign in' },
  ];

  const closeMenu = useCallback(() => {
    setOpen(false);
    setSelectedIndex(0);
    restoreFocus();
  }, [restoreFocus]);

  useKeyboardNavigation({
    isOpen: open,
    onClose: closeMenu,
    onNext: () => setSelectedIndex(prev => (prev + 1) % allMenuItems.length),
    onPrevious: () => setSelectedIndex(prev => (prev - 1 + allMenuItems.length) % allMenuItems.length),
    onSelect: () => {
      const currentItem = allMenuItems[selectedIndex];
      if (currentItem.id === 'auth') {
        if (isAuthenticated) {
          handleSignOut();
        } else {
          handleSignIn();
        }
      } else if (currentItem.id === 'theme') {
        toggleTheme();
      } else {
        // Navigation will be handled by Link component
        closeMenu();
      }
    }
  });
  
  // Get a working image URL
  const getWorkingImageUrl = (photoURL: string) => {
    // Try different size parameters that might work better
    const variants = [
      photoURL.replace(/=s\d+-c$/, '=s32-c'),
      photoURL.replace(/=s\d+-c$/, '=s48-c'),
      photoURL.replace(/=s\d+-c$/, ''),
      photoURL.split('=')[0]
    ];
    return variants[0]; // Start with smallest size
  };

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [closeMenu]);

  // Set up focus trap when menu opens
  useEffect(() => {
    if (open && ref.current) {
      saveFocus();
      const cleanup = trapFocus(ref.current);
      return cleanup;
    }
  }, [open, saveFocus, trapFocus]);

  // Reset image errors when user changes
  useEffect(() => {
    setImageError(false);
    setMenuImageError(false);
    
    // Debug user photo URL
    if (user?.photoURL) {
      
    }
  }, [user?.uid, user?.photoURL, isAuthenticated]);

  const handleSignIn = () => {
    closeMenu();
    setShowSignInModal(true);
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
      // Track analytics event
      trackAuthAction('logout', 'google');
      closeMenu();
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if we're on an admin page
  const isAdminPage = pathname.startsWith('/admin');
  const isWhiteboard = pathname.startsWith('/whiteboard');

  return (
    <div ref={ref} className="relative flex items-center gap-3">
      {!isAdminPage && !isWhiteboard && <GlobalSearch />}
      {!isAdminPage && !isWhiteboard && <StreakIndicator />}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={isAuthenticated ? `User menu for ${user?.displayName || 'user'}` : 'User menu'}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse') event.preventDefault();
        }}
        onClick={() => setOpen(v => !v)}
        tabIndex={isWhiteboard ? -1 : 0}
        className="h-9 w-9 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card grid place-items-center overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 dark:focus-visible:ring-offset-neutral-950"
      >
        {isAuthenticated && user?.photoURL && !imageError ? (
          <Image
            src={getWorkingImageUrl(user.photoURL)} 
            alt="Profile" 
            width={36}
            height={36}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => {
              console.log('Header image failed to load:', user.photoURL ? getWorkingImageUrl(user.photoURL) : 'no photo URL');
              setImageError(true);
            }}
            onLoad={() => {}}
          />
        ) : (
          <AppGlyph size={16} />
        )}
      </button>
      {open && (
        <div 
          role="menu" 
          aria-label="User menu"
          className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-2 z-[100]"
        >
          {/* User info section */}
          {isAuthenticated && user && (
            <>
              <div className="flex items-center gap-3 px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 mb-2" role="presentation">
                {user.photoURL && !menuImageError ? (
          <Image
            src={getWorkingImageUrl(user.photoURL)}
            alt=""
            role="presentation"
            width={32}
            height={32}
            className="w-8 h-8 rounded-full object-cover"
            referrerPolicy="no-referrer"
                    onError={() => {
                      console.log('Menu image failed to load:', user.photoURL ? getWorkingImageUrl(user.photoURL) : 'no photo URL');
                      setMenuImageError(true);
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center" role="presentation">
                    <AppGlyph size={12} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                    {user.displayName || 'User'}
                  </p>
                  {user.email && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Navigation items */}
          {allMenuItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            const baseClassName = "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500";
            
            if (item.id === 'theme') {
              return (
                <ThemeToggle
                  key={item.id}
                  isDark={isDark}
                  isSelected={isSelected}
                  onToggle={toggleTheme}
                />
              );
            } else if (item.id === 'auth') {
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  tabIndex={isSelected ? 0 : -1}
                  aria-current={isSelected ? 'true' : undefined}
                  onClick={isAuthenticated ? handleSignOut : handleSignIn}
                  disabled={isLoading}
                  className={`${baseClassName} w-full text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100/70 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected ? 'bg-neutral-100/70 dark:bg-neutral-800' : ''
                  }`}
                >
                  {isAuthenticated ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  <span>{isLoading ? (isAuthenticated ? 'Signing out...' : 'Signing in...') : item.label}</span>
                </button>
              );
            } else {
              const navItem = navigationItems.find(nav => nav.id === item.id)!;
              return (
                <Link
                  key={item.id}
                  href={navItem.href}
                  role="menuitem"
                  tabIndex={isSelected ? 0 : -1}
                  aria-current={isSelected ? 'true' : undefined}
                  className={`${baseClassName} ${
                    item.id === 'admin' 
                      ? 'text-orange-700 dark:text-orange-400 hover:bg-orange-100/70 dark:hover:bg-orange-900/20' 
                      : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100/70 dark:hover:bg-neutral-800'
                  } ${
                    isSelected ? (item.id === 'admin' ? 'bg-orange-100/70 dark:bg-orange-900/20' : 'bg-neutral-100/70 dark:bg-neutral-800') : ''
                  }`}
                  onClick={closeMenu}
                >
                  {item.id === 'achievements' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M6 9H4.5a2.5 2.5 0 0 0 0 5H6m0-5v5m0-5h6m-6 5h6m0-5a2.5 2.5 0 0 1 0 5m0-5v5m0 0h1.5a2.5 2.5 0 0 1 0 5H18V9h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : item.id === 'admin' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M3 3h18v18H3V3zm16 2H5v14h14V5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M12 8a4 4 0 100 8 4 4 0 000-8zm8.94 4a7.97 7.97 0 00-.3-2l2.07-1.6-2-3.46-2.47 1a8.06 8.06 0 00-3.48-2.02l-.37-2.62H9.61l-.37 2.62A8.06 8.06 0 005.76 5.9l-2.47-1-2 3.46 2.07 1.6a7.97 7.97 0 000 4l-2.07 1.6 2 3.46 2.47-1a8.06 8.06 0 003.48 2.02l.37 2.62h4.28l.37-2.62a8.06 8.06 0 003.48-2.02l2.47 1 2-3.46-2.07-1.6c.2-.65.3-1.32.3-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {item.label}
                </Link>
              );
            }
          })}
        </div>
      )}

      <SignInModal isOpen={showSignInModal} onClose={() => setShowSignInModal(false)} />
    </div>
  );
}
