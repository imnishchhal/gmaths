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
      'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/70',
    rowClass:
      'border-amber-300/90 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20',
  },
  {
    rankLabel: '2nd',
    icon: Medal,
    badgeClass:
      'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-800',
    rowClass:
      'border-sky-200/80 dark:border-slate-800 bg-sky-50/50 dark:bg-slate-950/40',
  },
  {
    rankLabel: '3rd',
    icon: Award,
    badgeClass:
      'bg-orange-100/90 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-900/60',
    rowClass:
      'border-orange-200/80 dark:border-slate-800 bg-orange-50/40 dark:bg-slate-900/60',
  },
] as const;

export const TopChampionsCard: React.FC<TopChampionsCardProps> = ({
  onOpenLeaderboard,
}) => {
  const { topChampions, topChampionsLoading, topChampionsError } = usePlatform();

  return (
    <section
      aria-label="Top 3 Math Champions"
      className="rounded-3xl border-2 border-amber-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-[0_6px_0_0_rgba(253,230,138,0.45)] dark:shadow-none p-5 sm:p-6 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="inline-flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
            <Trophy className="w-5 h-5 shrink-0" />
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              Top 3 Math Champions
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live student rankings updated automatically
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenLeaderboard}
          className="inline-flex items-center gap-1 min-h-[44px] px-2 -mr-2 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
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
              className="h-16 rounded-2xl bg-amber-50 dark:bg-slate-800/70 animate-pulse"
            />
          ))}
        </div>
      ) : topChampionsError ? (
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Live rankings are currently offline. Complete a drill while connected
          to sync scores.
        </div>
      ) : topChampions.filter((e) => !e.isHidden).length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 dark:border-slate-800 bg-amber-50/40 dark:bg-slate-950/40 p-5 text-center space-y-1.5">
          <Trophy className="w-7 h-7 text-amber-500 mx-auto" />
          <p className="font-display text-base font-bold text-slate-900 dark:text-white">
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
                className={`rounded-2xl border-2 px-3.5 py-3 flex items-center justify-between gap-3 ${rank.rowClass}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`inline-flex items-center justify-center gap-1 min-w-[54px] px-2.5 py-1.5 rounded-xl border-2 font-display text-xs font-bold tabular-nums shrink-0 ${rank.badgeClass}`}
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
                  <span className="block font-display text-xl font-bold text-slate-950 dark:text-white tabular-nums leading-tight">
                    {entry.totalScore}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    points
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
