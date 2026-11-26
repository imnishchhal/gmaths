import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Cloud,
  HardDrive,
  Lightbulb,
  Lock,
  RotateCcw,
  SlidersHorizontal,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { usePlatform } from '../context/PlatformContext';
import {
  MathProblem,
  SessionRecord,
  formatSessionDescriptor,
} from '../types/math';
import trophyImg from '../assets/images/kids_celebration_trophy_1795666289983.jpg';
import {
  buildAdaptiveWeakSpotQueue,
  selectTopWeakSpotInsights,
} from '../utils/mentalMathTips';

interface SessionSummaryViewProps {
  session: SessionRecord;
  isNewPersonalBest: boolean;
  savedToCloud: boolean;
  leaderboardUpdated: boolean;
  onPlayAgain: () => void;
  onBackToSetup: () => void;
  onBackToParent?: () => void;
  onStartWeakSpotsDrill?: (queue: MathProblem[]) => void;
  activeStudentLabel?: string;
}

type LogFilter = 'all' | 'missed' | 'slowest';

export const SessionSummaryView: React.FC<SessionSummaryViewProps> = ({
  session,
  isNewPersonalBest,
  savedToCloud,
  leaderboardUpdated,
  onPlayAgain,
  onBackToSetup,
  onBackToParent,
  onStartWeakSpotsDrill,
  activeStudentLabel,
}) => {
  const { user, isConfigured, signInWithGoogle } = useFirebase();
  const { isProSubscriber, freeAdaptiveUsedCount, openCheckoutModal } =
    usePlatform();
  const [logFilter, setLogFilter] = useState<LogFilter>('all');
  const [trophyError, setTrophyError] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'BUTTON' || target.tagName === 'INPUT')) {
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        onPlayAgain();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onPlayAgain]);

  const attempts = useMemo(() => session.attempts ?? [], [session.attempts]);

  const weakSpotInsights = useMemo(
    () => selectTopWeakSpotInsights(attempts, 3),
    [attempts]
  );

  const canLaunchFreeAdaptive = isProSubscriber || freeAdaptiveUsedCount < 1;

  const handlePracticeWeakSpots = () => {
    if (!canLaunchFreeAdaptive) {
      openCheckoutModal('plan');
      return;
    }
    const queue = buildAdaptiveWeakSpotQueue(
      attempts,
      session.allowNegatives,
      5
    );
    if (queue.length > 0 && onStartWeakSpotsDrill) {
      onStartWeakSpotsDrill(queue);
    }
  };

  const filteredAttempts = useMemo(() => {
    if (logFilter === 'missed') {
      return attempts.filter((a) => a.outcome !== 'correct');
    }
    if (logFilter === 'slowest') {
      return [...attempts].sort((a, b) => b.responseMs - a.responseMs);
    }
    return attempts;
  }, [attempts, logFilter]);

  const missedCount = useMemo(
    () => attempts.filter((a) => a.outcome !== 'correct').length,
    [attempts]
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Main Scoreboard Card */}
      <section className="rounded-3xl border-2 border-amber-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-[0_6px_0_0_rgba(253,230,138,0.45)] dark:shadow-none p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl border-2 border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30 overflow-hidden shrink-0 flex items-center justify-center">
              {!trophyError ? (
                <img
                  src={trophyImg}
                  alt="Celebration golden star trophy with smiling stars"
                  referrerPolicy="no-referrer"
                  onError={() => setTrophyError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Trophy className="w-10 h-10 text-amber-500" />
              )}
            </div>

            <div className="space-y-1.5 min-w-0">
              {activeStudentLabel && (
                <p className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  {activeStudentLabel}
                </p>
              )}
              <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                {session.drillVariant === 'weak_spots'
                  ? 'Practice Weak Spots (5 Qs)'
                  : session.drillVariant === 'daily_challenge'
                  ? 'Daily Challenge · '
                  : ''}
                {session.drillVariant !== 'weak_spots' &&
                  formatSessionDescriptor(
                    session.mode,
                    session.difficulty,
                    session.sessionType,
                    session.durationSec,
                    session.grade
                  )}
              </p>
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight text-slate-950 dark:text-white tabular-nums">
                  {session.score}
                </h1>
                <span className="font-display text-lg sm:text-xl font-bold text-slate-600 dark:text-slate-300">
                  {session.score === 1 ? 'correct answer!' : 'correct answers!'}
                </span>
              </div>
              {isNewPersonalBest && session.score > 0 && (
                <p className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-600 dark:text-amber-400 pt-1">
                  <Trophy className="w-4 h-4 shrink-0" />
                  New Personal Best!
                </p>
              )}
            </div>
          </div>

          {/* Primary & Secondary Restart Actions */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onPlayAgain}
              className="flex-1 sm:flex-initial min-h-[48px] px-5 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 border-b-4 border-orange-700 active:border-b-0 active:translate-y-[2px] text-white font-display text-sm sm:text-base font-bold inline-flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
            {onBackToParent ? (
              <button
                type="button"
                onClick={onBackToParent}
                className="flex-1 sm:flex-initial min-h-[48px] px-4 py-2.5 rounded-2xl border-2 border-sky-200 dark:border-slate-700 bg-sky-50/70 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 text-sky-800 dark:text-slate-100 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                Parent Portal
              </button>
            ) : (
              <button
                type="button"
                onClick={onBackToSetup}
                className="flex-1 sm:flex-initial min-h-[48px] px-4 py-2.5 rounded-2xl border-2 border-sky-200 dark:border-slate-700 bg-sky-50/70 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 text-sky-800 dark:text-slate-100 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Change Setup
              </button>
            )}
          </div>
        </div>

        {/* 4-Column Tabular KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t-2 border-amber-50 dark:border-slate-800">
          <div className="rounded-2xl bg-sky-50/80 dark:bg-slate-950/60 border border-sky-100 dark:border-slate-800 p-3.5">
            <span className="block text-xs font-bold text-sky-700 dark:text-sky-300">
              Accuracy
            </span>
            <span className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
              {session.accuracy.toFixed(1)}%
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
              {session.correct} / {session.attempted} tried
            </span>
          </div>

          <div className="rounded-2xl bg-amber-50/80 dark:bg-slate-950/60 border border-amber-100 dark:border-slate-800 p-3.5">
            <span className="block text-xs font-bold text-amber-700 dark:text-amber-300">
              Best Streak
            </span>
            <span className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
              {session.bestStreak}
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              in a row
            </span>
          </div>

          <div className="rounded-2xl bg-violet-50/80 dark:bg-slate-950/60 border border-violet-100 dark:border-slate-800 p-3.5">
            <span className="block text-xs font-bold text-violet-700 dark:text-violet-300">
              Avg Speed
            </span>
            <span className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
              {(session.avgResponseMs / 1000).toFixed(2)}s
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
              {session.avgResponseMs} ms / Q
            </span>
          </div>

          <div className="rounded-2xl bg-emerald-50/80 dark:bg-slate-950/60 border border-emerald-100 dark:border-slate-800 p-3.5">
            <span className="block text-xs font-bold text-emerald-700 dark:text-emerald-300">
              Pace
            </span>
            <span className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
              {session.qpm.toFixed(1)}
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
              solved / min ({session.elapsedSec.toFixed(1)}s)
            </span>
          </div>
        </div>

        {/* Persistence Confirmation Footer */}
        <div className="pt-4 border-t-2 border-amber-50 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          {savedToCloud ? (
            <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
              <Cloud className="w-4 h-4 shrink-0" />
              {leaderboardUpdated
                ? 'Saved to Cloud Firestore and posted to Leaderboard.'
                : 'Saved to Cloud Firestore history.'}
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-2">
                <HardDrive className="w-4 h-4 shrink-0" />
                Saved locally on this browser.
              </span>
              {!user && isConfigured && (
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="font-bold text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
                >
                  Sign in with Google to sync &amp; join Leaderboard
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* Top 3 Slowest / Missed Problems & Adaptive Weak-Spot Drill */}
      {weakSpotInsights.length > 0 && (
        <section className="rounded-3xl border-2 border-sky-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Lightbulb className="w-4 h-4 shrink-0" />
                <span>Math Coach Tips</span>
              </div>
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                Top {weakSpotInsights.length} Questions to Level Up
              </h2>
            </div>

            {onStartWeakSpotsDrill && (
              <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handlePracticeWeakSpots}
                  className={`min-h-[46px] px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all whitespace-nowrap ${
                    canLaunchFreeAdaptive
                      ? 'bg-emerald-500 hover:bg-emerald-600 border-b-4 border-emerald-700 active:border-b-0 active:translate-y-[2px] text-white'
                      : 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100'
                  }`}
                >
                  {canLaunchFreeAdaptive ? (
                    <Target className="w-4 h-4 shrink-0" />
                  ) : (
                    <Lock className="w-4 h-4 shrink-0" />
                  )}
                  Practice Weak Spots (5 Qs)
                </button>
                {!isProSubscriber && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {freeAdaptiveUsedCount < 1
                      ? '1 free adaptive drill available'
                      : 'Unlimited drills included in Annual Pro'}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {weakSpotInsights.map((item, idx) => (
              <article
                key={`${item.attempt.problemId}_tip_${idx}`}
                className="rounded-2xl border-2 border-sky-100 dark:border-slate-800 bg-sky-50/40 dark:bg-slate-950/60 p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      item.rankReason === 'missed'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {item.rankReason === 'missed' ? 'Missed' : 'Slowest'}
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                    {(item.attempt.responseMs / 1000).toFixed(2)}s
                  </span>
                </div>

                <p className="font-display text-xl font-bold text-slate-950 dark:text-white tabular-nums">
                  {item.attempt.expression} = {item.attempt.expected}
                </p>

                <div className="pt-1.5 border-t border-sky-100 dark:border-slate-800 space-y-0.5">
                  <p className="text-xs font-bold text-sky-700 dark:text-sky-400">
                    {item.tipTitle}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {item.tipDetail}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Question-by-Question Review Table */}
      {attempts.length > 0 && (
        <section className="rounded-3xl border-2 border-sky-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                Question Breakdown
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inspect slow equations or misses to sharpen your mental shortcuts.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-2xl bg-sky-100/80 dark:bg-slate-950 border-2 border-sky-200/80 dark:border-slate-800 w-full sm:w-auto">
              {(
                [
                  { id: 'all', label: `All (${attempts.length})` },
                  { id: 'missed', label: `Missed (${missedCount})` },
                  { id: 'slowest', label: 'Slowest' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLogFilter(tab.id)}
                  className={`min-h-[44px] flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                    logFilter === tab.id
                      ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredAttempts.length === 0 ? (
            <p className="py-6 text-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Perfect accuracy — no missed questions in this run!
            </p>
          ) : (
            <>
              {/* Mobile Compact List (< sm) */}
              <div className="sm:hidden divide-y divide-sky-100 dark:divide-slate-800/80">
                {filteredAttempts.map((item, idx) => (
                  <div
                    key={`${item.problemId}_m_${idx}`}
                    className="py-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-display text-base font-bold text-slate-950 dark:text-white tabular-nums">
                        {item.expression} = {item.expected}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        Yours: {item.userAnswer || '—'} · {(item.responseMs / 1000).toFixed(2)}s
                      </p>
                    </div>
                    <div className="shrink-0">
                      {item.outcome === 'correct' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                          <Check className="w-4 h-4" />
                          Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                          <X className="w-4 h-4" />
                          {item.outcome === 'skipped' ? 'Skipped' : 'Wrong'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tablet/Desktop Table (>= sm) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-sky-100 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 pr-4">Problem</th>
                      <th className="py-2.5 px-4">Your Answer</th>
                      <th className="py-2.5 px-4">Correct</th>
                      <th className="py-2.5 px-4">Result</th>
                      <th className="py-2.5 pl-4 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100/70 dark:divide-slate-800/80 text-sm">
                    {filteredAttempts.map((item, idx) => (
                      <tr key={`${item.problemId}_${idx}`}>
                        <td className="py-2.5 pr-4 font-display text-base font-bold text-slate-950 dark:text-white tabular-nums whitespace-nowrap">
                          {item.expression}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                          {item.userAnswer || '—'}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-950 dark:text-white tabular-nums whitespace-nowrap">
                          {item.expected}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {item.outcome === 'correct' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              <Check className="w-4 h-4" />
                              Correct
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                              <X className="w-4 h-4" />
                              {item.outcome === 'skipped' ? 'Skipped' : 'Wrong'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pl-4 text-right font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                          {(item.responseMs / 1000).toFixed(2)}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
};
