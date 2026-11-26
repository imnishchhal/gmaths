import React, { useMemo } from 'react';
import { Lock, Play, Sparkles, Ticket } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { usePlatform } from '../context/PlatformContext';
import {
  ArithmeticMode,
  DIFFICULTY_META,
  Difficulty,
  MODE_META,
  getPresetKey,
} from '../types/math';
import {
  ANNUAL_PLAN_PRICE_INR,
  REFERRAL_DISCOUNT_INR,
  formatCurrency,
} from '../types/platform';

interface StatsViewProps {
  onStartDrill: () => void;
}

const MODES: ArithmeticMode[] = [
  'mixed',
  'addition',
  'subtraction',
  'multiplication',
  'division',
];

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export const StatsView: React.FC<StatsViewProps> = ({ onStartDrill }) => {
  const { sessions, personalBests } = useFirebase();
  const { isProSubscriber, openCheckoutModal } = usePlatform();

  const summary = useMemo(() => {
    if (sessions.length === 0) {
      return null;
    }
    let totalCorrect = 0;
    let totalAttempted = 0;
    let longestStreak = 0;
    let fastestAvgMs = Infinity;
    let weightedMsSum = 0;

    for (const s of sessions) {
      totalCorrect += s.correct;
      totalAttempted += s.attempted;
      if (s.bestStreak > longestStreak) longestStreak = s.bestStreak;
      if (s.attempted > 0 && s.avgResponseMs > 0) {
        weightedMsSum += s.avgResponseMs * s.attempted;
        if (s.score >= 5 && s.avgResponseMs < fastestAvgMs) {
          fastestAvgMs = s.avgResponseMs;
        }
      }
    }

    const lifetimeAccuracy =
      totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;
    const overallAvgMs =
      totalAttempted > 0 ? Math.round(weightedMsSum / totalAttempted) : 0;

    return {
      totalRuns: sessions.length,
      totalCorrect,
      totalAttempted,
      lifetimeAccuracy,
      longestStreak,
      overallAvgMs,
      fastestAvgMs: Number.isFinite(fastestAvgMs) ? fastestAvgMs : overallAvgMs,
    };
  }, [sessions]);

  const byMode = useMemo(() => {
    return MODES.map((mode) => {
      const subset = sessions.filter((s) => s.mode === mode);
      const runs = subset.length;
      const correct = subset.reduce((acc, s) => acc + s.correct, 0);
      const attempted = subset.reduce((acc, s) => acc + s.attempted, 0);
      const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0;
      const weightedMs = subset.reduce(
        (acc, s) => acc + s.avgResponseMs * s.attempted,
        0
      );
      const avgMs = attempted > 0 ? Math.round(weightedMs / attempted) : 0;
      const bestScore = subset.reduce((max, s) => Math.max(max, s.score), 0);
      return { mode, runs, correct, accuracy, avgMs, bestScore };
    });
  }, [sessions]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      <div className="pb-6 border-b-2 border-sky-100 dark:border-slate-800 space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
          Performance Stats
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Accuracy, response latency, and personal bests across every arithmetic
          mode.
        </p>
      </div>

      {!summary ? (
        <div className="rounded-3xl border-2 border-sky-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-10 text-center space-y-4">
          <p className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Complete your first drill to unlock analytics
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Math Speedster computes real accuracy, response time, and personal
            best benchmarks from your completed runs.
          </p>
          <button
            type="button"
            onClick={onStartDrill}
            className="inline-flex items-center gap-2 min-h-[48px] px-6 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 border-b-4 border-orange-700 active:border-b-0 active:translate-y-[2px] text-white font-display text-sm sm:text-base font-bold transition-all whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-current" />
            Start First Sprint
          </button>
        </div>
      ) : (
        <>
          {/* Lifetime KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-3xl border-2 border-sky-200 dark:border-slate-700/80 bg-sky-50/70 dark:bg-slate-900 p-5 space-y-1">
              <span className="text-xs font-bold text-sky-700 dark:text-sky-300">
                Total Solved
              </span>
              <p className="font-display text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
                {summary.totalCorrect}
              </p>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                across {summary.totalRuns}{' '}
                {summary.totalRuns === 1 ? 'run' : 'runs'}
              </span>
            </div>

            <div className="rounded-3xl border-2 border-emerald-200 dark:border-slate-700/80 bg-emerald-50/70 dark:bg-slate-900 p-5 space-y-1">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                Lifetime Accuracy
              </span>
              <p className="font-display text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
                {summary.lifetimeAccuracy.toFixed(1)}%
              </p>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {summary.totalAttempted} questions attempted
              </span>
            </div>

            <div className="rounded-3xl border-2 border-amber-200 dark:border-slate-700/80 bg-amber-50/70 dark:bg-slate-900 p-5 space-y-1">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                Longest Streak
              </span>
              <p className="font-display text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
                {summary.longestStreak}
              </p>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                consecutive correct answers
              </span>
            </div>

            <div className="rounded-3xl border-2 border-violet-200 dark:border-slate-700/80 bg-violet-50/70 dark:bg-slate-900 p-5 space-y-1">
              <span className="text-xs font-bold text-violet-700 dark:text-violet-300">
                Mean Response
              </span>
              <p className="font-display text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
                {(summary.overallAvgMs / 1000).toFixed(2)}s
              </p>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Fastest avg: {(summary.fastestAvgMs / 1000).toFixed(2)}s
              </span>
            </div>
          </div>

          {/* Operation Breakdown & Mixed Sprint Matrix (Pro Gated) */}
          {isProSubscriber ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <section className="lg:col-span-6 rounded-3xl border-2 border-sky-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                    Breakdown by Operation
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Accuracy bar and mean latency across your completed runs.
                  </p>
                </div>

                <div className="space-y-4">
                  {byMode.map((row) => (
                    <div key={row.mode} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {MODE_META[row.mode].label}
                        </span>
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                          {row.runs > 0
                            ? `${row.accuracy.toFixed(0)}% · ${(row.avgMs / 1000).toFixed(2)}s avg · best ${row.bestScore}`
                            : 'No runs yet'}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-sky-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-500 dark:bg-sky-400 transition-all duration-300"
                          style={{
                            width: `${row.runs > 0 ? Math.max(4, row.accuracy) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="lg:col-span-6 rounded-3xl border-2 border-sky-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                    Mixed Mode Personal Bests
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    High scores across sprint durations and streak survival.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-sky-100 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400">
                        <th className="py-2 pr-3">Difficulty</th>
                        <th className="py-2 px-3 text-right">30s</th>
                        <th className="py-2 px-3 text-right">60s</th>
                        <th className="py-2 px-3 text-right">90s</th>
                        <th className="py-2 pl-3 text-right">Streak</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100/70 dark:divide-slate-800 text-sm">
                      {DIFFICULTIES.map((diff) => {
                        const b30 = personalBests[getPresetKey('mixed', diff, 'sprint', 30)];
                        const b60 = personalBests[getPresetKey('mixed', diff, 'sprint', 60)];
                        const b90 = personalBests[getPresetKey('mixed', diff, 'sprint', 90)];
                        const bSt = personalBests[getPresetKey('mixed', diff, 'streak', 0)];
                        return (
                          <tr key={diff}>
                            <td className="py-3 pr-3 font-bold text-slate-900 dark:text-white">
                              {DIFFICULTY_META[diff].label}
                            </td>
                            <td className="py-3 px-3 text-right font-display text-base font-bold text-slate-950 dark:text-white tabular-nums">
                              {b30 ? b30.score : '—'}
                            </td>
                            <td className="py-3 px-3 text-right font-display text-base font-bold text-slate-950 dark:text-white tabular-nums">
                              {b60 ? b60.score : '—'}
                            </td>
                            <td className="py-3 px-3 text-right font-display text-base font-bold text-slate-950 dark:text-white tabular-nums">
                              {b90 ? b90.score : '—'}
                            </td>
                            <td className="py-3 pl-3 text-right font-display text-base font-bold text-slate-950 dark:text-white tabular-nums">
                              {bSt ? bSt.score : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : (
            <section className="rounded-3xl border-2 border-amber-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-[0_6px_0_0_rgba(253,230,138,0.45)] dark:shadow-none p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Annual Pro Analytics</span>
                </div>
                <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
                  Unlock Operation Breakdown &amp; Personal Best Matrix
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  See accuracy and response latency per arithmetic operation (+, −, ×, ÷), unlimited 5-question adaptive weak-spot drills, and custom saved presets for{' '}
                  {formatCurrency(ANNUAL_PLAN_PRICE_INR)}/year (or{' '}
                  {formatCurrency(ANNUAL_PLAN_PRICE_INR - REFERRAL_DISCOUNT_INR)} with a partner referral code).
                </p>
              </div>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openCheckoutModal('plan')}
                  className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 border-b-4 border-orange-700 active:border-b-0 active:translate-y-[2px] text-white font-display text-sm sm:text-base font-bold inline-flex items-center gap-2 transition-all whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  Unlock Annual Pro
                </button>
                <button
                  type="button"
                  onClick={() => openCheckoutModal('voucher')}
                  className="min-h-[48px] px-4 py-2.5 rounded-2xl border-2 border-sky-200 dark:border-slate-700 bg-sky-50/70 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 text-sky-800 dark:text-slate-100 text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <Ticket className="w-4 h-4 shrink-0" />
                  Cash Voucher
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
