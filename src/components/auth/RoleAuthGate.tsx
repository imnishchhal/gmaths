import React, { useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Eye,
  EyeOff,
  GraduationCap,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { usePlatform } from '../../context/PlatformContext';
import {
  LOCAL_ADMIN_DEFAULT_EMAIL,
  PlatformRoute,
  UserRole,
} from '../../types/platform';

interface RoleAuthGateProps {
  targetRole: UserRole;
  onNavigateRoute: (route: PlatformRoute) => void;
}

const ROLE_COPY: Record<
  UserRole,
  {
    title: string;
    subtitle: string;
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
      'Manage field Agents, oversee yearly subscriptions, and view platform revenue.',
    idLabel: 'Admin Email',
    idPlaceholder: LOCAL_ADMIN_DEFAULT_EMAIL,
    secretLabel: 'Admin Passcode',
    secretPlaceholder: 'Enter admin passcode',
    submitLabel: 'Sign in to Admin Console',
  },
  agent: {
    title: 'Field Agent Sign-In',
    subtitle:
      'Onboard parent and child accounts, collect yearly fees, and manage renewals.',
    idLabel: 'Agent ID, Phone, or Email',
    idPlaceholder: 'e.g. AG01 or phone number',
    secretLabel: 'Agent Passcode',
    secretPlaceholder: 'Enter passcode set by Admin',
    submitLabel: 'Sign in to Agent Portal',
  },
  parent: {
    title: 'Parent Portal Sign-In',
    subtitle:
      'Check your yearly plan status, monitor child accuracy, and launch Child Mode.',
    idLabel: 'Registered Mobile or Email',
    idPlaceholder: 'Enter mobile or email from Agent',
    secretLabel: 'Parent Password / PIN',
    secretPlaceholder: 'Enter password or PIN',
    submitLabel: 'Sign in to Parent Portal',
  },
  child: {
    title: 'Student Sign-In',
    subtitle:
      'Sign in with your student username and PIN to track drills under your profile.',
    idLabel: 'Student Username',
    idPlaceholder: 'e.g. maya_math',
    secretLabel: 'Student PIN',
    secretPlaceholder: 'Enter 4-digit PIN',
    submitLabel: 'Start Student Practice',
  },
};

export const RoleAuthGate: React.FC<RoleAuthGateProps> = ({
  targetRole,
  onNavigateRoute,
}) => {
  const { isConfigured, authLoading } = useFirebase();
  const {
    loginAdminWithCredentials,
    loginAdminWithGoogle,
    loginAgent,
    loginParent,
    loginChild,
  } = usePlatform();

  const [identifier, setIdentifier] = useState(
    targetRole === 'admin' ? LOCAL_ADMIN_DEFAULT_EMAIL : ''
  );
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
      : targetRole === 'parent'
      ? Users
      : GraduationCap;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let res: { ok: boolean; error?: string };
    if (targetRole === 'admin') {
      res = await loginAdminWithCredentials(identifier, secret);
    } else if (targetRole === 'agent') {
      res = await loginAgent(identifier, secret);
    } else if (targetRole === 'parent') {
      res = await loginParent(identifier, secret);
    } else {
      res = await loginChild(identifier, secret);
    }

    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Unable to sign in.');
    } else if (targetRole === 'child') {
      onNavigateRoute('/');
    }
  };

  const handleGoogleAdmin = async () => {
    setError(null);
    const res = await loginAdminWithGoogle();
    if (!res.ok && res.error) {
      setError(res.error);
    }
  };

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

        {/* Google Cloud Admin Option */}
        {targetRole === 'admin' && isConfigured && (
          <div className="space-y-3">
            <button
              type="button"
              disabled={authLoading}
              onClick={() => void handleGoogleAdmin()}
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 text-sm font-semibold transition-colors whitespace-nowrap"
            >
              {authLoading ? 'Connecting Google…' : 'Sign in with Google Admin'}
            </button>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span>or portal credentials</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-3 flex items-start gap-2.5 text-xs sm:text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="role-identifier"
              className="block text-sm font-semibold text-slate-900 dark:text-white"
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
              className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="role-secret"
              className="block text-sm font-semibold text-slate-900 dark:text-white"
            >
              {copy.secretLabel}
            </label>
            <div className="relative">
              <input
                id="role-secret"
                type={showSecret ? 'text' : 'password'}
                inputMode={targetRole === 'child' ? 'numeric' : 'text'}
                autoComplete="current-password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={copy.secretPlaceholder}
                required
                className="w-full min-h-[48px] pl-3.5 pr-12 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowSecret((s) => !s)}
                aria-label={showSecret ? 'Hide passcode' : 'Show passcode'}
                className="absolute right-1 top-1 min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
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
            className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition-colors whitespace-nowrap"
          >
            {submitting ? 'Signing in…' : copy.submitLabel}
          </button>
        </form>

        {targetRole === 'admin' && (
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Local Admin credentials:{' '}
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {LOCAL_ADMIN_DEFAULT_EMAIL}
            </span>{' '}
            /{' '}
            <span className="font-mono text-slate-700 dark:text-slate-300">
              admin123
            </span>
          </p>
        )}

        {/* Quick Portal Switcher */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Switch portal:</span>
          <div className="flex flex-wrap items-center gap-1 font-semibold">
            {(['parent', 'agent', 'admin', 'child'] as UserRole[])
              .filter((r) => r !== targetRole)
              .map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onNavigateRoute(`/${r}` as PlatformRoute)}
                  className="min-h-[44px] px-2.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 capitalize whitespace-nowrap transition-colors"
                >
                  {r === 'child' ? 'Student' : r}
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
