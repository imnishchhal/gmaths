import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Cloud,
  HardDrive,
  RotateCcw,
  SlidersHorizontal,
  Trophy,
  X,
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { SessionRecord, formatSessionDescriptor } from '../types/math';

interface SessionSummaryViewProps {
  session: SessionRecord;
  isNewPersonalBest: boolean;
  savedToCloud: boolean;
  leaderboardUpdated: boolean;
  onPlayAgain: () => void;
  onBackToSetup: () => void;
}

type LogFilter = 'all' | 'missed' | 'slowest';

export const SessionSummaryView: React.FC<SessionSummaryViewProps> = ({
  session,
  isNewPersonalBest,
  savedToCloud,
  leaderboardUpdated,
  onPlayAgain,
  onBackToSetup,
}) => {
  const { user, isConfigured, signInWithGoogle } = useFirebase();
  const [logFilter, setLogFilter] = useState<LogFilter>('all');

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

  const attempts = session.attempts ?? [];

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
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
              {formatSessionDescriptor(
                session.mode,
                session.difficulty,
                session.sessionType,
                session.durationSec
              )}
            </p>
            <div className="flex flex-wrap items-baseline gap-4">
              <h1 className="font-mono text-5xl sm:text-6xl font-bold tracking-tight text-slate-950 dark:text-white tabular-nums">
                {session.score}
              </h1>
              <span className="text-base sm:text-lg font-medium text-slate-500 dark:text-slate-400">
                correct {session.score === 1 ? 'answer' : 'answers'}
              </span>
            </div>
            {isNewPersonalBest && session.score > 0 && (
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400 pt-1">
                <Trophy className="w-4 h-4 shrink-0" />
                New Personal Best for this configuration
              </p>
            )}
          </div>

          {/* Primary & Secondary Restart Actions */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onPlayAgain}
              className="flex-1 sm:flex-initial min-h-[48px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
            <button
              type="button"
              onClick={onBackToSetup}
              className="flex-1 sm:flex-initial min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Change Setup
            </button>
          </div>
        </div>

        {/* 4-Column Tabular KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div>
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Accuracy
            </span>
            <span className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
              {session.accuracy.toFixed(1)}%
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
              {session.correct} / {session.attempted} attempted
            </span>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Best Streak
            </span>
            <span className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
              {session.bestStreak}
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              consecutive hits
            </span>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Avg Response
            </span>
            <span className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
              {(session.avgResponseMs / 1000).toFixed(2)}s
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
              {session.avgResponseMs} ms / question
            </span>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Speed Pace
            </span>
            <span className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
              {session.qpm.toFixed(1)}
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
              solved / min ({session.elapsedSec.toFixed(1)}s)
            </span>
          </div>
        </div>

        {/* Persistence Confirmation Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          {savedToCloud ? (
            <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
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
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
                >
                  Sign in with Google to sync &amp; join Leaderboard
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* Question-by-Question Review Table */}
      {attempts.length > 0 && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Question Breakdown
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inspect slow equations or misses to sharpen your mental shortcuts.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 w-full sm:w-auto">
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
                  className={`min-h-[44px] flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    logFilter === tab.id
                      ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredAttempts.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Perfect accuracy — no missed questions in this run.
            </p>
          ) : (
            <>
              {/* Mobile Compact List (< sm) */}
              <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredAttempts.map((item, idx) => (
                  <div
                    key={`${item.problemId}_m_${idx}`}
                    className="py-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                        {item.expression} = {item.expected}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        Yours: {item.userAnswer || '—'} · {(item.responseMs / 1000).toFixed(2)}s
                      </p>
                    </div>
                    <div className="shrink-0">
                      {item.outcome === 'correct' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                          <Check className="w-3.5 h-3.5" />
                          Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
                          <X className="w-3.5 h-3.5" />
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
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 pr-4">Problem</th>
                      <th className="py-2.5 px-4">Your Answer</th>
                      <th className="py-2.5 px-4">Correct</th>
                      <th className="py-2.5 px-4">Result</th>
                      <th className="py-2.5 pl-4 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                    {filteredAttempts.map((item, idx) => (
                      <tr key={`${item.problemId}_${idx}`}>
                        <td className="py-2.5 pr-4 font-mono font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                          {item.expression}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                          {item.userAnswer || '—'}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                          {item.expected}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {item.outcome === 'correct' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              <Check className="w-3.5 h-3.5" />
                              Correct
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                              <X className="w-3.5 h-3.5" />
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
