import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { ActiveDrill } from './components/ActiveDrill';
import { DrillSetup } from './components/DrillSetup';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { HistoryView } from './components/HistoryView';
import { LeaderboardView } from './components/LeaderboardView';
import { SessionSummaryView } from './components/SessionSummaryView';
import { StatsView } from './components/StatsView';
import { FirebaseProvider, useFirebase } from './context/FirebaseContext';
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

const MathSpeedsterShell: React.FC = () => {
  const {
    personalBests,
    recordCompletedSession,
    authError,
    cloudError,
    dismissErrors,
  } = useFirebase();

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

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage error
    }
  }, [darkMode]);

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
    setActiveView('play');
    setDrillRunKey((k) => k + 1);
    setGameState('PLAYING');
  }, []);

  const handleStartPreset = useCallback(
    (
      mode: ArithmeticMode,
      difficulty: Difficulty,
      sessionType: SessionType,
      durationSec: 30 | 60 | 90
    ) => {
      const next: DrillConfig = {
        ...config,
        mode,
        difficulty,
        sessionType,
        durationSec,
      };
      handleConfigChange(next);
      setActiveView('play');
      setDrillRunKey((k) => k + 1);
      setGameState('PLAYING');
    },
    [config, handleConfigChange]
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
    [personalBests, recordCompletedSession]
  );

  const handleSelectView = useCallback((view: AppView) => {
    setActiveView(view);
    if (view !== 'play') {
      setGameState('SETUP');
    }
  }, []);

  // Full-viewport distraction-free Sprint Arena during active gameplay
  if (activeView === 'play' && gameState === 'PLAYING') {
    return (
      <ActiveDrill
        key={drillRunKey}
        config={config}
        muted={muted}
        onToggleMute={handleToggleMute}
        onComplete={(rec) => void handleSessionComplete(rec)}
        onExit={() => setGameState('SETUP')}
      />
    );
  }

  const noticeError = authError || cloudError;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Header activeView={activeView} onSelectView={handleSelectView} />

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
              onClick={dismissErrors}
              aria-label="Dismiss notice"
              className="p-1 rounded hover:bg-amber-200/50 dark:hover:bg-amber-900/50 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {activeView === 'play' && gameState === 'SETUP' && (
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

        {activeView === 'play' && gameState === 'SUMMARY' && lastSummary && (
          <SessionSummaryView
            session={lastSummary.session}
            isNewPersonalBest={lastSummary.isNewPersonalBest}
            savedToCloud={lastSummary.savedToCloud}
            leaderboardUpdated={lastSummary.leaderboardUpdated}
            onPlayAgain={handleStartDrill}
            onBackToSetup={() => setGameState('SETUP')}
          />
        )}

        {activeView === 'history' && (
          <HistoryView onStartNewDrill={handleStartDrill} />
        )}

        {activeView === 'leaderboard' && (
          <LeaderboardView onStartPreset={handleStartPreset} />
        )}

        {activeView === 'stats' && <StatsView onStartDrill={handleStartDrill} />}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <MathSpeedsterShell />
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
