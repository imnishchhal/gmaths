import React, { useEffect } from 'react';
import {
  ArrowRight,
  Cloud,
  GraduationCap,
  HardDrive,
  Lock,
  Moon,
  Play,
  Sun,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import {
  ArithmeticMode,
  DrillConfig,
  INDIAN_CLASSES,
  INDIAN_CLASS_META,
  IndianClass,
  MODE_META,
  SESSION_TYPE_META,
  SessionType,
  SprintDuration,
  coerceModeForClass,
  formatIndianClassLabel,
  formatSessionDescriptor,
  getAllowedModesForClass,
  getPresetKey,
} from '../types/math';
import { TopChampionsCard } from './TopChampionsCard';

interface DrillSetupProps {
  config: DrillConfig;
  onChangeConfig: (next: DrillConfig) => void;
  onStart: () => void;
  onOpenHistory: () => void;
  onOpenLeaderboard: () => void;
  muted: boolean;
  onToggleMute: () => void;
  darkMode: boolean;
  onToggleTheme: () => void;
}

const MODES: ArithmeticMode[] = [
  'mixed',
  'addition',
  'subtraction',
  'multiplication',
  'division',
];

const SESSION_TYPES: SessionType[] = ['sprint', 'streak', 'practice'];

const DURATIONS: SprintDuration[] = [30, 60, 90];

export const DrillSetup: React.FC<DrillSetupProps> = ({
  config,
  onChangeConfig,
  onStart,
  onOpenHistory,
  onOpenLeaderboard,
  muted,
  onToggleMute,
  darkMode,
  onToggleTheme,
}) => {
  const { user, isConfigured, sessions, personalBests, signInWithGoogle } =
    useFirebase();

  const classMeta = INDIAN_CLASS_META[config.indianClass];
  const allowedModes = getAllowedModesForClass(config.indianClass);

  const activePresetKey = getPresetKey(
    config.mode,
    config.difficulty,
    config.sessionType,
    config.durationSec
  );
  const presetBest = personalBests[activePresetKey];
  const recentRuns = sessions.slice(0, 4);

  // Allow pressing Enter directly on the setup screen to start immediately
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'BUTTON' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStart]);

  const startLabel =
    config.sessionType === 'sprint'
      ? `Start ${config.durationSec}s Sprint`
      : config.sessionType === 'streak'
      ? 'Start Streak Run'
      : 'Start Practice';

  const handleClassChange = (nextClass: IndianClass) => {
    const meta = INDIAN_CLASS_META[nextClass];
    const nextMode = coerceModeForClass(config.mode, nextClass);
    const prevRecommended =
      INDIAN_CLASS_META[config.indianClass].recommendedDuration;

    onChangeConfig({
      ...config,
      indianClass: nextClass,
      difficulty: meta.mappedDifficulty,
      mode: nextMode,
      allowNegatives: meta.allowNegativesAvailable
        ? config.allowNegatives
        : false,
      durationSec:
        config.sessionType === 'sprint' &&
        config.durationSec === prevRecommended
          ? meta.recommendedDuration
          : config.durationSec,
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Workspace Intro + Utility Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 sm:pb-8 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1.5 max-w-2xl">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
            Mental arithmetic at sprint speed
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Pick your school class from Nursery to 12th and jump straight in.
            Phone keyboards, onscreen keypads, and desktop keys all submit with
            zero lag.
          </p>
        </div>

        {/* Utility Toolbar Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
            aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          >
            {muted ? (
              <>
                <VolumeX className="w-4 h-4 text-slate-400" />
                Muted
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Sound On
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-500" />
                Light
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-slate-600" />
                Dark
              </>
            )}
          </button>
        </div>
      </div>

      {/* Balanced 2-Column Desktop Layout / Single-Column Mobile */}
      <div className="mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Dominant Column: Drill Configuration & Primary Launch CTA */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 space-y-6">
          {/* Indian School Class / Grade Selector */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label
                htmlFor="indian-class-select"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white"
              >
                <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                Class / Grade (Indian Curriculum)
              </label>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {classMeta.stage}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
              <select
                id="indian-class-select"
                value={config.indianClass}
                onChange={(e) =>
                  handleClassChange(e.target.value as IndianClass)
                }
                className="sm:col-span-5 w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-semibold text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {INDIAN_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    {formatIndianClassLabel(cls)} ({INDIAN_CLASS_META[cls].stage})
                  </option>
                ))}
              </select>

              <div className="sm:col-span-7 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {classMeta.fullLabel} Level:{' '}
                </span>
                {classMeta.rangeSummary}
              </div>
            </div>
          </div>

          {/* Operation Selector (gated by selected Indian Class) */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                Arithmetic Mode
              </label>
              {allowedModes.length < MODES.length && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Matched to {classMeta.fullLabel} topics
                </span>
              )}
            </div>
            <div
              role="radiogroup"
              aria-label="Arithmetic Mode"
              className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800"
            >
              {MODES.map((mode) => {
                const isAllowed = allowedModes.includes(mode);
                const selected = config.mode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    disabled={!isAllowed}
                    aria-checked={selected}
                    title={
                      isAllowed
                        ? MODE_META[mode].label
                        : `${MODE_META[mode].label} unlocks in higher classes`
                    }
                    onClick={() =>
                      isAllowed && onChangeConfig({ ...config, mode })
                    }
                    className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 ${
                      !isAllowed
                        ? 'opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-600'
                        : selected
                        ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    {!isAllowed && <Lock className="w-3 h-3 shrink-0" />}
                    <span>{MODE_META[mode].shortLabel}</span>
                    {mode !== 'mixed' && (
                      <span className="font-mono text-xs opacity-75">
                        {MODE_META[mode].symbol}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Session Type & Sprint Timer */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
            <div
              className={
                config.sessionType === 'sprint'
                  ? 'sm:col-span-7 space-y-2.5'
                  : 'sm:col-span-12 space-y-2.5'
              }
            >
              <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                Session Format
              </label>
              <div
                role="radiogroup"
                aria-label="Session Format"
                className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800"
              >
                {SESSION_TYPES.map((st) => {
                  const selected = config.sessionType === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() =>
                        onChangeConfig({ ...config, sessionType: st })
                      }
                      className={`min-h-[44px] px-1.5 sm:px-2.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap truncate ${
                        selected
                          ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      {SESSION_TYPE_META[st].label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {SESSION_TYPE_META[config.sessionType].description}
              </p>
            </div>

            {config.sessionType === 'sprint' && (
              <div className="sm:col-span-5 space-y-2.5">
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                  Duration
                </label>
                <div
                  role="radiogroup"
                  aria-label="Sprint Duration"
                  className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800"
                >
                  {DURATIONS.map((sec) => {
                    const selected = config.durationSec === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          onChangeConfig({ ...config, durationSec: sec })
                        }
                        className={`min-h-[44px] px-2 py-2 rounded-lg font-mono text-sm font-semibold tabular-nums transition-colors whitespace-nowrap ${
                          selected
                            ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                        }`}
                      >
                        {sec}s
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Drill Modifiers */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center justify-between gap-3 py-2 cursor-pointer select-none">
              <div>
                <span className="block text-sm font-medium text-slate-900 dark:text-white">
                  Instant auto-submit
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Advance immediately on exact answer
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config.autoSubmit}
                onClick={() =>
                  onChangeConfig({ ...config, autoSubmit: !config.autoSubmit })
                }
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  config.autoSubmit
                    ? 'bg-blue-600'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                    config.autoSubmit ? 'translate-x-5.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>

            <label
              className={`flex items-center justify-between gap-3 py-2 select-none ${
                classMeta.allowNegativesAvailable
                  ? 'cursor-pointer'
                  : 'opacity-55 cursor-not-allowed'
              }`}
            >
              <div>
                <span className="block text-sm font-medium text-slate-900 dark:text-white">
                  Allow negatives (±)
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {classMeta.allowNegativesAvailable
                    ? 'Include negative subtraction answers'
                    : 'Unlocked from Class 6th onwards'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                disabled={!classMeta.allowNegativesAvailable}
                aria-checked={
                  classMeta.allowNegativesAvailable && config.allowNegatives
                }
                onClick={() =>
                  classMeta.allowNegativesAvailable &&
                  onChangeConfig({
                    ...config,
                    allowNegatives: !config.allowNegatives,
                  })
                }
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  classMeta.allowNegativesAvailable && config.allowNegatives
                    ? 'bg-blue-600'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                    classMeta.allowNegativesAvailable && config.allowNegatives
                      ? 'translate-x-5.5'
                      : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>
          </div>

          {/* Dominant Single Primary CTA */}
          <div className="pt-2 space-y-2.5">
            <button
              type="button"
              onClick={onStart}
              className="w-full min-h-[54px] px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-display text-base sm:text-lg font-bold tracking-tight inline-flex items-center justify-center gap-2.5 transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
            >
              <Play className="w-5 h-5 fill-current" />
              {startLabel}
            </button>
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              Press{' '}
              <kbd className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                Enter
              </kbd>{' '}
              to launch · Exact integer problems only
            </p>
          </div>
        </section>

        {/* Right Column: Live Top 3 Math Champions, Personal Best & Recent Runs */}
        <aside className="lg:col-span-5 space-y-6">
          {/* Home Page Top 3 Math Champions */}
          <TopChampionsCard onOpenLeaderboard={onOpenLeaderboard} />

          {/* Selected Preset Personal Best */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Personal Best
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatSessionDescriptor(
                    config.mode,
                    config.difficulty,
                    config.sessionType,
                    config.durationSec,
                    config.indianClass
                  )}
                </p>
              </div>
              <Trophy className="w-4 h-4 text-amber-500 shrink-0 mt-1" />
            </div>

            {presetBest ? (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    High Score
                  </span>
                  <span className="font-mono text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
                    {presetBest.score}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Accuracy
                  </span>
                  <span className="font-mono text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
                    {presetBest.accuracy.toFixed(0)}%
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Best Streak
                  </span>
                  <span className="font-mono text-lg font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                    {presetBest.bestStreak}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Avg Response
                  </span>
                  <span className="font-mono text-lg font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                    {(presetBest.avgResponseMs / 1000).toFixed(2)}s
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                No benchmark recorded for this preset yet. Complete your first
                run to set a target.
              </p>
            )}
          </div>

          {/* Recent Runs */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Recent Runs
              </h2>
              {sessions.length > 0 && (
                <button
                  type="button"
                  onClick={onOpenHistory}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
                >
                  All runs
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {recentRuns.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Completed drills appear here immediately with score, accuracy,
                and response speed.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentRuns.map((run) => (
                  <div
                    key={run.id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {formatSessionDescriptor(
                          run.mode,
                          run.difficulty,
                          run.sessionType,
                          run.durationSec,
                          run.grade
                        )}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {run.accuracy.toFixed(0)}% accuracy ·{' '}
                        {(run.avgResponseMs / 1000).toFixed(2)}s avg · streak{' '}
                        {run.bestStreak}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono text-lg font-bold text-slate-950 dark:text-white tabular-nums">
                        {run.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Persistence Mode Context Line */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              {user && isConfigured ? (
                <span className="inline-flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  Synced live with Cloud Firestore
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 shrink-0" />
                    Quick-play guest mode
                  </span>
                  {isConfigured && (
                    <button
                      type="button"
                      onClick={() => void signInWithGoogle()}
                      className="font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
                    >
                      Sign in with Google
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
