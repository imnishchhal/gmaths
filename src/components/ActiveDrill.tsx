import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Flame,
  Keyboard,
  SkipForward,
  Timer,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  AttemptLog,
  DrillConfig,
  MathProblem,
  SessionRecord,
  formatSessionDescriptor,
} from '../types/math';
import { generateProblem } from '../utils/problemGenerator';
import { createSeededRng, getTodayDailySeedKey } from '../utils/seededRandom';
import { soundEngine } from '../utils/sound';
import { NumericKeypad } from './NumericKeypad';

const KEYPAD_PREF_KEY = 'gmaths_show_onscreen_keypad_v1';

function loadKeypadPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = window.localStorage.getItem(KEYPAD_PREF_KEY);
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    // Default ON for mobile/touch screens, OFF on wide desktop screens
    return window.innerWidth < 1024;
  } catch {
    return true;
  }
}

interface ActiveDrillProps {
  config: DrillConfig;
  muted: boolean;
  activeStudentLabel?: string;
  onToggleMute: () => void;
  onComplete: (record: SessionRecord) => void;
  onExit: () => void;
  /** Provided when launched from Parent Portal so Parent/Child can jump straight back */
  onBackToParent?: () => void;
}

interface FeedbackBanner {
  id: number;
  kind: 'correct' | 'wrong' | 'skipped';
  message: string;
}

export const ActiveDrill: React.FC<ActiveDrillProps> = ({
  config,
  muted,
  activeStudentLabel,
  onToggleMute,
  onComplete,
  onExit,
  onBackToParent,
}) => {
  const isWeakSpotsDrill =
    config.drillVariant === 'weak_spots' &&
    Array.isArray(config.adaptiveQueue) &&
    config.adaptiveQueue.length > 0;
  const isDailyChallenge = config.drillVariant === 'daily_challenge';
  const effectiveSessionType = isWeakSpotsDrill
    ? 'practice'
    : config.sessionType;

  const seededRngRef = useRef<(() => number) | null>(
    isDailyChallenge
      ? createSeededRng(
          getTodayDailySeedKey(
            config.dailySeed ?? 'DAILY-2026',
            config.indianClass
          )
        )
      : null
  );
  const queueIndexRef = useRef<number>(0);
  const [queueIndex, setQueueIndex] = useState<number>(0);

  const [problem, setProblem] = useState<MathProblem>(() => {
    if (isWeakSpotsDrill && config.adaptiveQueue) {
      return { ...config.adaptiveQueue[0], presentedAt: performance.now() };
    }
    return generateProblem(
      config.mode,
      config.difficulty,
      config.allowNegatives,
      undefined,
      config.indianClass,
      seededRngRef.current ?? Math.random
    );
  });
  const [inputValue, setInputValue] = useState<string>('');
  const [score, setScore] = useState<number>(0);
  const [attempted, setAttempted] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [totalResponseMs, setTotalResponseMs] = useState<number>(0);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);
  const [showOnscreenKeypad, setShowOnscreenKeypad] = useState<boolean>(
    loadKeypadPreference
  );

  // Refs avoid stale closures during rapid desktop/native typing or onscreen keypad taps
  const problemRef = useRef<MathProblem>(problem);
  const inputRef = useRef<string>('');
  const scoreRef = useRef<number>(0);
  const attemptedRef = useRef<number>(0);
  const streakRef = useRef<number>(0);
  const bestStreakRef = useRef<number>(0);
  const totalResponseMsRef = useRef<number>(0);
  const attemptsLogRef = useRef<AttemptLog[]>([]);
  const startTimeRef = useRef<number>(performance.now());
  const finishedRef = useRef<boolean>(false);
  const feedbackSeqRef = useRef<number>(0);
  const lastTickSecRef = useRef<number>(-1);
  const answerInputElRef = useRef<HTMLInputElement>(null);

  const toggleOnscreenKeypad = useCallback(() => {
    setShowOnscreenKeypad((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(KEYPAD_PREF_KEY, String(next));
      } catch {
        // Ignore storage error
      }
      if (!next) {
        window.setTimeout(() => answerInputElRef.current?.focus(), 40);
      }
      return next;
    });
  }, []);

  const finalizeSession = useCallback(
    (forceElapsedSec?: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      const actualElapsedSec =
        forceElapsedSec !== undefined
          ? forceElapsedSec
          : Math.max(0.1, (performance.now() - startTimeRef.current) / 1000);

      const finalScore = scoreRef.current;
      const finalAttempted = attemptedRef.current;
      const finalBestStreak = bestStreakRef.current;
      const accuracy =
        finalAttempted > 0
          ? Math.round((finalScore / finalAttempted) * 1000) / 10
          : 0;
      const avgResponseMs =
        finalAttempted > 0
          ? Math.round(totalResponseMsRef.current / finalAttempted)
          : 0;
      const qpm =
        actualElapsedSec > 0
          ? Math.round((finalScore / actualElapsedSec) * 60 * 10) / 10
          : 0;

      const record: SessionRecord = {
        id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        mode: config.mode,
        difficulty: config.difficulty,
        grade: config.indianClass,
        sessionType: effectiveSessionType,
        durationSec:
          effectiveSessionType === 'sprint' ? config.durationSec : 0,
        elapsedSec: Math.round(actualElapsedSec * 10) / 10,
        score: finalScore,
        attempted: finalAttempted,
        correct: finalScore,
        accuracy,
        bestStreak: finalBestStreak,
        avgResponseMs,
        qpm,
        allowNegatives: config.allowNegatives,
        drillVariant: config.drillVariant ?? 'standard',
        createdAtMs: Date.now(),
        source: 'local',
        attempts: [...attemptsLogRef.current],
      };

      onComplete(record);
    },
    [config, effectiveSessionType, onComplete]
  );

  // High-precision wall-clock timer
  useEffect(() => {
    startTimeRef.current = performance.now();
    const timer = window.setInterval(() => {
      if (finishedRef.current) return;
      const elapsed = performance.now() - startTimeRef.current;
      setElapsedMs(elapsed);

      if (effectiveSessionType === 'sprint') {
        const remainingMs = config.durationSec * 1000 - elapsed;
        const remainingWholeSec = Math.ceil(remainingMs / 1000);

        if (
          remainingWholeSec <= 5 &&
          remainingWholeSec >= 1 &&
          remainingWholeSec !== lastTickSecRef.current
        ) {
          lastTickSecRef.current = remainingWholeSec;
          soundEngine.playTick();
        }

        if (remainingMs <= 0) {
          window.clearInterval(timer);
          finalizeSession(config.durationSec);
        }
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [config.durationSec, effectiveSessionType, finalizeSession]);

  // Auto-focus native input on desktop OR when onscreen keypad is toggled OFF
  useEffect(() => {
    const isCoarsePointer =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;
    if (!isCoarsePointer || !showOnscreenKeypad) {
      answerInputElRef.current?.focus();
    }
  }, [showOnscreenKeypad]);

  const advanceProblem = useCallback(() => {
    if (isWeakSpotsDrill && config.adaptiveQueue) {
      const nextIdx = queueIndexRef.current + 1;
      if (nextIdx >= config.adaptiveQueue.length) {
        window.setTimeout(() => finalizeSession(), 120);
        return;
      }
      queueIndexRef.current = nextIdx;
      setQueueIndex(nextIdx);
      const next = {
        ...config.adaptiveQueue[nextIdx],
        presentedAt: performance.now(),
      };
      problemRef.current = next;
      inputRef.current = '';
      setProblem(next);
      setInputValue('');
      return;
    }

    const next = generateProblem(
      config.mode,
      config.difficulty,
      config.allowNegatives,
      problemRef.current.signature,
      config.indianClass,
      seededRngRef.current ?? Math.random
    );
    problemRef.current = next;
    inputRef.current = '';
    setProblem(next);
    setInputValue('');
  }, [
    config.adaptiveQueue,
    config.allowNegatives,
    config.difficulty,
    config.indianClass,
    config.mode,
    finalizeSession,
    isWeakSpotsDrill,
  ]);

  const recordAttempt = useCallback(
    (outcome: 'correct' | 'wrong' | 'skipped', submittedText: string) => {
      if (finishedRef.current) return;

      const current = problemRef.current;
      const responseMs = Math.max(
        50,
        Math.round(performance.now() - current.presentedAt)
      );

      attemptsLogRef.current.push({
        problemId: current.id,
        expression: `${current.operandA} ${current.symbol} ${current.operandB}`,
        operation: current.operation,
        expected: current.answer,
        userAnswer: submittedText,
        outcome,
        responseMs,
      });

      attemptedRef.current += 1;
      totalResponseMsRef.current += responseMs;
      setAttempted(attemptedRef.current);
      setTotalResponseMs(totalResponseMsRef.current);

      feedbackSeqRef.current += 1;

      if (outcome === 'correct') {
        scoreRef.current += 1;
        streakRef.current += 1;
        if (streakRef.current > bestStreakRef.current) {
          bestStreakRef.current = streakRef.current;
        }
        setScore(scoreRef.current);
        setStreak(streakRef.current);
        setBestStreak(bestStreakRef.current);

        soundEngine.playCorrect(streakRef.current);
        setFeedback({
          id: feedbackSeqRef.current,
          kind: 'correct',
          message:
            streakRef.current >= 5 && streakRef.current % 5 === 0
              ? `Super Streak ×${streakRef.current}! · ${(responseMs / 1000).toFixed(2)}s`
              : `Awesome! · ${(responseMs / 1000).toFixed(2)}s`,
        });
        advanceProblem();
      } else {
        streakRef.current = 0;
        setStreak(0);
        soundEngine.playWrong();
        setFeedback({
          id: feedbackSeqRef.current,
          kind: outcome,
          message:
            outcome === 'skipped'
              ? `Skipped · Answer was ${current.answer}`
              : `Nice try! Answer was ${current.answer}`,
        });

        if (effectiveSessionType === 'streak') {
          window.setTimeout(() => finalizeSession(), 240);
          return;
        }
        advanceProblem();
      }
    },
    [advanceProblem, effectiveSessionType, finalizeSession]
  );

  const evaluateValue = useCallback(
    (nextVal: string, explicitSubmit: boolean) => {
      if (finishedRef.current) return;
      const expectedStr = String(problemRef.current.answer);

      if (config.autoSubmit && nextVal === expectedStr) {
        recordAttempt('correct', nextVal);
        return;
      }

      if (explicitSubmit) {
        if (!nextVal || nextVal === '-') return;
        const parsed = Number(nextVal);
        if (Number.isFinite(parsed) && parsed === problemRef.current.answer) {
          recordAttempt('correct', nextVal);
        } else {
          recordAttempt('wrong', nextVal);
        }
      }
    },
    [config.autoSubmit, recordAttempt]
  );

  const handleNativeInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (finishedRef.current) return;
      let raw = e.target.value;

      if (config.allowNegatives) {
        const isNeg = raw.startsWith('-');
        const digits = raw.replace(/[^0-9]/g, '').slice(0, 6);
        raw = isNeg ? `-${digits}` : digits;
      } else {
        raw = raw.replace(/[^0-9]/g, '').slice(0, 6);
      }

      if (raw.length > 1 && raw.startsWith('0')) {
        raw = raw.replace(/^0+/, '') || '0';
      }

      inputRef.current = raw;
      setInputValue(raw);
      evaluateValue(raw, false);
    },
    [config.allowNegatives, evaluateValue]
  );

  const handleDigit = useCallback(
    (digit: string) => {
      if (finishedRef.current) return;
      const prev = inputRef.current;
      if (prev === '0' && digit === '0') return;
      if (prev.replace('-', '').length >= 6) return;

      const next = prev === '0' ? digit : prev + digit;
      inputRef.current = next;
      setInputValue(next);
      soundEngine.playTap();
      evaluateValue(next, false);
    },
    [evaluateValue]
  );

  const handleBackspace = useCallback(() => {
    if (finishedRef.current || !inputRef.current) return;
    const next = inputRef.current.slice(0, -1);
    inputRef.current = next;
    setInputValue(next);
  }, []);

  const handleClear = useCallback(() => {
    if (finishedRef.current || !inputRef.current) return;
    inputRef.current = '';
    setInputValue('');
  }, []);

  const handleToggleSign = useCallback(() => {
    if (finishedRef.current || !config.allowNegatives) return;
    const prev = inputRef.current;
    const next = prev.startsWith('-') ? prev.slice(1) : `-${prev}`;
    inputRef.current = next;
    setInputValue(next);
    soundEngine.playTap();
    evaluateValue(next, false);
  }, [config.allowNegatives, evaluateValue]);

  const handleSubmit = useCallback(() => {
    evaluateValue(inputRef.current, true);
  }, [evaluateValue]);

  const handleSkip = useCallback(() => {
    recordAttempt('skipped', inputRef.current || '—');
  }, [recordAttempt]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (attemptedRef.current > 0) {
          finalizeSession();
        } else {
          onExit();
        }
      }
    },
    [finalizeSession, handleSkip, handleSubmit, onExit]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (finishedRef.current || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.activeElement === answerInputElRef.current) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === '-') {
        e.preventDefault();
        if (config.allowNegatives) {
          handleToggleSign();
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Delete' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Tab' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (attemptedRef.current > 0) {
          finalizeSession();
        } else {
          onExit();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    config.allowNegatives,
    finalizeSession,
    handleBackspace,
    handleClear,
    handleDigit,
    handleSkip,
    handleSubmit,
    handleToggleSign,
    onExit,
  ]);

  const remainingMs =
    effectiveSessionType === 'sprint'
      ? Math.max(0, config.durationSec * 1000 - elapsedMs)
      : elapsedMs;
  const displayClock =
    effectiveSessionType === 'sprint'
      ? `${(remainingMs / 1000).toFixed(1)}s`
      : `${Math.floor(elapsedMs / 1000)}s`;
  const progressPct =
    effectiveSessionType === 'sprint'
      ? Math.max(
          0,
          Math.min(100, (remainingMs / (config.durationSec * 1000)) * 100)
        )
      : isWeakSpotsDrill && config.adaptiveQueue
      ? Math.max(
          0,
          Math.min(
            100,
            ((queueIndex + 1) / config.adaptiveQueue.length) * 100
          )
        )
      : 100;
  const isLowTime = effectiveSessionType === 'sprint' && remainingMs <= 10000;

  const liveAccuracy =
    attempted > 0 ? Math.round((score / attempted) * 100) : 100;
  const liveAvgSec =
    attempted > 0 ? (totalResponseMs / attempted / 1000).toFixed(2) : '0.00';

  const answerBoxTone =
    feedback?.kind === 'correct'
      ? 'border-emerald-500 dark:border-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-[0_4px_0_0_rgba(16,185,129,0.25)]'
      : feedback?.kind === 'wrong' || feedback?.kind === 'skipped'
      ? 'border-rose-500 dark:border-rose-400 bg-rose-50/70 dark:bg-rose-950/30 animate-shake'
      : 'border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 focus-within:border-sky-500 dark:focus-within:border-sky-400 shadow-[0_4px_0_0_rgba(125,211,252,0.45)] dark:shadow-none';

  return (
    <div className="h-screen-safe w-full max-w-[100vw] overflow-hidden flex flex-col justify-between bg-[#FFFDF5] dark:bg-[#0F172A] kids-canvas-bg">
      {/* Compact Practice Header HUD */}
      <div className="shrink-0 bg-white/95 dark:bg-[#131C33]/95 border-b-2 border-sky-100 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-2 sm:px-6 h-14 flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Left: Back to Parent Portal (if in Child Mode) or Exit / Finish */}
          <div className="flex items-center gap-1 shrink-0">
            {onBackToParent ? (
              <button
                type="button"
                onClick={onBackToParent}
                className="inline-flex items-center justify-center gap-1 min-h-[44px] px-2.5 sm:px-3 rounded-xl border-2 border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 text-xs sm:text-sm font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-950 transition-colors whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span className="hidden xs:inline sm:inline">Parent Portal</span>
                <span className="xs:hidden sm:hidden">Parent</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (effectiveSessionType === 'practice' && attempted > 0) {
                    finalizeSession();
                  } else {
                    onExit();
                  }
                }}
                className="inline-flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-xl text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <X className="w-4 h-4 shrink-0" />
                <span>
                  {effectiveSessionType === 'practice' && attempted > 0
                    ? 'Finish'
                    : 'Exit'}
                </span>
              </button>
            )}

            {onBackToParent &&
              effectiveSessionType === 'practice' &&
              attempted > 0 && (
                <button
                  type="button"
                  onClick={() => finalizeSession()}
                  className="inline-flex items-center justify-center min-h-[44px] px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 border-b-2 border-emerald-700 text-white text-xs font-bold whitespace-nowrap shrink-0"
                >
                  Finish
                </button>
              )}
          </div>

          {/* Center: High-Contrast Tabular Timer */}
          <div
            className={`inline-flex items-center gap-1.5 font-mono text-base sm:text-xl font-bold tabular-nums shrink-0 ${
              isLowTime
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-950 dark:text-white'
            }`}
          >
            <Timer className={`w-4 h-4 shrink-0 ${isLowTime ? 'text-rose-500' : 'text-sky-500'}`} />
            <span>{displayClock}</span>
          </div>

          {/* Right: Live Score, Streak, Onscreen Keypad Toggle & Mute */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 font-mono text-sm tabular-nums mr-0.5">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-sans font-semibold">
                <span className="hidden sm:inline">Score </span>
                <strong className="font-display font-bold text-sky-700 dark:text-sky-300 text-base sm:text-lg">
                  {score}
                </strong>
              </span>
              <span
                className={`inline-flex items-center gap-0.5 font-bold ${
                  streak >= 5
                    ? 'text-orange-500 dark:text-amber-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
                title="Current Streak"
              >
                <Flame className="w-4 h-4 shrink-0 fill-current" />
                {streak}
              </span>
            </div>

            <button
              type="button"
              onClick={toggleOnscreenKeypad}
              aria-pressed={showOnscreenKeypad}
              title={
                showOnscreenKeypad
                  ? 'Hide onscreen keypad (use phone native keyboard)'
                  : 'Show onscreen keypad'
              }
              className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-2.5 rounded-xl border-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                showOnscreenKeypad
                  ? 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Keyboard className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">
                {showOnscreenKeypad ? 'Keypad On' : 'Keypad Off'}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors shrink-0"
              aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            >
              {muted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              )}
            </button>
          </div>
        </div>

        {/* Cheerful Sprint / Weak-Spot Progress Bar */}
        {(effectiveSessionType === 'sprint' || isWeakSpotsDrill) && (
          <div className="h-1.5 w-full bg-sky-100 dark:bg-slate-900 overflow-hidden">
            <div
              className={`h-full transition-transform duration-100 origin-left ${
                isLowTime
                  ? 'bg-rose-500'
                  : isWeakSpotsDrill
                  ? 'bg-emerald-500 dark:bg-emerald-400'
                  : 'bg-sky-500 dark:bg-sky-400'
              }`}
              style={{ transform: `scaleX(${progressPct / 100})` }}
            />
          </div>
        )}
      </div>

      {/* Center Equation & Synced Native Input Stage */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-2 sm:py-5 overflow-y-auto">
        <div className="w-full max-w-xl flex flex-col items-center text-center space-y-2.5 sm:space-y-5">
          {/* Quiet Preset & Student Context */}
          <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400">
            {activeStudentLabel ? `${activeStudentLabel} · ` : ''}
            {isWeakSpotsDrill && config.adaptiveQueue
              ? `Practice Weak Spots · Question ${Math.min(
                  queueIndex + 1,
                  config.adaptiveQueue.length
                )} of ${config.adaptiveQueue.length}`
              : isDailyChallenge
              ? `Daily Challenge (${config.dailySeed || 'Today'}) · ${formatSessionDescriptor(
                  config.mode,
                  config.difficulty,
                  effectiveSessionType,
                  config.durationSec,
                  config.indianClass
                )}`
              : formatSessionDescriptor(
                  config.mode,
                  config.difficulty,
                  effectiveSessionType,
                  config.durationSec,
                  config.indianClass
                )}
          </p>

          {/* Dominant Friendly Arithmetic Problem */}
          <div
            key={problem.id}
            className="animate-pop font-display text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight text-slate-950 dark:text-white tabular-nums leading-none"
          >
            <span>{problem.operandA}</span>
            <span className="mx-3 sm:mx-5 text-orange-500 dark:text-amber-400">
              {problem.symbol}
            </span>
            <span>{problem.operandB}</span>
          </div>

          {/* Real Native Mobile/Desktop Input — Synced Seamlessly with Onscreen Keypad */}
          <div className="w-full max-w-[260px] sm:max-w-sm">
            <div
              key={feedback?.id ?? 'idle'}
              className={`relative h-14 sm:h-20 rounded-3xl border-[3px] flex items-center justify-center px-4 transition-colors duration-150 ${answerBoxTone}`}
            >
              <input
                ref={answerInputElRef}
                type="text"
                inputMode={config.allowNegatives ? 'text' : 'numeric'}
                pattern={config.allowNegatives ? '-?[0-9]*' : '[0-9]*'}
                enterKeyHint="go"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={inputValue}
                onChange={handleNativeInputChange}
                onKeyDown={handleInputKeyDown}
                aria-label={`Answer for ${problem.operandA} ${problem.symbol} ${problem.operandB}`}
                className="w-full h-full bg-transparent text-center font-display text-3xl sm:text-5xl font-bold text-slate-950 dark:text-white tabular-nums focus:outline-none placeholder:text-sky-300 dark:placeholder:text-slate-600"
                placeholder="?"
              />
            </div>
            <p className="mt-1.5 text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
              {showOnscreenKeypad
                ? 'Tap box for phone keyboard or tap the big number buttons below'
                : 'Type your answer · Toggle keypad in header'}
            </p>
          </div>

          {/* Fixed-Height Non-Blocking Feedback Slot */}
          <div className="h-6 flex items-center justify-center">
            {feedback ? (
              <div
                key={feedback.id}
                className={`animate-pop inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold tabular-nums ${
                  feedback.kind === 'correct'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {feedback.kind === 'correct' ? (
                  <Check className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
            ) : (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                Accuracy{' '}
                <strong className="font-mono text-slate-800 dark:text-slate-200">
                  {liveAccuracy}%
                </strong>{' '}
                · Avg{' '}
                <strong className="font-mono text-slate-800 dark:text-slate-200">
                  {liveAvgSec}s
                </strong>{' '}
                · Best{' '}
                <strong className="font-mono text-slate-800 dark:text-slate-200">
                  {bestStreak}
                </strong>
              </p>
            )}
          </div>

          {/* Quick Submit & Skip Buttons When Onscreen Keypad Is Hidden */}
          {!showOnscreenKeypad && (
            <div className="flex items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleSubmit}
                className="min-h-[44px] px-6 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 border-b-4 border-emerald-700 active:border-b-0 active:translate-y-[2px] text-white font-display text-sm font-bold transition-all whitespace-nowrap"
              >
                Submit
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-2xl border-2 border-b-4 border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-sky-50 dark:hover:bg-slate-800 text-sm font-bold text-sky-800 dark:text-sky-300 transition-all whitespace-nowrap"
              >
                <SkipForward className="w-4 h-4" />
                Skip
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Webpage Onscreen Numeric Keypad (Toggleable via Practice Header) */}
      {showOnscreenKeypad && (
        <div className="shrink-0 px-2.5 sm:px-4 pt-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] bg-white/95 dark:bg-[#131C33]/95 border-t-2 border-sky-100 dark:border-slate-800">
          <NumericKeypad
            allowNegatives={config.allowNegatives}
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onClear={handleClear}
            onToggleSign={handleToggleSign}
            onSubmit={handleSubmit}
            onSkip={handleSkip}
          />
        </div>
      )}
    </div>
  );
};
