import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
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
import { soundEngine } from '../utils/sound';
import { NumericKeypad } from './NumericKeypad';

interface ActiveDrillProps {
  config: DrillConfig;
  muted: boolean;
  onToggleMute: () => void;
  onComplete: (record: SessionRecord) => void;
  onExit: () => void;
}

interface FeedbackBanner {
  id: number;
  kind: 'correct' | 'wrong' | 'skipped';
  message: string;
}

export const ActiveDrill: React.FC<ActiveDrillProps> = ({
  config,
  muted,
  onToggleMute,
  onComplete,
  onExit,
}) => {
  const [problem, setProblem] = useState<MathProblem>(() =>
    generateProblem(config.mode, config.difficulty, config.allowNegatives)
  );
  const [inputValue, setInputValue] = useState<string>('');
  const [score, setScore] = useState<number>(0);
  const [attempted, setAttempted] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [totalResponseMs, setTotalResponseMs] = useState<number>(0);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);
  const [showDesktopKeypad, setShowDesktopKeypad] = useState<boolean>(false);

  // Refs prevent stale closures during rapid desktop typing or fast mobile tapping
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
          ? Math.round(((finalScore / actualElapsedSec) * 60) * 10) / 10
          : 0;

      const record: SessionRecord = {
        id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        mode: config.mode,
        difficulty: config.difficulty,
        sessionType: config.sessionType,
        durationSec: config.sessionType === 'sprint' ? config.durationSec : 0,
        elapsedSec: Math.round(actualElapsedSec * 10) / 10,
        score: finalScore,
        attempted: finalAttempted,
        correct: finalScore,
        accuracy,
        bestStreak: finalBestStreak,
        avgResponseMs,
        qpm,
        allowNegatives: config.allowNegatives,
        createdAtMs: Date.now(),
        source: 'local',
        attempts: [...attemptsLogRef.current],
      };

      onComplete(record);
    },
    [config, onComplete]
  );

  // High-precision wall-clock timer (zero interval drift)
  useEffect(() => {
    startTimeRef.current = performance.now();
    const timer = window.setInterval(() => {
      if (finishedRef.current) return;
      const elapsed = performance.now() - startTimeRef.current;
      setElapsedMs(elapsed);

      if (config.sessionType === 'sprint') {
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
  }, [config.durationSec, config.sessionType, finalizeSession]);

  // Auto-focus desktop input on mount without popping mobile keyboard
  useEffect(() => {
    const isCoarsePointer =
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches;
    if (!isCoarsePointer) {
      answerInputElRef.current?.focus();
    }
  }, []);

  const advanceProblem = useCallback(() => {
    const next = generateProblem(
      config.mode,
      config.difficulty,
      config.allowNegatives,
      problemRef.current.signature
    );
    problemRef.current = next;
    inputRef.current = '';
    setProblem(next);
    setInputValue('');
  }, [config.allowNegatives, config.difficulty, config.mode]);

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
              ? `Streak ×${streakRef.current} · ${(responseMs / 1000).toFixed(2)}s`
              : `Correct · ${(responseMs / 1000).toFixed(2)}s`,
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
              : `Incorrect · Answer was ${current.answer}`,
        });

        // In Streak Run, one mistake ends the session immediately
        if (config.sessionType === 'streak') {
          window.setTimeout(() => finalizeSession(), 240);
          return;
        }
        advanceProblem();
      }
    },
    [advanceProblem, config.sessionType, finalizeSession]
  );

  const evaluateValue = useCallback(
    (nextVal: string, explicitSubmit: boolean) => {
      if (finishedRef.current) return;
      const expectedStr = String(problemRef.current.answer);

      // Instant auto-submit on exact string match
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

  const handleDigit = useCallback(
    (digit: string) => {
      if (finishedRef.current) return;
      const prev = inputRef.current;
      // Avoid leading zero clutter like "00" unless negative
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

  // Global desktop keyboard capture (works seamlessly without clicking an input)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (finishedRef.current || e.metaKey || e.ctrlKey || e.altKey) return;

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
    config.sessionType === 'sprint'
      ? Math.max(0, config.durationSec * 1000 - elapsedMs)
      : elapsedMs;
  const displayClock =
    config.sessionType === 'sprint'
      ? `${(remainingMs / 1000).toFixed(1)}s`
      : `${Math.floor(elapsedMs / 1000)}s`;
  const progressPct =
    config.sessionType === 'sprint'
      ? Math.max(
          0,
          Math.min(100, (remainingMs / (config.durationSec * 1000)) * 100)
        )
      : 100;
  const isLowTime = config.sessionType === 'sprint' && remainingMs <= 10000;

  const liveAccuracy =
    attempted > 0 ? Math.round((score / attempted) * 100) : 100;
  const liveAvgSec =
    attempted > 0 ? (totalResponseMs / attempted / 1000).toFixed(2) : '0.00';

  const answerBoxTone =
    feedback?.kind === 'correct'
      ? 'border-emerald-500 dark:border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/25'
      : feedback?.kind === 'wrong' || feedback?.kind === 'skipped'
      ? 'border-red-500 dark:border-red-400 bg-red-50/40 dark:bg-red-950/25 animate-shake'
      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900';

  return (
    <div className="h-[100dvh] w-full flex flex-col justify-between overflow-hidden bg-slate-50 dark:bg-slate-950 select-none">
      {/* Compact Top Drill HUD (<= 56px, well within mobile sticky cap) */}
      <div className="shrink-0 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Left: Exit / Finish */}
          <button
            type="button"
            onClick={() => {
              if (config.sessionType === 'practice' && attempted > 0) {
                finalizeSession();
              } else {
                onExit();
              }
            }}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <X className="w-4 h-4" />
            <span>
              {config.sessionType === 'practice' && attempted > 0
                ? 'Finish'
                : 'Exit'}
            </span>
          </button>

          {/* Center: High-Contrast Tabular Timer */}
          <div
            className={`inline-flex items-center gap-1.5 font-mono text-lg sm:text-xl font-bold tabular-nums ${
              isLowTime
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-950 dark:text-white'
            }`}
            aria-live="off"
          >
            <Timer className="w-4 h-4 shrink-0" />
            <span>{displayClock}</span>
          </div>

          {/* Right: Live Score, Streak & Mute */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="flex items-center gap-3 font-mono text-sm sm:text-base tabular-nums">
              <span className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-sans">
                Score{' '}
                <strong className="font-mono font-bold text-slate-950 dark:text-white text-base sm:text-lg">
                  {score}
                </strong>
              </span>
              <span
                className={`inline-flex items-center gap-1 font-semibold ${
                  streak >= 5
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
                title="Current Streak"
              >
                <Flame className="w-4 h-4 shrink-0" />
                {streak}
              </span>
            </div>

            <button
              type="button"
              onClick={onToggleMute}
              className="min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            >
              {muted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Hairline Sprint Time Progress Bar */}
        {config.sessionType === 'sprint' && (
          <div className="h-1 w-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
            <div
              className={`h-full transition-transform duration-100 origin-left ${
                isLowTime ? 'bg-red-500' : 'bg-blue-600 dark:bg-blue-500'
              }`}
              style={{ transform: `scaleX(${progressPct / 100})` }}
            />
          </div>
        )}
      </div>

      {/* Center Equation Stage */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-3 sm:py-6">
        <div className="w-full max-w-2xl flex flex-col items-center text-center space-y-4 sm:space-y-6">
          {/* Quiet Unboxed Preset Metadata */}
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            {formatSessionDescriptor(
              config.mode,
              config.difficulty,
              config.sessionType,
              config.durationSec
            )}
          </p>

          {/* Dominant Arithmetic Problem */}
          <div
            key={problem.id}
            className="animate-pop font-mono text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight text-slate-950 dark:text-white tabular-nums leading-none"
          >
            <span>{problem.operandA}</span>
            <span className="mx-3 sm:mx-5 text-blue-600 dark:text-blue-400">
              {problem.symbol}
            </span>
            <span>{problem.operandB}</span>
          </div>

          {/* High-Contrast Tactile Answer Display */}
          <div className="w-full max-w-xs sm:max-w-sm">
            <div
              key={feedback?.id ?? 'idle'}
              className={`relative h-16 sm:h-20 rounded-2xl border-2 flex items-center justify-center px-5 transition-colors duration-150 ${answerBoxTone}`}
            >
              {/* Hidden-native-keyboard input so screen readers and desktop focus work cleanly */}
              <input
                ref={answerInputElRef}
                type="text"
                inputMode="none"
                readOnly
                value={inputValue}
                aria-label={`Answer for ${problem.operandA} ${problem.symbol} ${problem.operandB}`}
                className="w-full bg-transparent text-center font-mono text-3xl sm:text-5xl font-bold text-slate-950 dark:text-white tabular-nums focus:outline-none caret-transparent pointer-events-none"
                placeholder="?"
              />
            </div>
          </div>

          {/* Fixed-Height Non-Blocking Feedback & Live Stats Slot */}
          <div className="h-7 flex items-center justify-center">
            {feedback ? (
              <div
                key={feedback.id}
                className={`animate-pop inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums ${
                  feedback.kind === 'correct'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
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
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                {config.autoSubmit
                  ? 'Type answer — submits automatically on match'
                  : 'Type answer and press Enter to submit'}
              </p>
            )}
          </div>

          {/* Unobtrusive Live Session Telemetry Strip (Unboxed, Tabular) */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 tabular-nums">
            <span>
              Accuracy{' '}
              <strong className="font-mono text-slate-800 dark:text-slate-200">
                {liveAccuracy}%
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Avg{' '}
              <strong className="font-mono text-slate-800 dark:text-slate-200">
                {liveAvgSec}s
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Best Streak{' '}
              <strong className="font-mono text-slate-800 dark:text-slate-200">
                {bestStreak}
              </strong>
            </span>
          </div>

          {/* Desktop Quick Actions Row (Skip / End / Optional Keypad Toggle) */}
          <div className="hidden lg:flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSkip}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors whitespace-nowrap"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Skip (Tab)
            </button>
            <button
              type="button"
              onClick={() => setShowDesktopKeypad((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors whitespace-nowrap"
            >
              <Keyboard className="w-3.5 h-3.5" />
              {showDesktopKeypad ? 'Hide Keypad' : 'Show Keypad'}
            </button>
          </div>
        </div>
      </main>

      {/* Ergonomic Bottom Thumb-Zone Keypad (Always visible on mobile/tablet; toggleable on desktop) */}
      <div
        className={`shrink-0 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/80 dark:bg-slate-950/90 border-t border-slate-200/80 dark:border-slate-800/80 ${
          showDesktopKeypad ? 'block' : 'lg:hidden'
        }`}
      >
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
    </div>
  );
};
