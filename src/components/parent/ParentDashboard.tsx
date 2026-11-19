import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  LogOut,
  MapPin,
  Phone,
  Play,
  Trophy,
  Users,
} from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import {
  INDIAN_CLASS_META,
  MODE_META,
  formatIndianClassLabel,
  formatSessionDescriptor,
} from '../../types/math';
import {
  ChildProfile,
  PAYMENT_METHOD_LABELS,
  evaluateSubscriptionState,
  formatCurrency,
  formatIsoDate,
} from '../../types/platform';

interface ParentDashboardProps {
  onStartChildPractice: (child: ChildProfile) => void;
}

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  onStartChildPractice,
}) => {
  const {
    roleSession,
    logoutRole,
    switchToChildMode,
    getParentById,
    getAgentById,
    getChildrenForParent,
    getLatestSubscriptionForParent,
    getChildStats,
  } = usePlatform();

  const [switchError, setSwitchError] = useState<string | null>(null);

  const parent = roleSession ? getParentById(roleSession.accountId) : undefined;

  if (!parent) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-base font-semibold text-slate-900 dark:text-white">
          Parent account could not be loaded.
        </p>
        <button
          type="button"
          onClick={() => void logoutRole()}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold"
        >
          Return to Sign-In
        </button>
      </div>
    );
  }

  const latestSub = getLatestSubscriptionForParent(parent.id);
  const subEval = evaluateSubscriptionState(latestSub);
  const agent = getAgentById(parent.createdByAgentId);
  const linkedChildren = getChildrenForParent(parent.id);

  // Use live agent doc if loaded, falling back to denormalized snapshot stored on Parent doc
  const agentContact = {
    name: agent?.name || parent.agentName,
    code: agent?.agentCode || parent.agentCode,
    phone: agent?.phone || parent.agentPhone,
    area: agent?.assignedArea || parent.agentArea,
  };

  const handleLaunchChild = (child: ChildProfile) => {
    setSwitchError(null);
    const res = switchToChildMode(child.id);
    if (!res.ok) {
      setSwitchError(
        res.error ||
          'Practice access is paused until your yearly subscription is renewed.'
      );
      return;
    }
    onStartChildPractice(child);
  };

  const bannerClasses =
    subEval.state === 'active'
      ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30'
      : subEval.state === 'expiring_soon'
      ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30'
      : 'border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/30';

  const statusTextClass =
    subEval.state === 'active'
      ? 'text-emerald-800 dark:text-emerald-300'
      : subEval.state === 'expiring_soon'
      ? 'text-amber-800 dark:text-amber-300'
      : 'text-red-800 dark:text-red-300';

  const StatusIcon =
    subEval.state === 'active'
      ? CheckCircle2
      : subEval.state === 'expiring_soon'
      ? Clock
      : subEval.state === 'suspended'
      ? Ban
      : AlertCircle;

  const formatDateTime = (ms: number) => {
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <Users className="w-4 h-4 shrink-0" />
            <span>
              Parent Portal · {parent.email || parent.contact}
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Welcome, {parent.name}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tap any child card below to start math practice immediately — no
            separate child login required.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void logoutRole()}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>

      {/* Prominent Yearly Subscription Status Banner */}
      <section
        aria-label="Subscription Status"
        className={`rounded-2xl border p-4 sm:p-6 space-y-4 ${bannerClasses}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <div
              className={`inline-flex items-center gap-2 text-sm font-bold ${statusTextClass}`}
            >
              <StatusIcon className="w-5 h-5 shrink-0" />
              <span>Yearly Subscription · {subEval.label}</span>
              {subEval.canPractice && (
                <span className="font-mono tabular-nums">
                  ({subEval.daysLeft}{' '}
                  {subEval.daysLeft === 1 ? 'day' : 'days'} remaining)
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              {subEval.state === 'active'
                ? 'Full math practice access is active for all linked children.'
                : subEval.state === 'expiring_soon'
                ? 'Your yearly plan expires within 30 days. Contact your assigned Agent below to renew without interruption.'
                : 'Full practice access is paused because your yearly subscription is expired or suspended. Contact your Agent below to renew for 1 year.'}
            </p>
          </div>

          {latestSub && (
            <div className="font-mono text-xs sm:text-sm tabular-nums text-slate-800 dark:text-slate-200 space-y-0.5 shrink-0">
              <div className="inline-flex items-center gap-1.5 font-semibold">
                <Calendar className="w-4 h-4 shrink-0" />
                {formatIsoDate(latestSub.startDate)} →{' '}
                {formatIsoDate(latestSub.expiryDate)}
              </div>
              <p className="font-sans text-xs text-slate-600 dark:text-slate-400">
                Yearly fee: {formatCurrency(latestSub.feeAmount)} (
                {PAYMENT_METHOD_LABELS[latestSub.paymentMethod]})
              </p>
            </div>
          )}
        </div>

        {/* Assigned Agent Contact for Renewal */}
        {agentContact.phone && (
          <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            <span className="font-semibold">
              Renewal Contact · Agent {agentContact.name}
              {agentContact.code ? ` (${agentContact.code})` : ''}
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <a
                href={`tel:${agentContact.phone}`}
                className="inline-flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-400 hover:underline min-h-[36px]"
              >
                <Phone className="w-3.5 h-3.5 shrink-0" />
                {agentContact.phone}
              </a>
              {agentContact.area && (
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {agentContact.area}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {switchError && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{switchError}</span>
        </div>
      )}

      {/* Linked Child Profiles — One-Tap Switch Cards */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
            Your Children ({linkedChildren.length})
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            One tap launches math practice at their school class level
          </span>
        </div>

        {linkedChildren.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-2">
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              No child profiles linked yet
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ask your field Agent to add your child&apos;s name and class to
              this family account.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {linkedChildren.map((child) => {
              const stats = getChildStats(child.id);
              const classMeta = INDIAN_CLASS_META[child.grade];
              return (
                <article
                  key={child.id}
                  onClick={() => subEval.canPractice && handleLaunchChild(child)}
                  className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-5 transition-all ${
                    subEval.canPractice
                      ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md'
                      : ''
                  }`}
                >
                  {/* Child Header + Prominent One-Tap Start Practice CTA */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                        <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <h3 className="font-display text-xl font-bold text-slate-950 dark:text-white">
                          {child.name}
                        </h3>
                        <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-300">
                          {formatIndianClassLabel(child.grade)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        {classMeta.rangeSummary} · {stats.totalSessions}{' '}
                        completed{' '}
                        {stats.totalSessions === 1 ? 'drill' : 'drills'}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!subEval.canPractice}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLaunchChild(child);
                      }}
                      className={`min-h-[48px] px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                        subEval.canPractice
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-4 h-4 fill-current shrink-0" />
                      {subEval.canPractice
                        ? 'Start Practice'
                        : 'Renewal Required'}
                    </button>
                  </div>

                  {/* 4-Metric Progress Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 font-mono tabular-nums">
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 space-y-0.5">
                      <span className="inline-flex items-center gap-1 font-sans text-xs text-slate-500 dark:text-slate-400">
                        <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        Total Score
                      </span>
                      <span className="block text-xl font-bold text-slate-950 dark:text-white">
                        {stats.totalScore}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 space-y-0.5">
                      <span className="block font-sans text-xs text-slate-500 dark:text-slate-400">
                        Accuracy
                      </span>
                      <span className="text-xl font-bold text-slate-950 dark:text-white">
                        {stats.totalAttempted > 0
                          ? `${stats.accuracy.toFixed(1)}%`
                          : '—'}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 space-y-0.5">
                      <span className="block font-sans text-xs text-slate-500 dark:text-slate-400">
                        Best Streak
                      </span>
                      <span className="text-xl font-bold text-slate-950 dark:text-white">
                        {stats.bestStreak}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 space-y-0.5">
                      <span className="block font-sans text-xs text-slate-500 dark:text-slate-400">
                        Avg Response
                      </span>
                      <span className="text-xl font-bold text-slate-950 dark:text-white">
                        {stats.avgResponseMs > 0
                          ? `${(stats.avgResponseMs / 1000).toFixed(2)}s`
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Weak Math Topics Breakdown */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Weak Math Topics to Focus On
                    </p>
                    {stats.weakTopics.length === 0 ? (
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                        {stats.totalSessions === 0
                          ? 'No drills completed yet. Weak arithmetic operations will appear automatically after the first session.'
                          : 'Great accuracy across all operations so far — no weak topics flagged.'}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {stats.weakTopics.map((wt) => (
                          <div
                            key={wt.topic}
                            className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm"
                          >
                            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              {MODE_META[wt.topic].label} ({MODE_META[wt.topic].symbol})
                            </span>
                            <span className="font-mono text-xs text-amber-800 dark:text-amber-400 tabular-nums shrink-0">
                              {wt.avgAccuracy}% avg · {wt.sessionsFlagged}{' '}
                              {wt.sessionsFlagged === 1 ? 'run' : 'runs'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Practice Sessions */}
                  {stats.recentSessions.length > 0 && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 cursor-default"
                    >
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Recent Practice Runs
                      </p>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {stats.recentSessions.slice(0, 5).map((run) => (
                          <div
                            key={run.id}
                            className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs sm:text-sm"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 dark:text-white truncate">
                                {formatSessionDescriptor(
                                  run.mode,
                                  run.difficulty,
                                  run.sessionType,
                                  run.durationSec,
                                  run.grade
                                )}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                {formatDateTime(run.createdAtMs)} ·{' '}
                                {run.accuracy.toFixed(0)}% accuracy · streak{' '}
                                {run.bestStreak}
                              </p>
                            </div>
                            <span className="font-mono text-base font-bold text-slate-950 dark:text-white tabular-nums shrink-0">
                              {run.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
