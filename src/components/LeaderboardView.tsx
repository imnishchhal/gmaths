import React, { useMemo, useState } from 'react';
import { Award, Cloud, Crown, GraduationCap, Medal, Play, Trophy } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { usePlatform } from '../context/PlatformContext';
import {
  ArithmeticMode,
  DIFFICULTY_META,
  Difficulty,
  INDIAN_CLASSES,
  IndianClass,
  MODE_META,
  SessionType,
  formatIndianClassLabel,
} from '../types/math';

interface LeaderboardViewProps {
  onStartPreset: (
    mode: ArithmeticMode,
    difficulty: Difficulty,
    sessionType: SessionType,
    durationSec: 30 | 60 | 90
  ) => void;
}

type LeaderboardTab = 'champions' | 'sprints';

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
  const { childLeaderboard, topChampionsLoading } = usePlatform();

  const [tab, setTab] = useState<LeaderboardTab>('champions');
  const [classFilter, setClassFilter] = useState<'all' | IndianClass>('all');

  const [mode, setMode] = useState<ArithmeticMode>('mixed');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [bucketId, setBucketId] = useState<string>('sprint_60');

  const activeBucket = BUCKETS.find((b) => b.id === bucketId) ?? BUCKETS[1];

  const filteredChampions = useMemo(() => {
    const visible = childLeaderboard.filter((c) => !c.isHidden);
    const base =
      classFilter === 'all'
        ? visible
        : visible.filter((c) => c.grade === classFilter);
    return [...base].sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      return a.name.localeCompare(b.name);
    });
  }, [childLeaderboard, classFilter]);

  const rankedEntries = useMemo(() => {
    return leaderboard
      .filter(
        (entry) =>
          !entry.isHidden &&
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

  const getRankLabel = (idx: number) => {
    if (idx === 0) return '1st';
    if (idx === 1) return '2nd';
    if (idx === 2) return '3rd';
    return `#${idx + 1}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b-2 border-sky-100 dark:border-slate-800">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Leaderboard
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Live student rankings by Indian school class and speed-sprint
            personal bests.
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
          className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 border-b-4 border-orange-700 active:border-b-0 active:translate-y-[2px] text-white font-display text-sm sm:text-base font-bold transition-all whitespace-nowrap shrink-0"
        >
          <Play className="w-4 h-4 fill-current" />
          Start Drill
        </button>
      </div>

      {/* Primary Board Switcher */}
      <div
        role="tablist"
        aria-label="Leaderboard type"
        className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-sky-100/80 dark:bg-slate-900 border-2 border-sky-200/80 dark:border-slate-800 max-w-md"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'champions'}
          onClick={() => setTab('champions')}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
            tab === 'champions'
              ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
          }`}
        >
          <GraduationCap className="w-4 h-4 shrink-0" />
          Student Champions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sprints'}
          onClick={() => setTab('sprints')}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
            tab === 'sprints'
              ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
          }`}
        >
          <Trophy className="w-4 h-4 shrink-0" />
          Speed Sprints
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: STUDENT CHAMPIONS BY INDIAN SCHOOL CLASS                       */}
      {/* ===================================================================== */}
      {tab === 'champions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <label
                htmlFor="leaderboard-class-filter"
                className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap"
              >
                Filter by Class:
              </label>
              <select
                id="leaderboard-class-filter"
                value={classFilter}
                onChange={(e) =>
                  setClassFilter(e.target.value as 'all' | IndianClass)
                }
                className="min-h-[44px] px-3.5 py-2 rounded-2xl border-2 border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="all">All Classes (Nursery – 12th)</option>
                {INDIAN_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    {formatIndianClassLabel(cls)}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              {filteredChampions.length}{' '}
              {filteredChampions.length === 1 ? 'student' : 'students'} ranked
              live from Firestore
            </p>
          </div>

          {topChampionsLoading ? (
            <div className="rounded-3xl border-2 border-amber-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading live student rankings…
            </div>
          ) : filteredChampions.length === 0 ? (
            <div className="rounded-3xl border-2 border-amber-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-2.5">
              <Trophy className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="font-display text-lg font-bold text-slate-950 dark:text-white">
                {classFilter === 'all'
                  ? 'No student champions recorded yet'
                  : `No student scores in ${formatIndianClassLabel(classFilter)} yet`}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Complete a practice drill from a Parent Portal child profile to
                appear on the live rankings.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="md:hidden space-y-2.5">
                {filteredChampions.map((entry, idx) => {
                  const RankIcon =
                    idx === 0 ? Crown : idx === 1 ? Medal : Award;
                  return (
                    <article
                      key={entry.id}
                      className={`rounded-3xl border-2 p-4 flex items-center justify-between gap-3 ${
                        idx === 0
                          ? 'border-amber-300 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20'
                          : idx === 1
                          ? 'border-sky-200 dark:border-slate-700 bg-sky-50/50 dark:bg-slate-900'
                          : idx === 2
                          ? 'border-orange-200 dark:border-slate-700 bg-orange-50/40 dark:bg-slate-900'
                          : 'border-sky-100 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`inline-flex items-center justify-center gap-1 min-w-[54px] px-2.5 py-1.5 rounded-xl border-2 font-display text-xs font-bold tabular-nums shrink-0 ${
                            idx === 0
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/70'
                              : idx === 1
                              ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-800'
                              : idx === 2
                              ? 'bg-orange-100/90 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-900/60'
                              : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          {idx < 3 && <RankIcon className="w-3.5 h-3.5 shrink-0" />}
                          {getRankLabel(idx)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-display text-base font-bold text-slate-950 dark:text-white truncate">
                            {entry.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {formatIndianClassLabel(entry.grade)} ·{' '}
                            {entry.sessionsCount}{' '}
                            {entry.sessionsCount === 1 ? 'drill' : 'drills'} ·
                            streak {entry.bestStreak}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-display text-xl font-bold text-slate-950 dark:text-white tabular-nums">
                          {entry.totalScore}
                        </span>
                        <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          points
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block rounded-3xl border-2 border-amber-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-[0_6px_0_0_rgba(253,230,138,0.4)] dark:shadow-none overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-amber-100 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 bg-amber-50/60 dark:bg-slate-950/40">
                      <th className="py-3 px-4 w-20">Rank</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Class / Grade</th>
                      <th className="py-3 px-4 text-right">Total Score</th>
                      <th className="py-3 px-4 text-right">Drills</th>
                      <th className="py-3 px-4 text-right">Best Streak</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/70 dark:divide-slate-800 text-sm">
                    {filteredChampions.map((entry, idx) => (
                      <tr
                        key={entry.id}
                        className="hover:bg-amber-50/40 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-3.5 px-4 font-display font-bold tabular-nums whitespace-nowrap">
                          <span
                            className={
                              idx === 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : idx === 1
                                ? 'text-sky-600 dark:text-sky-400'
                                : idx === 2
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-slate-400 dark:text-slate-500'
                            }
                          >
                            {getRankLabel(idx)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-display text-base font-bold text-slate-950 dark:text-white">
                          {entry.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          {formatIndianClassLabel(entry.grade)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-display text-lg font-bold text-slate-950 dark:text-white tabular-nums">
                          {entry.totalScore}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                          {entry.sessionsCount}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                          {entry.bestStreak}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: SPEED SPRINT PERSONAL BESTS                                    */}
      {/* ===================================================================== */}
      {tab === 'sprints' && (
        <div className="space-y-6">
          {/* Category Filter Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-sky-100/80 dark:bg-slate-900 border-2 border-sky-200/80 dark:border-slate-800 w-full sm:w-auto">
              {(
                ['mixed', 'addition', 'subtraction', 'multiplication', 'division'] as const
              ).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex-1 sm:flex-initial ${
                    mode === m
                      ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {MODE_META[m].shortLabel}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 rounded-2xl bg-sky-100/80 dark:bg-slate-900 border-2 border-sky-200/80 dark:border-slate-800 w-full sm:w-auto">
              {(['easy', 'medium', 'hard'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex-1 sm:flex-initial ${
                    difficulty === d
                      ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {DIFFICULTY_META[d].label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-1 p-1 rounded-2xl bg-sky-100/80 dark:bg-slate-900 border-2 border-sky-200/80 dark:border-slate-800 w-full sm:w-auto">
              {BUCKETS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBucketId(b.id)}
                  className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                    bucketId === b.id
                      ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {!user ? (
            <div className="rounded-3xl border-2 border-sky-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-5 sm:p-8 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 max-w-xl">
                  <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
                    Sign in to view Speed Sprint Personal Bests
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Sign in with Google to compare speed-sprint benchmarks
                    across devices.
                  </p>
                </div>
                {isConfigured && (
                  <button
                    type="button"
                    onClick={() => void signInWithGoogle()}
                    className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-600 border-b-4 border-sky-700 active:border-b-0 active:translate-y-[2px] text-white text-sm font-bold transition-all whitespace-nowrap shrink-0"
                  >
                    Sign in with Google
                  </button>
                )}
              </div>

              <div className="pt-5 border-t-2 border-sky-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">
                  Your Local Personal Best · {MODE_META[mode].label} ·{' '}
                  {DIFFICULTY_META[difficulty].label} · {activeBucket.label}
                </p>
                {localBest ? (
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-baseline gap-4 sm:gap-6 font-mono tabular-nums">
                    <div>
                      <span className="text-xs font-sans font-semibold text-slate-500 dark:text-slate-400 block">
                        Score
                      </span>
                      <span className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                        {localBest.score}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-sans font-semibold text-slate-500 dark:text-slate-400 block">
                        Accuracy
                      </span>
                      <span className="text-xl font-bold text-slate-800 dark:text-slate-200">
                        {localBest.accuracy.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-sans font-semibold text-slate-500 dark:text-slate-400 block">
                        Best Streak
                      </span>
                      <span className="text-xl font-bold text-slate-800 dark:text-slate-200">
                        {localBest.bestStreak}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-sans font-semibold text-slate-500 dark:text-slate-400 block">
                        Avg Time
                      </span>
                      <span className="text-xl font-bold text-slate-800 dark:text-slate-200">
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
            <div className="rounded-3xl border-2 border-sky-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading Firestore leaderboard…
            </div>
          ) : rankedEntries.length === 0 ? (
            <div className="rounded-3xl border-2 border-sky-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
              <Trophy className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="font-display text-lg font-bold text-slate-950 dark:text-white">
                No entries in {MODE_META[mode].label} ·{' '}
                {DIFFICULTY_META[difficulty].label} · {activeBucket.label} yet
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Finish a drill in this category to claim the #1 benchmark.
              </p>
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {rankedEntries.map((entry, index) => {
                  const isSelf = entry.userId === user.uid;
                  return (
                    <article
                      key={entry.id}
                      className={`rounded-3xl border-2 p-4 space-y-3 ${
                        isSelf
                          ? 'border-sky-300 dark:border-sky-800 bg-sky-50/60 dark:bg-sky-950/25'
                          : 'border-sky-200 dark:border-slate-700/80 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-display text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400 shrink-0">
                            {getRankLabel(index)}
                          </span>
                          <span className="font-display font-bold text-slate-950 dark:text-white truncate">
                            {entry.displayName}
                          </span>
                          {isSelf && (
                            <span className="text-xs font-bold text-sky-600 dark:text-sky-400 shrink-0">
                              You
                            </span>
                          )}
                        </div>
                        <span className="font-display text-xl font-bold text-slate-950 dark:text-white tabular-nums shrink-0">
                          {entry.score}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2 pt-2 border-t-2 border-sky-50 dark:border-slate-800 font-mono text-xs tabular-nums">
                        <div>
                          <span className="block font-sans text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Acc
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {entry.accuracy.toFixed(0)}%
                          </span>
                        </div>
                        <div>
                          <span className="block font-sans text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Streak
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {entry.bestStreak}
                          </span>
                        </div>
                        <div>
                          <span className="block font-sans text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Avg
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {(entry.avgResponseMs / 1000).toFixed(2)}s
                          </span>
                        </div>
                        <div>
                          <span className="block font-sans text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Q/Min
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {entry.qpm.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden md:block rounded-3xl border-2 border-sky-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-sky-100 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 bg-sky-50/70 dark:bg-slate-950/40">
                        <th className="py-3 px-4 w-16">Rank</th>
                        <th className="py-3 px-4">Player</th>
                        <th className="py-3 px-4 text-right">Score</th>
                        <th className="py-3 px-4 text-right">Accuracy</th>
                        <th className="py-3 px-4 text-right">Best Streak</th>
                        <th className="py-3 px-4 text-right">Avg Time</th>
                        <th className="py-3 px-4 text-right">Q/Min</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100/70 dark:divide-slate-800 text-sm">
                      {rankedEntries.map((entry, index) => {
                        const isSelf = entry.userId === user.uid;
                        return (
                          <tr
                            key={entry.id}
                            className={
                              isSelf
                                ? 'bg-sky-50/60 dark:bg-sky-950/25'
                                : 'hover:bg-sky-50/40 dark:hover:bg-slate-800/40'
                            }
                          >
                            <td className="py-3.5 px-4 font-display font-bold tabular-nums whitespace-nowrap">
                              <span
                                className={
                                  index === 0
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : index === 1
                                    ? 'text-sky-600 dark:text-sky-400'
                                    : index === 2
                                    ? 'text-orange-600 dark:text-orange-400'
                                    : 'text-slate-400 dark:text-slate-500'
                                }
                              >
                                {getRankLabel(index)}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                              <span>{entry.displayName}</span>
                              {isSelf && (
                                <span className="ml-2 text-xs font-bold text-sky-600 dark:text-sky-400">
                                  You
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-display text-base font-bold text-slate-950 dark:text-white tabular-nums whitespace-nowrap">
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
      )}
    </div>
  );
};
