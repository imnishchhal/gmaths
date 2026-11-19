import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  BarChart3,
  Clock,
  GraduationCap,
  History,
  Lock,
  LogOut,
  Phone,
  Play,
  Trophy,
  X,
} from 'lucide-react';
import { ActiveDrill } from './components/ActiveDrill';
import { DrillSetup } from './components/DrillSetup';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { HistoryView } from './components/HistoryView';
import { LeaderboardView } from './components/LeaderboardView';
import { SessionSummaryView } from './components/SessionSummaryView';
import { StatsView } from './components/StatsView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AgentDashboard } from './components/agent/AgentDashboard';
import { RoleAuthGate } from './components/auth/RoleAuthGate';
import { ParentDashboard } from './components/parent/ParentDashboard';
import { FirebaseProvider, useFirebase } from './context/FirebaseContext';
import { PlatformProvider, usePlatform } from './context/PlatformContext';
import {
  AppView,
  ArithmeticMode,
  Difficulty,
  DrillConfig,
  GameState,
  SessionRecord,
  SessionType,
  getPresetKey,
} from './types/math';
import {
  PlatformRoute,
  evaluateSubscriptionState,
  formatIsoDate,
} from './types/platform';
import { soundEngine } from './utils/sound';

const CONFIG_STORAGE_KEY = 'math_speedster_config_v1';
const THEME_STORAGE_KEY = 'math_speedster_theme_v1';

const DEFAULT_CONFIG: DrillConfig = {
  mode: 'mixed',
  difficulty: 'medium',
  sessionType: 'sprint',
  durationSec: 60,
  allowNegatives: false,
  autoSubmit: true,
};

function loadInitialConfig(): DrillConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<DrillConfig>;
    return {
      mode: parsed.mode ?? DEFAULT_CONFIG.mode,
      difficulty: parsed.difficulty ?? DEFAULT_CONFIG.difficulty,
      sessionType: parsed.sessionType ?? DEFAULT_CONFIG.sessionType,
      durationSec: parsed.durationSec ?? DEFAULT_CONFIG.durationSec,
      allowNegatives: Boolean(parsed.allowNegatives),
      autoSubmit:
        parsed.autoSubmit !== undefined
          ? Boolean(parsed.autoSubmit)
          : DEFAULT_CONFIG.autoSubmit,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function loadInitialTheme(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function resolveRouteFromLocation(): PlatformRoute {
  if (typeof window === 'undefined') return '/';
  const rawHash = window.location.hash.replace(/^#/, '').replace(/\/+$/, '');
  if (
    rawHash === '/admin' ||
    rawHash === '/agent' ||
    rawHash === '/parent' ||
    rawHash === '/child'
  ) {
    return rawHash;
  }
  const pathClean = window.location.pathname.replace(/\/+$/, '');
  if (pathClean.endsWith('/admin')) return '/admin';
  if (pathClean.endsWith('/agent')) return '/agent';
  if (pathClean.endsWith('/parent')) return '/parent';
  if (pathClean.endsWith('/child')) return '/child';
  return '/';
}

const MathSpeedsterShell: React.FC = () => {
  const {
    personalBests,
    recordCompletedSession,
    authError,
    cloudError,
    dismissErrors,
  } = useFirebase();

  const {
    roleSession,
    platformError,
    dismissPlatformError,
    logoutRole,
    exitChildModeToParent,
    recordChildPractice,
    getAgentById,
    getParentById,
    getChildById,
    getLatestSubscriptionForParent,
  } = usePlatform();

  const [route, setRoute] = useState<PlatformRoute>(resolveRouteFromLocation);
  const [activeView, setActiveView] = useState<AppView>('play');
  const [gameState, setGameState] = useState<GameState>('SETUP');
  const [config, setConfig] = useState<DrillConfig>(loadInitialConfig);
  const [drillRunKey, setDrillRunKey] = useState<number>(1);
  const [muted, setMuted] = useState<boolean>(() => soundEngine.isMuted());
  const [darkMode, setDarkMode] = useState<boolean>(loadInitialTheme);

  const [lastSummary, setLastSummary] = useState<{
    session: SessionRecord;
    isNewPersonalBest: boolean;
    savedToCloud: boolean;
    leaderboardUpdated: boolean;
  } | null>(null);

  // Sync dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage error
    }
  }, [darkMode]);

  // Listen to browser hash / history navigation (compatible with GitHub Pages /gmaths/ subpath)
  useEffect(() => {
    const syncRoute = () => {
      setRoute(resolveRouteFromLocation());
      setGameState('SETUP');
    };
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);

  const handleNavigateRoute = useCallback(
    (nextRoute: PlatformRoute, view?: AppView) => {
      setRoute(nextRoute);
      if (view) {
        setActiveView(view);
      } else if (nextRoute === '/') {
        setActiveView('play');
      }
      setGameState('SETUP');
      if (typeof window !== 'undefined') {
        const targetHash = nextRoute === '/' ? '#/' : `#${nextRoute}`;
        if (window.location.hash !== targetHash) {
          window.location.hash = targetHash;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    []
  );

  // Active child + yearly subscription check
  const activeChild =
    roleSession?.role === 'child'
      ? getChildById(roleSession.accountId)
      : undefined;
  const activeChildParent = activeChild
    ? getParentById(activeChild.parentId)
    : undefined;
  const activeChildSub = activeChild
    ? getLatestSubscriptionForParent(activeChild.parentId)
    : undefined;
  const activeChildSubEval = activeChild
    ? evaluateSubscriptionState(activeChildSub)
    : null;
  const activeChildAgent = activeChildParent
    ? getAgentById(activeChildParent.createdByAgentId)
    : undefined;

  const isChildPracticeBlocked = Boolean(
    activeChild && activeChildSubEval && !activeChildSubEval.canPractice
  );

  const handleConfigChange = useCallback((next: DrillConfig) => {
    setConfig(next);
    try {
      window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage error
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const nextMuted = soundEngine.toggleMute();
    setMuted(nextMuted);
  }, []);

  const handleToggleTheme = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  const handleStartDrill = useCallback(() => {
    if (isChildPracticeBlocked) return;
    setRoute('/');
    setActiveView('play');
    setDrillRunKey((k) => k + 1);
    setGameState('PLAYING');
  }, [isChildPracticeBlocked]);

  const handleStartPreset = useCallback(
    (
      mode: ArithmeticMode,
      difficulty: Difficulty,
      sessionType: SessionType,
      durationSec: 30 | 60 | 90
    ) => {
      if (isChildPracticeBlocked) return;
      const next: DrillConfig = {
        ...config,
        mode,
        difficulty,
        sessionType,
        durationSec,
      };
      handleConfigChange(next);
      setRoute('/');
      setActiveView('play');
      setDrillRunKey((k) => k + 1);
      setGameState('PLAYING');
    },
    [config, handleConfigChange, isChildPracticeBlocked]
  );

  const handleSessionComplete = useCallback(
    async (record: SessionRecord) => {
      const presetKey = getPresetKey(
        record.mode,
        record.difficulty,
        record.sessionType,
        record.durationSec
      );
      const prevBest = personalBests[presetKey];
      const isNewPB =
        record.score > 0 &&
        (!prevBest ||
          record.score > prevBest.score ||
          (record.score === prevBest.score &&
            record.accuracy > prevBest.accuracy));

      soundEngine.playComplete(isNewPB);

      setLastSummary({
        session: record,
        isNewPersonalBest: isNewPB,
        savedToCloud: false,
        leaderboardUpdated: false,
      });
      setGameState('SUMMARY');

      if (activeChild) {
        void recordChildPractice(activeChild.id, record);
      }

      const outcome = await recordCompletedSession(record);
      setLastSummary((current) =>
        current && current.session.id === record.id
          ? {
              ...current,
              savedToCloud: outcome.savedToCloud,
              leaderboardUpdated: outcome.leaderboardUpdated,
            }
          : current
      );
    },
    [activeChild, personalBests, recordChildPractice, recordCompletedSession]
  );

  // Full-viewport distraction-free Sprint Arena during active gameplay
  if (
    route === '/' &&
    activeView === 'play' &&
    gameState === 'PLAYING' &&
    !isChildPracticeBlocked
  ) {
    return (
      <ActiveDrill
        key={drillRunKey}
        config={config}
        muted={muted}
        onToggleMute={handleToggleMute}
        onComplete={(rec) => void handleSessionComplete(rec)}
        onExit={() => setGameState('SETUP')}
        activeStudentLabel={
          activeChild ? `${activeChild.name} · ${activeChild.grade}` : undefined
        }
      />
    );
  }

  // Protected Role Guard Checks
  const isAdminAuthed = roleSession?.role === 'admin';
  const activeAgent =
    roleSession?.role === 'agent'
      ? getAgentById(roleSession.accountId)
      : undefined;
  const isAgentAuthed = Boolean(activeAgent && activeAgent.isActive);
  const activeParent =
    roleSession?.role === 'parent'
      ? getParentById(roleSession.accountId)
      : undefined;
  const isParentAuthed = Boolean(activeParent);

  const noticeError = authError || cloudError || platformError;
  const isProgressSubView =
    route === '/' &&
    (activeView === 'history' ||
      activeView === 'stats' ||
      activeView === 'leaderboard');

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-clip flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Header
        route={route}
        activeView={activeView}
        onNavigateRoute={handleNavigateRoute}
      />

      {/* Active Student Mode Context Bar */}
      {activeChild && route === '/' && (
        <div className="w-full bg-blue-50/80 dark:bg-blue-950/35 border-b border-blue-200/80 dark:border-blue-900/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
              <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="font-semibold text-slate-900 dark:text-white truncate">
                Student Mode: {activeChild.name} ({activeChild.grade})
              </span>
              {activeChildSubEval?.state === 'expiring_soon' && (
                <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  Plan expires in {activeChildSubEval.daysLeft}d
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {roleSession?.returnToParentId ? (
                <button
                  type="button"
                  onClick={() => {
                    exitChildModeToParent();
                    handleNavigateRoute('/parent');
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                  Back to Parent
                </button>
              ) : (
                <button
                  type="button"
                  onClick={logoutRole}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  Sign out
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Non-intrusive inline error notice if auth/cloud encounters an issue */}
      {noticeError && (
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-4">
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/70 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 flex items-start justify-between gap-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">
                {noticeError.startsWith('{')
                  ? 'Cloud sync paused due to a Firestore permission or network error. Local storage fallback remains active.'
                  : noticeError}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                dismissErrors();
                dismissPlatformError();
              }}
              aria-label="Dismiss notice"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-amber-200/50 dark:hover:bg-amber-900/50 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Progress Sub-Navigation Strip (History / Stats / Leaderboard) */}
      {isProgressSubView && (
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5">
          <div
            role="tablist"
            aria-label="Progress views"
            className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 max-w-md"
          >
            {(
              [
                { id: 'history', label: 'History', icon: History },
                { id: 'stats', label: 'Stats', icon: BarChart3 },
                { id: 'leaderboard', label: 'Board', icon: Trophy },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveView(item.id)}
                  className={`min-h-[44px] px-2.5 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <main className="flex-1 w-full">
        {/* ROUTE: /admin */}
        {route === '/admin' &&
          (isAdminAuthed ? (
            <AdminDashboard />
          ) : (
            <RoleAuthGate
              key="admin"
              targetRole="admin"
              onNavigateRoute={handleNavigateRoute}
            />
          ))}

        {/* ROUTE: /agent */}
        {route === '/agent' &&
          (isAgentAuthed ? (
            <AgentDashboard />
          ) : (
            <RoleAuthGate
              key="agent"
              targetRole="agent"
              onNavigateRoute={handleNavigateRoute}
            />
          ))}

        {/* ROUTE: /parent */}
        {route === '/parent' &&
          (isParentAuthed ? (
            <ParentDashboard onNavigateRoute={handleNavigateRoute} />
          ) : (
            <RoleAuthGate
              key="parent"
              targetRole="parent"
              onNavigateRoute={handleNavigateRoute}
            />
          ))}

        {/* ROUTE: /child */}
        {route === '/child' &&
          (activeChild ? (
            <div className="max-w-md mx-auto px-4 py-10">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5 text-center">
                <GraduationCap className="w-9 h-9 text-blue-600 dark:text-blue-400 mx-auto" />
                <div className="space-y-1">
                  <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                    Signed in as {activeChild.name}
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {activeChild.grade} · @{activeChild.username}
                  </p>
                </div>
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleNavigateRoute('/', 'play')}
                    className="w-full min-h-[48px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Go to Math Practice
                  </button>
                  <button
                    type="button"
                    onClick={logoutRole}
                    className="w-full min-h-[48px] px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Switch Student Account
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <RoleAuthGate
              key="child"
              targetRole="child"
              onNavigateRoute={handleNavigateRoute}
            />
          ))}

        {/* ROUTE: / (Practice & Progress Workspace) */}
        {route === '/' && activeView === 'play' && isChildPracticeBlocked && (
          <div className="max-w-lg mx-auto px-4 py-10 sm:py-14">
            <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 p-6 sm:p-7 space-y-5">
              <div className="inline-flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-400">
                <Lock className="w-5 h-5 shrink-0" />
                <span>Yearly Subscription Renewal Required</span>
              </div>
              <div className="space-y-2">
                <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                  Practice access is paused for {activeChild?.name}
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {activeChildSubEval?.state === 'suspended'
                    ? 'This family subscription is currently suspended by Admin.'
                    : activeChildSub
                    ? `Your family yearly plan expired on ${formatIsoDate(activeChildSub.expiryDate)}.`
                    : 'No active yearly subscription was found for this family account.'}{' '}
                  Please ask your Parent or assigned Agent to renew for 1 year.
                </p>
              </div>

              {activeChildAgent && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 space-y-1 text-sm">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Assigned Renewal Agent: {activeChildAgent.name} (
                    {activeChildAgent.agentCode})
                  </p>
                  <a
                    href={`tel:${activeChildAgent.phone}`}
                    className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold hover:underline min-h-[40px]"
                  >
                    <Phone className="w-4 h-4 shrink-0" />
                    {activeChildAgent.phone} · {activeChildAgent.assignedArea}
                  </a>
                </div>
              )}

              <div className="flex flex-wrap gap-2.5">
                {roleSession?.returnToParentId && (
                  <button
                    type="button"
                    onClick={() => {
                      exitChildModeToParent();
                      handleNavigateRoute('/parent');
                    }}
                    className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold whitespace-nowrap"
                  >
                    Back to Parent Portal
                  </button>
                )}
                <button
                  type="button"
                  onClick={logoutRole}
                  className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  Sign out Student
                </button>
              </div>
            </div>
          </div>
        )}

        {route === '/' &&
          activeView === 'play' &&
          !isChildPracticeBlocked &&
          gameState === 'SETUP' && (
            <DrillSetup
              config={config}
              onChangeConfig={handleConfigChange}
              onStart={handleStartDrill}
              onOpenHistory={() => setActiveView('history')}
              muted={muted}
              onToggleMute={handleToggleMute}
              darkMode={darkMode}
              onToggleTheme={handleToggleTheme}
            />
          )}

        {route === '/' &&
          activeView === 'play' &&
          !isChildPracticeBlocked &&
          gameState === 'SUMMARY' &&
          lastSummary && (
            <SessionSummaryView
              session={lastSummary.session}
              isNewPersonalBest={lastSummary.isNewPersonalBest}
              savedToCloud={lastSummary.savedToCloud}
              leaderboardUpdated={lastSummary.leaderboardUpdated}
              onPlayAgain={handleStartDrill}
              onBackToSetup={() => setGameState('SETUP')}
            />
          )}

        {route === '/' && activeView === 'history' && (
          <HistoryView onStartNewDrill={handleStartDrill} />
        )}

        {route === '/' && activeView === 'leaderboard' && (
          <LeaderboardView onStartPreset={handleStartPreset} />
        )}

        {route === '/' && activeView === 'stats' && (
          <StatsView onStartDrill={handleStartDrill} />
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <PlatformProvider>
          <MathSpeedsterShell />
        </PlatformProvider>
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
