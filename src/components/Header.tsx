import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Briefcase,
  Check,
  History,
  LogOut,
  Menu,
  Play,
  ShieldCheck,
  Trophy,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { usePlatform } from '../context/PlatformContext';
import { AppView } from '../types/math';
import { PlatformRoute } from '../types/platform';

interface HeaderProps {
  route: PlatformRoute;
  activeView: AppView;
  onNavigateRoute: (route: PlatformRoute, view?: AppView) => void;
}

export const Header: React.FC<HeaderProps> = ({
  route,
  activeView,
  onNavigateRoute,
}) => {
  const {
    user,
    displayName,
    isConfigured,
    authLoading,
    signInWithGoogle,
    updateName,
  } = useFirebase();
  const { roleSession, logoutRole, exitChildModeToParent } = usePlatform();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNameInput(displayName);
  }, [displayName]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setSavingName(true);
    await updateName(nameInput);
    setSavingName(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1600);
  };

  const go = (nextRoute: PlatformRoute, view?: AppView) => {
    setDrawerOpen(false);
    setMenuOpen(false);
    onNavigateRoute(nextRoute, view);
  };

  const desktopLinks: Array<{
    key: string;
    label: string;
    active: boolean;
    onClick: () => void;
  }> = [
    {
      key: 'practice',
      label: 'Practice',
      active: route === '/' && activeView === 'play',
      onClick: () => go('/', 'play'),
    },
    {
      key: 'history',
      label: 'Progress',
      active:
        route === '/' &&
        (activeView === 'history' ||
          activeView === 'stats' ||
          activeView === 'leaderboard'),
      onClick: () => go('/', 'history'),
    },
    {
      key: 'parent',
      label: 'Parent',
      active: route === '/parent',
      onClick: () => go('/parent'),
    },
    {
      key: 'agent',
      label: 'Agent',
      active: route === '/agent',
      onClick: () => go('/agent'),
    },
    {
      key: 'admin',
      label: 'Admin',
      active: route === '/admin',
      onClick: () => go('/admin'),
    },
  ];

  const activeAccountLabel = roleSession
    ? roleSession.displayName
    : user
    ? displayName
    : null;

  const activeRoleTag = roleSession
    ? roleSession.role === 'admin'
      ? 'Admin'
      : roleSession.role === 'agent'
      ? 'Agent'
      : roleSession.role === 'parent'
      ? 'Parent'
      : 'Student'
    : null;

  const isChildSession = roleSession?.role === 'child';

  return (
    <>
      <header className="sticky top-0 z-30 w-full max-w-[100vw] bg-white/95 dark:bg-[#131C33]/95 backdrop-blur-md border-b-2 border-sky-100 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-3 md:gap-8">
          {/* Left: Mobile Drawer Button + Brand Wordmark */}
          <div className="flex items-center gap-1.5 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden min-h-[44px] min-w-[44px] -ml-1.5 rounded-xl flex items-center justify-center text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => go('/', 'play')}
              className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg px-1"
            >
              Math <span className="text-orange-500 dark:text-amber-400">Speedster</span>
            </button>
          </div>

          {/* Center: 5 Clean Single-Line Nav Links (Desktop) */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6"
          >
            {desktopLinks.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className={`relative py-4 text-sm font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded ${
                  item.active
                    ? 'text-sky-700 dark:text-sky-300'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {item.label}
                {item.active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 right-0 bottom-0 h-1 rounded-t-full bg-sky-500 dark:bg-sky-400"
                  />
                )}
              </button>
            ))}
          </nav>

          {/* Right: Prominent "Back to Parent Portal" in Child Mode OR Account Menu */}
          <div className="relative flex items-center gap-2 shrink-0" ref={menuRef}>
            {isChildSession && (
              <button
                type="button"
                onClick={() => {
                  exitChildModeToParent();
                  go('/parent');
                }}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 border-b-2 border-sky-700 text-white text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Back to Parent Portal</span>
                <span className="sm:hidden">Parent Portal</span>
              </button>
            )}

            {activeAccountLabel ? (
              <>
                {!isChildSession && (
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    className="inline-flex items-center gap-2 min-h-[44px] px-3 py-1.5 rounded-xl border-2 border-sky-200 dark:border-slate-700 bg-sky-50/70 dark:bg-slate-900 hover:bg-sky-100/80 dark:hover:bg-slate-800 text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 transition-colors whitespace-nowrap shrink-0 max-w-[155px] sm:max-w-[200px]"
                  >
                    <UserIcon className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                    <span className="truncate">{activeAccountLabel}</span>
                  </button>
                )}

                {menuOpen && !isChildSession && (
                  <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border-2 border-sky-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-4 space-y-4 z-50">
                    {roleSession && (
                      <div className="space-y-1.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Active Portal · {activeRoleTag}
                        </p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {roleSession.displayName}
                        </p>
                      </div>
                    )}

                    {user ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Google Account (Live Firestore Sync)
                          </p>
                          <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                            {user.email}
                          </p>
                        </div>

                        <form onSubmit={handleSaveName} className="space-y-1.5">
                          <label
                            htmlFor="leaderboard-display-name"
                            className="block text-xs font-medium text-slate-600 dark:text-slate-300"
                          >
                            Leaderboard Name
                          </label>
                          <div className="flex gap-2">
                            <input
                              id="leaderboard-display-name"
                              type="text"
                              maxLength={40}
                              value={nameInput}
                              onChange={(e) => setNameInput(e.target.value)}
                              className="flex-1 min-w-0 min-h-[40px] px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                            <button
                              type="submit"
                              disabled={savingName}
                              className="min-h-[40px] px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                            >
                              {savedNotice ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                'Save'
                              )}
                            </button>
                          </div>
                        </form>

                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            void logoutRole();
                          }}
                          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Sign out
                        </button>
                      </div>
                    ) : (
                      isConfigured && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            void signInWithGoogle();
                          }}
                          className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold whitespace-nowrap"
                        >
                          Sign in with Google
                        </button>
                      )
                    )}
                  </div>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => go('/parent')}
                disabled={authLoading}
                className="min-h-[44px] px-3.5 sm:px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                {authLoading ? 'Signing in…' : 'Sign in'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Slide-Over Navigation Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-4 overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <span className="font-display text-lg font-bold text-slate-950 dark:text-white">
                  Math Speedster
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation menu"
                  className="min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                <p className="px-3 text-xs font-semibold text-slate-400 dark:text-slate-500">
                  Math Practice
                </p>
                {[
                  {
                    label: 'Speed Drills',
                    icon: Play,
                    active: route === '/' && activeView === 'play',
                    onClick: () => go('/', 'play'),
                  },
                  {
                    label: 'Run History',
                    icon: History,
                    active: route === '/' && activeView === 'history',
                    onClick: () => go('/', 'history'),
                  },
                  {
                    label: 'Performance Stats',
                    icon: BarChart3,
                    active: route === '/' && activeView === 'stats',
                    onClick: () => go('/', 'stats'),
                  },
                  {
                    label: 'Leaderboard',
                    icon: Trophy,
                    active: route === '/' && activeView === 'leaderboard',
                    onClick: () => go('/', 'leaderboard'),
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.onClick}
                      className={`w-full min-h-[48px] px-3 rounded-xl flex items-center gap-3 text-sm font-bold transition-colors ${
                        item.active
                          ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-sky-50/60 dark:hover:bg-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="px-3 text-xs font-semibold text-slate-400 dark:text-slate-500">
                  Account Portals
                </p>
                {[
                  {
                    label: 'Parent Portal',
                    icon: Users,
                    active: route === '/parent',
                    onClick: () => go('/parent'),
                  },
                  {
                    label: 'Agent Portal',
                    icon: Briefcase,
                    active: route === '/agent',
                    onClick: () => go('/agent'),
                  },
                  {
                    label: 'Admin Console',
                    icon: ShieldCheck,
                    active: route === '/admin',
                    onClick: () => go('/admin'),
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.onClick}
                      className={`w-full min-h-[48px] px-3 rounded-xl flex items-center gap-3 text-sm font-bold transition-colors ${
                        item.active
                          ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-sky-50/60 dark:hover:bg-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    void logoutRole();
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out ({user.email?.split('@')[0]})
                </button>
              ) : (
                isConfigured && (
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      void signInWithGoogle();
                    }}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-sm font-semibold whitespace-nowrap"
                  >
                    Sign in with Google
                  </button>
                )
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
