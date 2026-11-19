import React, { useMemo, useState } from 'react';
import { Cloud, Play, Trophy } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import {
  ArithmeticMode,
  DIFFICULTY_META,
  Difficulty,
  MODE_META,
  SessionType,
} from '../types/math';

interface LeaderboardViewProps {
  onStartPreset: (
    mode: ArithmeticMode,
    difficulty: Difficulty,
    sessionType: SessionType,
    durationSec: 30 | 60 | 90
  ) => void;
}

type BucketOption = {
  id: string;
  label: string;
  sessionType: SessionType;
  durationSec: 0 | 30 | 60 | 90;
};

const BUCKETS: BucketOption[] = [
  { id: 'sprint_30', label: '30s Sprint', sessionType: 'sprint', durationSec: 30 },
  { id: 'sprint_60', label: '60s Sprint', sessionType: 'sprint', durationSec: 60 },
  { id: 'sprint_90', label: '90s Sprint', sessionType: 'sprint', durationSec: 90 },
  { id: 'streak_0', label: 'Streak Run', sessionType: 'streak', durationSec: 0 },
];

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  onStartPreset,
}) => {
  const {
    user,
    isConfigured,
    leaderboard,
    leaderboardLoading,
    personalBests,
    signInWithGoogle,
  } = useFirebase();

  const [mode, setMode] = useState<ArithmeticMode>('mixed');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [bucketId, setBucketId] = useState<string>('sprint_60');

  const activeBucket =
    BUCKETS.find((b) => b.id === bucketId) ?? BUCKETS[1];

  const rankedEntries = useMemo(() => {
    return leaderboard
      .filter(
        (entry) =>
          entry.mode === mode &&
          entry.difficulty === difficulty &&
          entry.sessionType === activeBucket.sessionType &&
          entry.durationSec === activeBucket.durationSec
      )
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
        return a.avgResponseMs - b.avgResponseMs;
      })
      .slice(0, 25);
  }, [leaderboard, mode, difficulty, activeBucket]);

  const localPresetKey = `${mode}_${difficulty}_${activeBucket.sessionType}_${activeBucket.durationSec}`;
  const localBest = personalBests[localPresetKey];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Leaderboard
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Personal-best rankings per arithmetic mode, difficulty, and timer
            bucket.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onStartPreset(
              mode,
              difficulty,
              activeBucket.sessionType,
              activeBucket.durationSec === 0 ? 60 : activeBucket.durationSec
            )
          }
          className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <Play className="w-4 h-4 fill-current" />
          Run This Category
        </button>
      </div>

      {/* Category Filter Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 w-full sm:w-auto">
          {(['mixed', 'addition', 'subtraction', 'multiplication', 'division'] as const).map(
            (m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex-1 sm:flex-initial ${
                  mode === m
                    ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {MODE_META[m].shortLabel}
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 w-full sm:w-auto">
          {(['easy', 'medium', 'hard'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex-1 sm:flex-initial ${
                difficulty === d
                  ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              {DIFFICULTY_META[d].label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 w-full sm:w-auto">
          {BUCKETS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBucketId(b.id)}
              className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                bucketId === b.id
                  ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Signed-Out / Local Fallback Banner */}
      {!user ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                {isConfigured
                  ? 'Sign in to view the Cloud Firestore Leaderboard'
                  : 'Running in Local Storage Mode'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {isConfigured
                  ? 'Sign in with Google to compare personal bests across players and sync your speed-math benchmarks across devices.'
                  : 'Configure Firebase in firebase-applet-config.json to enable shared leaderboards. Your local personal bests are tracked below.'}
              </p>
            </div>
            {isConfigured && (
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                Sign in with Google
              </button>
            )}
          </div>

          {/* Local Best Preview for Selected Category */}
          <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
              Your Local Personal Best · {MODE_META[mode].label} ·{' '}
              {DIFFICULTY_META[difficulty].label} · {activeBucket.label}
            </p>
            {localBest ? (
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-baseline gap-4 sm:gap-6 font-mono tabular-nums">
                <div>
                  <span className="text-xs font-sans text-slate-500 dark:text-slate-400 block">
                    Score
                  </span>
                  <span className="text-2xl font-bold text-slate-950 dark:text-white">
                    {localBest.score}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-sans text-slate-500 dark:text-slate-400 block">
                    Accuracy
                  </span>
                  <span className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                    {localBest.accuracy.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-xs font-sans text-slate-500 dark:text-slate-400 block">
                    Best Streak
                  </span>
                  <span className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                    {localBest.bestStreak}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-sans text-slate-500 dark:text-slate-400 block">
                    Avg Time
                  </span>
                  <span className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                    {(localBest.avgResponseMs / 1000).toFixed(2)}s
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No local run recorded in this category yet.
              </p>
            )}
          </div>
        </div>
      ) : leaderboardLoading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Loading Firestore leaderboard…
        </div>
      ) : rankedEntries.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
          <Trophy className="w-7 h-7 text-amber-500 mx-auto" />
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            No entries in {MODE_META[mode].label} ·{' '}
            {DIFFICULTY_META[difficulty].label} · {activeBucket.label} yet
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Finish a drill in this category to claim the #1 benchmark.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Ranking Cards */}
          <div className="md:hidden space-y-3">
            {rankedEntries.map((entry, index) => {
              const isSelf = entry.userId === user.uid;
              return (
                <article
                  key={entry.id}
                  className={`rounded-2xl border p-4 space-y-3 ${
                    isSelf
                      ? 'border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/25'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`font-mono text-sm font-bold tabular-nums shrink-0 ${
                          index === 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : index === 1
                            ? 'text-slate-600 dark:text-slate-300'
                            : index === 2
                            ? 'text-amber-800 dark:text-amber-600'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        #{index + 1}
                      </span>
                      <span className="font-semibold text-slate-950 dark:text-white truncate">
                        {entry.displayName}
                      </span>
                      {isSelf && (
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                          You
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xl font-bold text-slate-950 dark:text-white tabular-nums shrink-0">
                      {entry.score}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 font-mono text-xs tabular-nums">
                    <div>
                      <span className="block font-sans text-[11px] text-slate-500 dark:text-slate-400">
                        Acc
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {entry.accuracy.toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span className="block font-sans text-[11px] text-slate-500 dark:text-slate-400">
                        Streak
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {entry.bestStreak}
                      </span>
                    </div>
                    <div>
                      <span className="block font-sans text-[11px] text-slate-500 dark:text-slate-400">
                        Avg
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {(entry.avgResponseMs / 1000).toFixed(2)}s
                      </span>
                    </div>
                    <div>
                      <span className="block font-sans text-[11px] text-slate-500 dark:text-slate-400">
                        Q/Min
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {entry.qpm.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/40">
                    <th className="py-3 px-4 w-16">Rank</th>
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-4 text-right">Score</th>
                    <th className="py-3 px-4 text-right">Accuracy</th>
                    <th className="py-3 px-4 text-right">Best Streak</th>
                    <th className="py-3 px-4 text-right">Avg Time</th>
                    <th className="py-3 px-4 text-right">Q/Min</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {rankedEntries.map((entry, index) => {
                    const isSelf = entry.userId === user.uid;
                    return (
                      <tr
                        key={entry.id}
                        className={
                          isSelf
                            ? 'bg-blue-50/60 dark:bg-blue-950/25'
                            : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                        }
                      >
                        <td className="py-3.5 px-4 font-mono font-bold tabular-nums whitespace-nowrap">
                          <span
                            className={
                              index === 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : index === 1
                                ? 'text-slate-600 dark:text-slate-300'
                                : index === 2
                                ? 'text-amber-800 dark:text-amber-600'
                                : 'text-slate-400 dark:text-slate-500'
                            }
                          >
                            #{index + 1}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          <span>{entry.displayName}</span>
                          {isSelf && (
                            <span className="ml-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                              You
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-base font-bold text-slate-950 dark:text-white tabular-nums whitespace-nowrap">
                          {entry.score}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                          {entry.accuracy.toFixed(1)}%
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                          {entry.bestStreak}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                          {(entry.avgResponseMs / 1000).toFixed(2)}s
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                          {entry.qpm.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
