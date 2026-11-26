import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Calendar,
  Cloud,
  Crown,
  GraduationCap,
  HardDrive,
  Lock,
  Moon,
  Play,
  Sparkles,
  Sun,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { usePlatform } from '../context/PlatformContext';
import {
  ArithmeticMode,
  CustomPreset,
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
import {
  ANNUAL_PLAN_PRICE_INR,
  formatCurrency,
  formatIsoDate,
} from '../types/platform';
import mascotImg from '../assets/images/kids_math_mascot_1795666290024.jpg';
import { TopChampionsCard } from './TopChampionsCard';

interface DrillSetupProps {
  config: DrillConfig;
  onChangeConfig: (next: DrillConfig) => void;
  onStart: () => void;
  onStartDailyChallenge?: () => void;
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
  onStartDailyChallenge,
  onOpenHistory,
  onOpenLeaderboard,
  muted,
  onToggleMute,
  darkMode,
  onToggleTheme,
}) => {
  const { user, isConfigured, sessions, personalBests, signInWithGoogle } =
    useFirebase();
  const {
    isProSubscriber,
    myStudentSubscription,
    customPresets,
    saveCustomPreset,
    deleteCustomPreset,
    openCheckoutModal,
    appConfig,
  } = usePlatform();

  const [presetName, setPresetName] = useState('');
  const [mascotError, setMascotError] = useState(false);

  const MODE_ACTIVE_STYLES: Record<ArithmeticMode, string> = {
    mixed:
      'bg-sky-500 text-white shadow-sm border-b-2 border-sky-700',
    addition:
      'bg-emerald-500 text-white shadow-sm border-b-2 border-emerald-700',
    subtraction:
      'bg-orange-500 text-white shadow-sm border-b-2 border-orange-700',
    multiplication:
      'bg-violet-500 text-white shadow-sm border-b-2 border-violet-700',
    division:
      'bg-amber-500 text-slate-950 shadow-sm border-b-2 border-amber-700',
  };

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
      {/* Workspace Intro + Mascot + Utility Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-6 sm:pb-8 border-b-2 border-sky-100 dark:border-slate-800">
        <div className="flex items-center gap-4 sm:gap-5 max-w-2xl">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl border-2 border-sky-200 dark:border-sky-800 bg-sky-100 dark:bg-sky-950/60 overflow-hidden shrink-0 shadow-[0_4px_0_0_rgba(186,230,253,0.7)] dark:shadow-none flex items-center justify-center">
            {!mascotError ? (
              <img
                src={mascotImg}
                alt="Math Speedster friendly owl mascot with glasses and number blocks"
                referrerPolicy="no-referrer"
                onError={() => setMascotError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <GraduationCap className="w-9 h-9 text-sky-600 dark:text-sky-400" />
            )}
          </div>

          <div className="space-y-1">
            <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
              Fun, Fast Math Practice!
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Pick your school class from Nursery to 12th and jump right in.
              Tap the big number buttons or type on any keyboard!
            </p>
          </div>
        </div>

        {/* Utility Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isProSubscriber ? (
            <button
              type="button"
              onClick={() => openCheckoutModal('plan')}
              title={
                myStudentSubscription
                  ? `Pro valid until ${formatIsoDate(
                      myStudentSubscription.expiryDate
                    )}`
                  : 'Annual Pro Active'
              }
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap shrink-0"
            >
              <Crown className="w-4 h-4 shrink-0" />
              Pro Active
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openCheckoutModal('plan')}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-2xl bg-amber-400 hover:bg-amber-500 border-b-[3px] border-amber-600 active:border-b-0 active:translate-y-[2px] text-slate-950 text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              Unlock Pro ({formatCurrency(ANNUAL_PLAN_PRICE_INR)}/yr)
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-2xl border-2 border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-sky-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
            aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          >
            {muted ? (
              <>
                <VolumeX className="w-4 h-4 text-slate-400" />
                Muted
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Sound On
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-2xl border-2 border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-sky-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                Light
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-violet-600" />
                Night
              </>
            )}
          </button>
        </div>
      </div>

      {/* Balanced 2-Column Desktop Layout / Single-Column Mobile */}
      <div className="mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Dominant Column: Drill Configuration & Primary Launch CTA */}
        <section className="lg:col-span-7 rounded-3xl border-2 border-sky-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-[0_6px_0_0_rgba(186,230,253,0.5)] dark:shadow-none p-5 sm:p-7 space-y-6">
          {/* Indian School Class / Grade Selector */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label
                htmlFor="indian-class-select"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white"
              >
                <GraduationCap className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                Pick Your Class (Nursery – 12th)
              </label>
              <span className="text-xs font-bold text-sky-700 dark:text-sky-300">
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
                className="sm:col-span-5 w-full min-h-[48px] px-3.5 py-2.5 rounded-2xl border-2 border-sky-200 dark:border-slate-700 bg-sky-50/70 dark:bg-slate-950 text-sm font-bold text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {INDIAN_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    {formatIndianClassLabel(cls)} ({INDIAN_CLASS_META[cls].stage})
                  </option>
                ))}
              </select>

              <div className="sm:col-span-7 rounded-2xl border-2 border-sky-100 dark:border-slate-800 bg-sky-50/50 dark:bg-slate-950/60 px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <span className="font-bold text-slate-900 dark:text-white">
                  {classMeta.fullLabel} Topics:{' '}
                </span>
                {classMeta.rangeSummary}
              </div>
            </div>
          </div>

          {/* Operation Selector (gated by selected Indian Class) */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label className="block text-sm font-bold text-slate-900 dark:text-white">
                Math Activity
              </label>
              {allowedModes.length < MODES.length && (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Matched to {classMeta.fullLabel} topics
                </span>
              )}
            </div>
            <div
              role="radiogroup"
              aria-label="Arithmetic Mode"
              className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1.5 rounded-2xl bg-sky-50/80 dark:bg-slate-950 border-2 border-sky-100 dark:border-slate-800"
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
                    className={`min-h-[44px] px-3 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
                      !isAllowed
                        ? 'opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-600'
                        : selected
                        ? MODE_ACTIVE_STYLES[mode]
                        : 'text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800'
                    }`}
                  >
                    {!isAllowed && <Lock className="w-3 h-3 shrink-0" />}
                    <span>{MODE_META[mode].shortLabel}</span>
                    {mode !== 'mixed' && (
                      <span className="font-display text-sm opacity-90">
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
              <label className="block text-sm font-bold text-slate-900 dark:text-white">
                Game Mode
              </label>
              <div
                role="radiogroup"
                aria-label="Session Format"
                className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-sky-50/80 dark:bg-slate-950 border-2 border-sky-100 dark:border-slate-800"
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
                      className={`min-h-[44px] px-1.5 sm:px-2.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors whitespace-nowrap truncate ${
                        selected
                          ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-sm'
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
                <label className="block text-sm font-bold text-slate-900 dark:text-white">
                  Timer
                </label>
                <div
                  role="radiogroup"
                  aria-label="Sprint Duration"
                  className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-sky-50/80 dark:bg-slate-950 border-2 border-sky-100 dark:border-slate-800"
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
                        className={`min-h-[44px] px-2 py-2 rounded-xl font-mono text-sm font-bold tabular-nums transition-colors whitespace-nowrap ${
                          selected
                            ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-sm'
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
          <div className="pt-4 border-t-2 border-sky-50 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center justify-between gap-3 py-2 cursor-pointer select-none">
              <div>
                <span className="block text-sm font-bold text-slate-900 dark:text-white">
                  Instant auto-submit
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Jump to next question as soon as you type it right
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config.autoSubmit}
                onClick={() =>
                  onChangeConfig({ ...config, autoSubmit: !config.autoSubmit })
                }
                className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  config.autoSubmit
                    ? 'bg-emerald-500'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
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
                <span className="block text-sm font-bold text-slate-900 dark:text-white">
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
                className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  classMeta.allowNegativesAvailable && config.allowNegatives
                    ? 'bg-emerald-500'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                    classMeta.allowNegativesAvailable && config.allowNegatives
                      ? 'translate-x-5.5'
                      : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>
          </div>

          {/* Dominant Single Primary CTA */}
          <div className="pt-2 space-y-3">
            <button
              type="button"
              onClick={onStart}
              className="w-full min-h-[58px] px-6 py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 border-b-4 border-orange-700 active:border-b-0 active:translate-y-[3px] text-white font-display text-lg sm:text-xl font-bold tracking-tight inline-flex items-center justify-center gap-2.5 transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 shadow-sm"
            >
              <Play className="w-5 h-5 fill-current" />
              {startLabel}
            </button>

            {onStartDailyChallenge && (
              <div className="rounded-2xl border-2 border-amber-300/90 dark:border-amber-800/70 bg-amber-50/90 dark:bg-amber-950/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Daily Challenge · Seed {appConfig.dailyChallengeSeed}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    Same 60s quiz adventure for everyone in{' '}
                    {classMeta.fullLabel}!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onStartDailyChallenge}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 border-b-[3px] border-amber-600 active:border-b-0 active:translate-y-[2px] text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 transition-all"
                >
                  Play Daily Challenge
                </button>
              </div>
            )}

            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              Press{' '}
              <kbd className="font-mono font-bold text-slate-700 dark:text-slate-300">
                Enter
              </kbd>{' '}
              to start · Whole-number answers only
            </p>
          </div>

          {/* Custom Presets (Pro Feature) */}
          <div className="pt-4 border-t-2 border-sky-50 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Bookmark className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>Custom Saved Setups</span>
              </div>
              {!isProSubscriber && (
                <button
                  type="button"
                  onClick={() => openCheckoutModal('plan')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  <Lock className="w-3 h-3 shrink-0" />
                  Unlock with Annual Pro
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Name this setup (e.g. Tables Sprint)"
                className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => {
                  if (!isProSubscriber) {
                    openCheckoutModal('plan');
                    return;
                  }
                  const trimmed = presetName.trim();
                  if (!trimmed) return;
                  saveCustomPreset(trimmed, config);
                  setPresetName('');
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {!isProSubscriber && <Lock className="w-3.5 h-3.5 shrink-0" />}
                Save Preset
              </button>
            </div>

            {customPresets.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {customPresets.map((preset: CustomPreset) => (
                  <div
                    key={preset.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onChangeConfig({
                          ...config,
                          mode: coerceModeForClass(
                            preset.mode,
                            preset.indianClass
                          ),
                          indianClass: preset.indianClass,
                          difficulty:
                            preset.difficulty ??
                            INDIAN_CLASS_META[preset.indianClass].mappedDifficulty,
                          sessionType: preset.sessionType,
                          durationSec: preset.durationSec,
                          allowNegatives: preset.allowNegatives,
                          autoSubmit: preset.autoSubmit,
                        })
                      }
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                        {preset.name}
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {formatIndianClassLabel(preset.indianClass)} ·{' '}
                        {MODE_META[preset.mode].shortLabel} ·{' '}
                        {preset.sessionType === 'sprint'
                          ? `${preset.durationSec}s`
                          : SESSION_TYPE_META[preset.sessionType].label}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCustomPreset(preset.id)}
                      aria-label={`Delete preset ${preset.name}`}
                      className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Live Top 3 Math Champions, Personal Best & Recent Runs */}
        <aside className="lg:col-span-5 space-y-6">
          {/* Home Page Top 3 Math Champions */}
          <TopChampionsCard onOpenLeaderboard={onOpenLeaderboard} />

          {/* Selected Preset Personal Best */}
          <div className="rounded-3xl border-2 border-sky-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-[0_6px_0_0_rgba(186,230,253,0.4)] dark:shadow-none p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
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
              <Trophy className="w-5 h-5 text-amber-500 shrink-0 mt-1" />
            </div>

            {presetBest ? (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t-2 border-sky-50 dark:border-slate-800">
                <div>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    High Score
                  </span>
                  <span className="font-display text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
                    {presetBest.score}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Accuracy
                  </span>
                  <span className="font-display text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
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
              <p className="text-sm text-slate-500 dark:text-slate-400 pt-2 border-t-2 border-sky-50 dark:border-slate-800">
                No benchmark recorded for this setup yet. Finish a round to set
                your first target!
              </p>
            )}
          </div>

          {/* Recent Runs */}
          <div className="rounded-3xl border-2 border-sky-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-[0_6px_0_0_rgba(186,230,253,0.4)] dark:shadow-none p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Recent Runs
              </h2>
              {sessions.length > 0 && (
                <button
                  type="button"
                  onClick={onOpenHistory}
                  className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
                >
                  All runs
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {recentRuns.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Completed drills appear right here with your score, accuracy,
                and speed!
              </p>
            ) : (
              <div className="divide-y divide-sky-100 dark:divide-slate-800">
                {recentRuns.map((run) => (
                  <div
                    key={run.id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
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
                      <span className="font-display text-xl font-bold text-slate-950 dark:text-white tabular-nums">
                        {run.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Persistence Mode Context Line */}
            <div className="pt-3 border-t-2 border-sky-50 dark:border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
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
                      className="font-bold text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
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
