import React, { useMemo, useState } from 'react';
import {
  Cloud,
  CloudUpload,
  HardDrive,
  Play,
  Trash2,
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import {
  ArithmeticMode,
  DIFFICULTY_META,
  Difficulty,
  MODE_META,
  formatSessionDescriptor,
} from '../types/math';

interface HistoryViewProps {
  onStartNewDrill: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  onStartNewDrill,
}) => {
  const {
    user,
    isConfigured,
    sessions,
    localOnlySessions,
    syncingCount,
    syncLocalToCloud,
    removeSession,
    clearAllLocalSessions,
  } = useFirebase();

  const [modeFilter, setModeFilter] = useState<'all' | ArithmeticMode>('all');
  const [diffFilter, setDiffFilter] = useState<'all' | Difficulty>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (modeFilter !== 'all' && s.mode !== modeFilter) return false;
      if (diffFilter !== 'all' && s.difficulty !== diffFilter) return false;
      return true;
    });
  }, [sessions, modeFilter, diffFilter]);

  const handleSync = async () => {
    const count = await syncLocalToCloud();
    if (count > 0) {
      setSyncMessage(`Synced ${count} ${count === 1 ? 'run' : 'runs'} to Cloud Firestore.`);
      setTimeout(() => setSyncMessage(null), 3500);
    }
  };

  const formatTimestamp = (ms: number) => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(ms));
    } catch {
      return '';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Session History
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 tabular-nums">
            {sessions.length} recorded {sessions.length === 1 ? 'run' : 'runs'} ·{' '}
            {user && isConfigured
              ? 'Synced across Cloud Firestore and local cache'
              : 'Stored locally in this browser'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {user && isConfigured && localOnlySessions.length > 0 && (
            <button
              type="button"
              disabled={syncingCount > 0}
              onClick={() => void handleSync()}
              className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <CloudUpload className="w-4 h-4" />
              Sync {localOnlySessions.length} Local{' '}
              {localOnlySessions.length === 1 ? 'Run' : 'Runs'}
            </button>
          )}

          {sessions.some((s) => s.source === 'local') && !confirmClear && (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 transition-colors whitespace-nowrap shrink-0"
            >
              Clear Local
            </button>
          )}

          {confirmClear && (
            <div className="inline-flex items-center gap-2 text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                Remove local runs?
              </span>
              <button
                type="button"
                onClick={() => {
                  clearAllLocalSessions();
                  setConfirmClear(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold whitespace-nowrap"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {syncMessage && (
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {syncMessage}
        </p>
      )}

      {/* Interactive Filter Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 w-full sm:w-auto">
          {(['all', 'mixed', 'addition', 'subtraction', 'multiplication', 'division'] as const).map(
            (m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModeFilter(m)}
                className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex-1 sm:flex-initial ${
                  modeFilter === m
                    ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {m === 'all' ? 'All Modes' : MODE_META[m].shortLabel}
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 w-full sm:w-auto">
          {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDiffFilter(d)}
              className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex-1 sm:flex-initial ${
                diffFilter === d
                  ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              {d === 'all' ? 'All Levels' : DIFFICULTY_META[d].label}
            </button>
          ))}
        </div>
      </div>

      {/* Runs List (Mobile Cards < md, Desktop Table >= md) */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-4">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            {sessions.length === 0
              ? 'No completed drills yet'
              : 'No runs match these filters'}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {sessions.length === 0
              ? 'Complete a sprint, streak challenge, or practice drill to start tracking accuracy and speed trends.'
              : 'Try broadening your mode or difficulty filters above.'}
          </p>
          {sessions.length === 0 && (
            <button
              type="button"
              onClick={onStartNewDrill}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              Start a Drill
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {filtered.map((run) => (
              <article
                key={run.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white truncate">
                      {formatSessionDescriptor(
                        run.mode,
                        run.difficulty,
                        run.sessionType,
                        run.durationSec
                      )}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                      {formatTimestamp(run.createdAtMs)} ·{' '}
                      {run.source === 'cloud' ? 'Cloud' : 'Local'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-mono text-xl font-bold text-slate-950 dark:text-white tabular-nums pr-1">
                      {run.score}
                    </span>
                    <button
                      type="button"
                      onClick={() => void removeSession(run)}
                      aria-label="Delete session"
                      className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800 font-mono text-xs tabular-nums">
                  <div>
                    <span className="block font-sans text-[11px] text-slate-500 dark:text-slate-400">
                      Acc
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {run.accuracy.toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <span className="block font-sans text-[11px] text-slate-500 dark:text-slate-400">
                      Streak
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {run.bestStreak}
                    </span>
                  </div>
                  <div>
                    <span className="block font-sans text-[11px] text-slate-500 dark:text-slate-400">
                      Avg
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {(run.avgResponseMs / 1000).toFixed(2)}s
                    </span>
                  </div>
                  <div>
                    <span className="block font-sans text-[11px] text-slate-500 dark:text-slate-400">
                      Q/Min
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {run.qpm.toFixed(1)}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/40">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Drill</th>
                    <th className="py-3 px-4 text-right">Score</th>
                    <th className="py-3 px-4 text-right">Accuracy</th>
                    <th className="py-3 px-4 text-right">Streak</th>
                    <th className="py-3 px-4 text-right">Avg Time</th>
                    <th className="py-3 px-4 text-right">Q/Min</th>
                    <th className="py-3 px-4 text-right">Storage</th>
                    <th className="py-3 px-4 text-right">
                      <span className="sr-only">Delete</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {filtered.map((run) => (
                    <tr
                      key={run.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                        {formatTimestamp(run.createdAtMs)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                        {formatSessionDescriptor(
                          run.mode,
                          run.difficulty,
                          run.sessionType,
                          run.durationSec
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-950 dark:text-white tabular-nums whitespace-nowrap">
                        {run.score}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                        {run.accuracy.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                        {run.bestStreak}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                        {(run.avgResponseMs / 1000).toFixed(2)}s
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                        {run.qpm.toFixed(1)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {run.source === 'cloud' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <Cloud className="w-3.5 h-3.5" />
                            Cloud
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <HardDrive className="w-3.5 h-3.5" />
                            Local
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => void removeSession(run)}
                          aria-label="Delete session"
                          className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
