import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  LogOut,
  MapPin,
  Phone,
  Play,
  Trophy,
  Users,
} from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { formatParentAccountDisplay } from '../../utils/referral';
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
    changeParentPassword,
    getParentById,
    getAgentById,
    getChildrenForParent,
    getLatestSubscriptionForParent,
    getChildStats,
  } = usePlatform();

  const [switchError, setSwitchError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

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
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 border-b-4 border-orange-700 text-white text-sm font-bold"
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

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setSavingPassword(true);
    const res = await changeParentPassword(parent.id, newPassword);
    setSavingPassword(false);
    if (!res.ok) {
      setPasswordError(res.error || 'Could not update password.');
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    setPasswordSuccess('Your Parent Portal login password has been updated.');
    window.setTimeout(() => setPasswordSuccess(null), 5000);
  };

  const bannerClasses =
    subEval.state === 'active'
      ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/30'
      : subEval.state === 'expiring_soon'
      ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/85 dark:bg-amber-950/30'
      : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/85 dark:bg-rose-950/30';

  const statusTextClass =
    subEval.state === 'active'
      ? 'text-emerald-800 dark:text-emerald-300'
      : subEval.state === 'expiring_soon'
      ? 'text-amber-800 dark:text-amber-300'
      : 'text-rose-800 dark:text-rose-300';

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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b-2 border-sky-100 dark:border-slate-800">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400">
            <Users className="w-4 h-4 shrink-0" />
            <span>
              Parent Portal ·{' '}
              {formatParentAccountDisplay(parent.email, parent.contact)}
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
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-2xl border-2 border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-sky-50 dark:hover:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>

      {/* Prominent Yearly Subscription Status Banner */}
      <section
        aria-label="Subscription Status"
        className={`rounded-3xl border-2 p-4 sm:p-6 space-y-4 ${bannerClasses}`}
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
          <div className="pt-3 border-t-2 border-slate-200/60 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            <span className="font-bold">
              Renewal Contact · Agent {agentContact.name}
              {agentContact.code ? ` (${agentContact.code})` : ''}
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <a
                href={`tel:${agentContact.phone}`}
                className="inline-flex items-center gap-1.5 font-bold text-sky-600 dark:text-sky-400 hover:underline min-h-[36px]"
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
        <div className="rounded-2xl border-2 border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-300">
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
          <div className="rounded-3xl border-2 border-sky-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-8 text-center space-y-2">
            <p className="font-display text-lg font-bold text-slate-950 dark:text-white">
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
                  className={`rounded-3xl border-2 border-sky-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-[0_5px_0_0_rgba(186,230,253,0.45)] dark:shadow-none p-4 sm:p-6 space-y-5 transition-all ${
                    subEval.canPractice
                      ? 'cursor-pointer hover:border-orange-400 dark:hover:border-orange-500'
                      : ''
                  }`}
                >
                  {/* Child Header + Prominent One-Tap Start Practice CTA */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                        <GraduationCap className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
                        <h3 className="font-display text-xl font-bold text-slate-950 dark:text-white">
                          {child.name}
                        </h3>
                        <span className="font-mono text-xs font-bold text-sky-700 dark:text-sky-300">
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
                      className={`min-h-[48px] px-5 py-2.5 rounded-2xl font-display text-sm sm:text-base font-bold inline-flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                        subEval.canPractice
                          ? 'bg-orange-500 hover:bg-orange-600 border-b-4 border-orange-700 active:border-b-0 active:translate-y-[2px] text-white'
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t-2 border-sky-50 dark:border-slate-800 font-mono tabular-nums">
                    <div className="rounded-2xl border border-amber-100 dark:border-slate-800 bg-amber-50/70 dark:bg-slate-950/60 p-3 space-y-0.5">
                      <span className="inline-flex items-center gap-1 font-sans text-xs font-bold text-amber-700 dark:text-amber-300">
                        <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        Total Score
                      </span>
                      <span className="block font-display text-xl font-bold text-slate-950 dark:text-white">
                        {stats.totalScore}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-emerald-100 dark:border-slate-800 bg-emerald-50/70 dark:bg-slate-950/60 p-3 space-y-0.5">
                      <span className="block font-sans text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        Accuracy
                      </span>
                      <span className="block font-display text-xl font-bold text-slate-950 dark:text-white">
                        {stats.totalAttempted > 0
                          ? `${stats.accuracy.toFixed(1)}%`
                          : '—'}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-sky-100 dark:border-slate-800 bg-sky-50/70 dark:bg-slate-950/60 p-3 space-y-0.5">
                      <span className="block font-sans text-xs font-bold text-sky-700 dark:text-sky-300">
                        Best Streak
                      </span>
                      <span className="block font-display text-xl font-bold text-slate-950 dark:text-white">
                        {stats.bestStreak}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-violet-100 dark:border-slate-800 bg-violet-50/70 dark:bg-slate-950/60 p-3 space-y-0.5">
                      <span className="block font-sans text-xs font-bold text-violet-700 dark:text-violet-300">
                        Avg Response
                      </span>
                      <span className="block font-display text-xl font-bold text-slate-950 dark:text-white">
                        {stats.avgResponseMs > 0
                          ? `${(stats.avgResponseMs / 1000).toFixed(2)}s`
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Weak Math Topics Breakdown */}
                  <div className="pt-3 border-t-2 border-sky-50 dark:border-slate-800 space-y-2">
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
                            className="rounded-2xl border-2 border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm"
                          >
                            <span className="inline-flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300">
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
                      className="pt-3 border-t-2 border-sky-50 dark:border-slate-800 space-y-2 cursor-default"
                    >
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Recent Practice Runs
                      </p>
                      <div className="divide-y divide-sky-100/70 dark:divide-slate-800">
                        {stats.recentSessions.slice(0, 5).map((run) => (
                          <div
                            key={run.id}
                            className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs sm:text-sm"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">
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
                            <span className="font-display text-base font-bold text-slate-950 dark:text-white tabular-nums shrink-0">
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

      {/* Account Password Update Card */}
      <section className="rounded-3xl border-2 border-sky-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <div>
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              Update Login Password
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Registered mobile: {parent.contact}
              {parent.email ? ` · Email: ${parent.email}` : ''}
            </p>
          </div>
        </div>

        {passwordError && (
          <div className="rounded-2xl border-2 border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 flex items-center gap-2 text-xs sm:text-sm font-medium text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        {passwordSuccess && (
          <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2.5 flex items-center gap-2 text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{passwordSuccess}</span>
          </div>
        )}

        <form onSubmit={handleChangePasswordSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="parent-new-password"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                New Password * (min 6 chars)
              </label>
              <div className="relative">
                <input
                  id="parent-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full min-h-[44px] pl-3.5 pr-11 py-2 rounded-2xl border-2 border-sky-100 dark:border-slate-700 bg-sky-50/40 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-0.5 top-0 min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="parent-confirm-password"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Confirm New Password *
              </label>
              <input
                id="parent-confirm-password"
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl border-2 border-sky-100 dark:border-slate-700 bg-sky-50/40 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingPassword}
            className="min-h-[44px] px-5 py-2 rounded-2xl bg-sky-500 hover:bg-sky-600 border-b-4 border-sky-700 active:border-b-0 active:translate-y-[2px] disabled:opacity-50 text-white text-xs sm:text-sm font-bold transition-all"
          >
            {savingPassword ? 'Updating Password…' : 'Update Password'}
          </button>
        </form>
      </section>
    </div>
  );
};
