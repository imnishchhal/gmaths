import React from 'react';
import { ArrowRight, Award, Crown, Medal, Trophy } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { formatIndianClassLabel } from '../types/math';

interface TopChampionsCardProps {
  onOpenLeaderboard: () => void;
}

const RANK_CONFIG = [
  {
    rankLabel: '1st',
    icon: Crown,
    badgeClass:
      'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70',
    rowClass:
      'border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/15',
  },
  {
    rankLabel: '2nd',
    icon: Medal,
    badgeClass:
      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700',
    rowClass:
      'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40',
  },
  {
    rankLabel: '3rd',
    icon: Award,
    badgeClass:
      'bg-orange-100/80 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-900/60',
    rowClass:
      'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60',
  },
] as const;

export const TopChampionsCard: React.FC<TopChampionsCardProps> = ({
  onOpenLeaderboard,
}) => {
  const { topChampions, topChampionsLoading, topChampionsError } = usePlatform();

  return (
    <section
      aria-label="Top 3 Math Champions"
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <Trophy className="w-4 h-4 shrink-0" />
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-950 dark:text-white">
              Top 3 Math Champions
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live student rankings updated automatically from Cloud Firestore
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenLeaderboard}
          className="inline-flex items-center gap-1 min-h-[44px] px-2 -mr-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
        >
          Full board
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>

      {topChampionsLoading ? (
        <div className="space-y-2.5" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800/70 animate-pulse"
            />
          ))}
        </div>
      ) : topChampionsError ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Live rankings are currently offline. Complete a drill while connected
          to sync scores.
        </div>
      ) : topChampions.filter((e) => !e.isHidden).length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-5 text-center space-y-1.5">
          <Trophy className="w-6 h-6 text-amber-500 mx-auto" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Be the first Champion!
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Parents can tap a child profile in the Parent Portal and finish a
            practice drill to claim the #1 spot.
          </p>
        </div>
      ) : (
        <ol className="space-y-2.5">
          {topChampions
            .filter((e) => !e.isHidden)
            .slice(0, 3)
            .map((entry, idx) => {
            const rank = RANK_CONFIG[idx] ?? RANK_CONFIG[2];
            const RankIcon = rank.icon;
            return (
              <li
                key={entry.id}
                className={`rounded-xl border px-3.5 py-3 flex items-center justify-between gap-3 ${rank.rowClass}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`inline-flex items-center justify-center gap-1 min-w-[54px] px-2 py-1.5 rounded-lg border font-mono text-xs font-bold tabular-nums shrink-0 ${rank.badgeClass}`}
                  >
                    <RankIcon className="w-3.5 h-3.5 shrink-0" />
                    {rank.rankLabel}
                  </span>

                  <div className="min-w-0">
                    <p className="font-display text-sm sm:text-base font-bold text-slate-950 dark:text-white truncate">
                      {entry.name}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                      {formatIndianClassLabel(entry.grade)} ·{' '}
                      <span className="font-mono tabular-nums">
                        {entry.sessionsCount}{' '}
                        {entry.sessionsCount === 1 ? 'drill' : 'drills'}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="block font-mono text-lg sm:text-xl font-bold text-slate-950 dark:text-white tabular-nums leading-tight">
                    {entry.totalScore}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    score
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};
