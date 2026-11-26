import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Clock,
  GraduationCap,
  History,
  Lock,
  Megaphone,
  Phone,
  Trophy,
  X,
} from 'lucide-react';
import { ActiveDrill } from './components/ActiveDrill';
import { CheckoutModal } from './components/CheckoutModal';
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
  INDIAN_CLASS_META,
  MathProblem,
  SessionRecord,
  SessionType,
  coerceModeForClass,
  formatIndianClassLabel,
  getPresetKey,
  normalizeIndianClass,
} from './types/math';
import {
  ChildProfile,
  PlatformRoute,
  evaluateSubscriptionState,
  formatIsoDate,
  getAgentApprovalStatus,
} from './types/platform';
import { soundEngine } from './utils/sound';
import { isPhoneAgentAuthEmail } from './utils/referral';

const CONFIG_STORAGE_KEY = 'math_speedster_config_v2';
const THEME_STORAGE_KEY = 'math_speedster_theme_v1';

const DEFAULT_CONFIG: DrillConfig = {
  mode: 'mixed',
  difficulty: 'easy',
  indianClass: '3rd',
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
    const indianClass = normalizeIndianClass(
      parsed.indianClass,
      DEFAULT_CONFIG.indianClass
    );
    const meta = INDIAN_CLASS_META[indianClass];
    return {
      mode: coerceModeForClass(parsed.mode ?? DEFAULT_CONFIG.mode, indianClass),
      difficulty: meta.mappedDifficulty,
      indianClass,
      sessionType: parsed.sessionType ?? DEFAULT_CONFIG.sessionType,
      durationSec: parsed.durationSec ?? DEFAULT_CONFIG.durationSec,
      allowNegatives:
        meta.allowNegativesAvailable && Boolean(parsed.allowNegatives),
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
  if (rawHash === '/admin' || rawHash === '/agent' || rawHash === '/parent') {
    return rawHash;
  }
  const pathClean = window.location.pathname.replace(/\/+$/, '');
  if (pathClean.endsWith('/admin')) return '/admin';
  if (pathClean.endsWith('/agent')) return '/agent';
  if (pathClean.endsWith('/parent')) return '/parent';
  return '/';
}

const MathSpeedsterShell: React.FC = () => {
  const {
    user,
    personalBests,
    recordCompletedSession,
    authError,
    cloudError,
    dismissErrors,
  } = useFirebase();

  const {
    roleSession,
    autoRouteEvent,
    platformError,
    dismissPlatformError,
    appConfig,
    isProSubscriber,
    capturedReferralCode,
    markFreeAdaptiveUsed,
    recordTrialLeadIfReferred,
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
  const [dismissedAnnouncementText, setDismissedAnnouncementText] =
    useState<string>('');
  const lastHandledAutoRouteSeqRef = useRef<number>(0);

  const [lastSummary, setLastSummary] = useState<{
    session: SessionRecord;
    isNewPersonalBest: boolean;
    savedToCloud: boolean;
    leaderboardUpdated: boolean;
  } | null>(null);

  // Record referred trial signup if signed in with a captured ?ref= code (students/parents only)
  useEffect(() => {
    if (
      user?.email &&
      capturedReferralCode &&
      !isPhoneAgentAuthEmail(user.email)
    ) {
      void recordTrialLeadIfReferred(user.displayName || '', user.email);
    }
  }, [
    user?.email,
    user?.displayName,
    capturedReferralCode,
    recordTrialLeadIfReferred,
  ]);

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

  // Automatic routing to assigned dashboard upon Google Sign-In (popup or redirect return)
  useEffect(() => {
    if (
      autoRouteEvent &&
      autoRouteEvent.seq !== lastHandledAutoRouteSeqRef.current
    ) {
      lastHandledAutoRouteSeqRef.current = autoRouteEvent.seq;
      handleNavigateRoute(autoRouteEvent.route);
    }
  }, [autoRouteEvent, handleNavigateRoute]);

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
    const cleaned: DrillConfig = {
      ...next,
      drillVariant: 'standard',
      adaptiveQueue: undefined,
      dailySeed: undefined,
    };
    setConfig(cleaned);
    try {
      window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cleaned));
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
    setConfig((prev) =>
      prev.drillVariant && prev.drillVariant !== 'standard'
        ? {
            ...prev,
            drillVariant: 'standard',
            adaptiveQueue: undefined,
            dailySeed: undefined,
          }
        : prev
    );
    setRoute('/');
    setActiveView('play');
    setDrillRunKey((k) => k + 1);
    setGameState('PLAYING');
  }, [isChildPracticeBlocked]);

  const handleStartDailyChallenge = useCallback(() => {
    if (isChildPracticeBlocked) return;
    setConfig((prev) => ({
      ...prev,
      mode: coerceModeForClass('mixed', prev.indianClass),
      sessionType: 'sprint',
      durationSec: 60,
      drillVariant: 'daily_challenge',
      dailySeed: appConfig.dailyChallengeSeed,
      adaptiveQueue: undefined,
    }));
    setRoute('/');
    setActiveView('play');
    setDrillRunKey((k) => k + 1);
    setGameState('PLAYING');
  }, [appConfig.dailyChallengeSeed, isChildPracticeBlocked]);

  const handleStartWeakSpotsDrill = useCallback(
    (queue: MathProblem[]) => {
      if (isChildPracticeBlocked || queue.length === 0) return;
      if (!isProSubscriber) {
        markFreeAdaptiveUsed();
      }
      setConfig((prev) => ({
        ...prev,
        drillVariant: 'weak_spots',
        adaptiveQueue: queue,
        dailySeed: undefined,
      }));
      setRoute('/');
      setActiveView('play');
      setDrillRunKey((k) => k + 1);
      setGameState('PLAYING');
    },
    [isChildPracticeBlocked, isProSubscriber, markFreeAdaptiveUsed]
  );

  const handleReplayFromSummary = useCallback(() => {
    if (isChildPracticeBlocked) return;
    if (lastSummary?.session.drillVariant === 'daily_challenge') {
      handleStartDailyChallenge();
      return;
    }
    handleStartDrill();
  }, [
    handleStartDailyChallenge,
    handleStartDrill,
    isChildPracticeBlocked,
    lastSummary?.session.drillVariant,
  ]);

  // One-tap switch from Parent Dashboard: calibrate difficulty to child's Indian class & start immediately
  const handleStartChildPractice = useCallback(
    (child: ChildProfile) => {
      const meta = INDIAN_CLASS_META[child.grade];
      const calibrated: DrillConfig = {
        ...config,
        indianClass: child.grade,
        difficulty: meta.mappedDifficulty,
        mode: coerceModeForClass(config.mode, child.grade),
        allowNegatives:
          meta.allowNegativesAvailable && config.allowNegatives,
        drillVariant: 'standard',
        adaptiveQueue: undefined,
        dailySeed: undefined,
      };
      handleConfigChange(calibrated);
      setRoute('/');
      setActiveView('play');
      setDrillRunKey((k) => k + 1);
      setGameState('PLAYING');
      if (typeof window !== 'undefined' && window.location.hash !== '#/') {
        window.location.hash = '#/';
      }
    },
    [config, handleConfigChange]
  );

  const handleBackToParentPortal = useCallback(() => {
    exitChildModeToParent();
    handleNavigateRoute('/parent');
  }, [exitChildModeToParent, handleNavigateRoute]);

  const handleStartPreset = useCallback(
    (
      mode: ArithmeticMode,
      difficulty: Difficulty,
      sessionType: SessionType,
      durationSec: 30 | 60 | 90
    ) => {
      if (isChildPracticeBlocked) return;
      const defaultClass =
        difficulty === 'easy'
          ? '3rd'
          : difficulty === 'medium'
          ? '5th'
          : '10th';
      const next: DrillConfig = {
        ...config,
        mode: coerceModeForClass(mode, defaultClass),
        difficulty,
        indianClass: defaultClass,
        sessionType,
        durationSec,
        drillVariant: 'standard',
        adaptiveQueue: undefined,
        dailySeed: undefined,
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

      const [childSaved, outcome] = await Promise.all([
        activeChild
          ? recordChildPractice(activeChild.id, record)
          : Promise.resolve(false),
        recordCompletedSession(record),
      ]);

      setLastSummary((current) =>
        current && current.session.id === record.id
          ? {
              ...current,
              savedToCloud: outcome.savedToCloud || childSaved,
              leaderboardUpdated:
                outcome.leaderboardUpdated || (childSaved && record.score >= 1),
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
        onBackToParent={activeChild ? handleBackToParentPortal : undefined}
        activeStudentLabel={
          activeChild
            ? `${activeChild.name} · ${formatIndianClassLabel(activeChild.grade)}`
            : undefined
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
  const isAgentAuthed = Boolean(
    activeAgent && getAgentApprovalStatus(activeAgent) !== 'suspended'
  );
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

  const renewalAgentContact = activeChildAgent
    ? {
        name: activeChildAgent.name,
        code: activeChildAgent.agentCode,
        phone: activeChildAgent.phone,
        area: activeChildAgent.assignedArea,
      }
    : activeChildParent?.agentPhone
    ? {
        name: activeChildParent.agentName,
        code: activeChildParent.agentCode,
        phone: activeChildParent.agentPhone,
        area: activeChildParent.agentArea,
      }
    : null;

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-clip flex flex-col bg-[#FFFDF5] dark:bg-[#0F172A] kids-canvas-bg text-slate-900 dark:text-slate-100">
      <Header
        route={route}
        activeView={activeView}
        onNavigateRoute={handleNavigateRoute}
      />

      {/* Site-Wide Admin Announcement Banner */}
      {appConfig.announcementEnabled &&
        appConfig.announcementText.trim().length > 0 &&
        dismissedAnnouncementText !== appConfig.announcementText && (
          <div className="w-full bg-violet-600 dark:bg-violet-900 text-white border-b-2 border-violet-400/40">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Megaphone className="w-4 h-4 shrink-0 text-amber-300" />
                <span className="font-bold break-words">
                  {appConfig.announcementText}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDismissedAnnouncementText(appConfig.announcementText)
                }
                aria-label="Dismiss announcement"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl hover:bg-white/15 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      {/* Active Student Mode Context Bar */}
      {activeChild && route === '/' && (
        <div className="w-full bg-sky-100/90 dark:bg-sky-950/50 border-b-2 border-sky-200 dark:border-sky-800/70">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
              <GraduationCap className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <span className="font-bold text-slate-900 dark:text-white truncate">
                Practicing as {activeChild.name} (
                {formatIndianClassLabel(activeChild.grade)})
              </span>
              {activeChildSubEval?.state === 'expiring_soon' && (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  Plan expires in {activeChildSubEval.daysLeft}d
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleBackToParentPortal}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1 rounded-xl bg-white dark:bg-slate-900 border-2 border-sky-200 dark:border-sky-700 text-xs font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              Exit / Back to Parent Portal
            </button>
          </div>
        </div>
      )}

      {/* Non-intrusive inline error notice if auth/cloud encounters an issue */}
      {noticeError && (
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-4">
          <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-4 py-3 flex items-start justify-between gap-3 text-xs sm:text-sm text-amber-950 dark:text-amber-200">
            <div className="flex items-start gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words font-medium">
                {noticeError.startsWith('{')
                  ? 'A Cloud Firestore permission or network error occurred. Verify you are signed in with the right Google account and retry.'
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
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl hover:bg-amber-200/50 dark:hover:bg-amber-900/50 shrink-0"
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
            className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-sky-100/80 dark:bg-slate-900 border-2 border-sky-200/80 dark:border-slate-800 max-w-md"
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
                  className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-sm'
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
            <ParentDashboard onStartChildPractice={handleStartChildPractice} />
          ) : (
            <RoleAuthGate
              key="parent"
              targetRole="parent"
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
                  Please ask your assigned Agent to renew for 1 year.
                </p>
              </div>

              {renewalAgentContact && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 space-y-1 text-sm">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Assigned Renewal Agent: {renewalAgentContact.name}
                    {renewalAgentContact.code
                      ? ` (${renewalAgentContact.code})`
                      : ''}
                  </p>
                  <a
                    href={`tel:${renewalAgentContact.phone}`}
                    className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold hover:underline min-h-[40px]"
                  >
                    <Phone className="w-4 h-4 shrink-0" />
                    {renewalAgentContact.phone}
                    {renewalAgentContact.area
                      ? ` · ${renewalAgentContact.area}`
                      : ''}
                  </a>
                </div>
              )}

              <button
                type="button"
                onClick={handleBackToParentPortal}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold whitespace-nowrap"
              >
                Back to Parent Portal
              </button>
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
              onStartDailyChallenge={handleStartDailyChallenge}
              onOpenHistory={() => setActiveView('history')}
              onOpenLeaderboard={() => setActiveView('leaderboard')}
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
              onPlayAgain={handleReplayFromSummary}
              onBackToSetup={() => setGameState('SETUP')}
              onBackToParent={
                activeChild ? handleBackToParentPortal : undefined
              }
              onStartWeakSpotsDrill={handleStartWeakSpotsDrill}
              activeStudentLabel={
                activeChild
                  ? `${activeChild.name} · ${formatIndianClassLabel(activeChild.grade)}`
                  : undefined
              }
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

      <CheckoutModal />
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
