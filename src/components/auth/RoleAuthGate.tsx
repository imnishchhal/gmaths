import React, { useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { usePlatform } from '../../context/PlatformContext';
import { PlatformRoute } from '../../types/platform';

type AuthPortalRole = 'admin' | 'agent' | 'parent';

interface RoleAuthGateProps {
  targetRole: AuthPortalRole;
  onNavigateRoute: (route: PlatformRoute) => void;
}

const ROLE_COPY: Record<
  AuthPortalRole,
  {
    title: string;
    subtitle: string;
    googleHint: string;
    idLabel: string;
    idPlaceholder: string;
    secretLabel: string;
    secretPlaceholder: string;
    submitLabel: string;
  }
> = {
  admin: {
    title: 'Admin Console Sign-In',
    subtitle:
      'Manage field Agents, oversee yearly subscriptions, and view platform revenue live across devices.',
    googleHint:
      'Sign in with the authorized Admin Google account to access Cloud Firestore operations.',
    idLabel: 'Admin Email',
    idPlaceholder: 'admin@example.com',
    secretLabel: 'Passcode',
    secretPlaceholder: 'Passcode',
    submitLabel: 'Sign in',
  },
  agent: {
    title: 'Field Agent Sign-In',
    subtitle:
      'Onboard parent and child accounts, collect yearly fees, and process 1-year renewals.',
    googleHint:
      'Sign in with the Google email registered on your Agent profile by Admin for automatic cross-device sync.',
    idLabel: 'Agent ID, Phone, or Email',
    idPlaceholder: 'e.g. AG01 or email',
    secretLabel: 'Agent Passcode',
    secretPlaceholder: 'Enter passcode set by Admin',
    submitLabel: 'Switch to Agent Portal',
  },
  parent: {
    title: 'Parent Portal Sign-In',
    subtitle:
      'Check your yearly plan status, monitor child scores, and tap any child card to start math practice.',
    googleHint:
      'Sign in with the Google email registered by your field Agent. Children switch directly inside your dashboard — no child passwords needed.',
    idLabel: 'Registered Mobile or Email',
    idPlaceholder: 'Enter mobile or email from Agent',
    secretLabel: 'Parent Passcode',
    secretPlaceholder: 'Enter passcode',
    submitLabel: 'Switch to Parent Portal',
  },
};

export const RoleAuthGate: React.FC<RoleAuthGateProps> = ({
  targetRole,
  onNavigateRoute,
}) => {
  const { user, isConfigured, authLoading, authError } = useFirebase();
  const {
    platformLoading,
    roleResolveNotice,
    signInAndRouteWithGoogle,
    signInWithGoogleRedirectFlow,
    loginAgentPasscode,
    loginParentPasscode,
    logoutRole,
  } = usePlatform();

  const [showPasscodeForm, setShowPasscodeForm] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = ROLE_COPY[targetRole];
  const Icon =
    targetRole === 'admin'
      ? ShieldCheck
      : targetRole === 'agent'
      ? Briefcase
      : Users;

  const handleGoogleSignIn = async () => {
    setError(null);
    const res = await signInAndRouteWithGoogle();
    if (!res.ok && res.error) {
      setError(res.error);
    }
  };

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res =
      targetRole === 'agent'
        ? await loginAgentPasscode(identifier, secret)
        : await loginParentPasscode(identifier, secret);

    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Unable to open portal.');
    }
  };

  const combinedError = error || authError || roleResolveNotice;

  return (
    <div className="max-w-md mx-auto px-4 py-8 sm:py-14">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Icon className="w-5 h-5 shrink-0" />
            <span className="text-xs font-semibold">
              Protected Portal · /{targetRole}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            {copy.title}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {copy.subtitle}
          </p>
        </div>

        {/* Loading indicator while Cloud Firestore verifies role on sign-in */}
        {user && platformLoading && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 px-4 py-3 text-xs sm:text-sm text-blue-800 dark:text-blue-300">
            Syncing your Cloud Firestore account for {user.email}…
          </div>
        )}

        {combinedError && (
          <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-3 flex items-start gap-2.5 text-xs sm:text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">{combinedError}</span>
          </div>
        )}

        {/* Primary Google Sign-In CTA (Works across Desktop, Mobile & GitHub Pages) */}
        {isConfigured ? (
          <div className="space-y-3">
            {!user ? (
              <>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => void handleGoogleSignIn()}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition-colors whitespace-nowrap"
                >
                  {authLoading
                    ? 'Connecting Google…'
                    : 'Sign in with Google'}
                </button>

                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => void signInWithGoogleRedirectFlow()}
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Popup blocked on mobile? Use Redirect Sign-In
                </button>
              </>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-3">
                <div className="space-y-0.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Signed in with Google
                  </p>
                  <p className="text-sm font-semibold text-slate-950 dark:text-white break-all">
                    {user.email}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleGoogleSignIn()}
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold whitespace-nowrap"
                  >
                    Open My Assigned Portal
                  </button>
                  <button
                    type="button"
                    onClick={() => void logoutRole()}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    Switch Account
                  </button>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {copy.googleHint}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-xs sm:text-sm text-amber-800 dark:text-amber-300">
            Firebase is not configured yet. Configure Cloud Firestore to enable
            multi-device portals.
          </div>
        )}

        {/* Secondary Passcode Switch (Only when Google-connected for workspace preview/switching) */}
        {user && (targetRole === 'agent' || targetRole === 'parent') && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <button
              type="button"
              onClick={() => setShowPasscodeForm((v) => !v)}
              className="w-full min-h-[44px] flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <span>Switch to a synced {targetRole} account with passcode</span>
              {showPasscodeForm ? (
                <ChevronUp className="w-4 h-4 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0" />
              )}
            </button>

            {showPasscodeForm && (
              <form onSubmit={handlePasscodeSubmit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="role-identifier"
                    className="block text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {copy.idLabel}
                  </label>
                  <input
                    id="role-identifier"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={copy.idPlaceholder}
                    required
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="role-secret"
                    className="block text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {copy.secretLabel}
                  </label>
                  <div className="relative">
                    <input
                      id="role-secret"
                      type={showSecret ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      placeholder={copy.secretPlaceholder}
                      required
                      className="w-full min-h-[44px] pl-3.5 pr-12 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((s) => !s)}
                      aria-label={showSecret ? 'Hide passcode' : 'Show passcode'}
                      className="absolute right-1 top-0.5 min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      {showSecret ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 text-sm font-bold transition-colors whitespace-nowrap"
                >
                  {submitting ? 'Verifying…' : copy.submitLabel}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Quick Portal Switcher (Admin, Agent, Parent only — no child login) */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Switch portal:</span>
          <div className="flex flex-wrap items-center gap-1 font-semibold">
            {(['parent', 'agent', 'admin'] as AuthPortalRole[])
              .filter((r) => r !== targetRole)
              .map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onNavigateRoute(`/${r}` as PlatformRoute)}
                  className="min-h-[44px] px-2.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 capitalize whitespace-nowrap transition-colors"
                >
                  {r}
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
