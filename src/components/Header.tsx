import React, { useEffect, useRef, useState } from 'react';
import { Check, LogOut, User as UserIcon } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { AppView } from '../types/math';

interface HeaderProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
}

const NAV_ITEMS: Array<{ id: AppView; label: string }> = [
  { id: 'play', label: 'Play' },
  { id: 'history', label: 'History' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'stats', label: 'Stats' },
];

export const Header: React.FC<HeaderProps> = ({ activeView, onSelectView }) => {
  const {
    user,
    displayName,
    isConfigured,
    authLoading,
    signInWithGoogle,
    signOutUser,
    updateName,
  } = useFirebase();

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

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      {/* Strict 3-Zone Top Bar Contract: Brand | Nav Links | Single Primary Action */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectView('play')}
          className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          Math Speedster
        </button>

        {/* Zone 2: 4 Clean Single-Line Nav Links (Desktop) */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded ${
                  isActive
                    ? 'text-slate-950 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 right-0 bottom-0 h-0.5 bg-blue-600 dark:bg-blue-500"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="relative shrink-0" ref={menuRef}>
          {user ? (
            <>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium text-slate-900 dark:text-slate-100 transition-colors whitespace-nowrap shrink-0 max-w-[168px]"
              >
                <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="truncate">{displayName}</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-4 space-y-4">
                  <div className="space-y-0.5">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Signed in with Google
                    </p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {user.email}
                    </p>
                  </div>

                  <form onSubmit={handleSaveName} className="space-y-2">
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
                        className="flex-1 min-w-0 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <button
                        type="submit"
                        disabled={savingName}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                      >
                        {savedNotice ? (
                          <span className="inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            Saved
                          </span>
                        ) : (
                          'Save'
                        )}
                      </button>
                    </div>
                  </form>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        void signOutUser();
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={authLoading || !isConfigured}
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {authLoading
                ? 'Signing in…'
                : isConfigured
                ? 'Sign in'
                : 'Local Mode'}
            </button>
          )}
        </div>
      </div>

      {/* Compact Mobile Tab Strip (stays well under 15% mobile viewport cap) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden grid grid-cols-4 border-t border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`h-11 text-xs font-semibold transition-colors whitespace-nowrap relative ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {item.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute left-3 right-3 bottom-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
                />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
