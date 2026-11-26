import React, { useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Phone,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { usePlatform } from '../../context/PlatformContext';
import { PlatformRoute } from '../../types/platform';
import { isPhoneAgentAuthEmail } from '../../utils/referral';

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
    title: 'Sales Partner & Agent Sign-In',
    subtitle:
      'Sign in with your mobile phone number and password to track referrals, onboard families, and request UPI payouts.',
    googleHint:
      'Legacy option for Agent profiles previously linked to a Google email.',
    idLabel: 'Phone Number or Agent ID',
    idPlaceholder: 'e.g. 9876543210 or AG01',
    secretLabel: 'Password',
    secretPlaceholder: 'Enter your password',
    submitLabel: 'Sign In to Agent Portal',
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
    loginAgentPhonePassword,
    loginAgentPasscode,
    loginParentPasscode,
    registerSalesAgent,
    logoutRole,
  } = usePlatform();

  // Primary Agent Phone + Password login state
  const [agentPhone, setAgentPhone] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [showAgentPassword, setShowAgentPassword] = useState(false);
  const [submittingAgentLogin, setSubmittingAgentLogin] = useState(false);

  // Sales Partner Registration (Phone + Password)
  const [showPartnerSignup, setShowPartnerSignup] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [partnerPassword, setPartnerPassword] = useState('');
  const [showPartnerPassword, setShowPartnerPassword] = useState(false);
  const [partnerCity, setPartnerCity] = useState('');
  const [partnerUpi, setPartnerUpi] = useState('');
  const [partnerCode, setPartnerCode] = useState('');
  const [submittingPartner, setSubmittingPartner] = useState(false);

  // Legacy Google Sign-In toggle (for /agent) & Secondary Passcode form (for /parent)
  const [showLegacyGoogle, setShowLegacyGoogle] = useState(false);
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

  const handleAgentPhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmittingAgentLogin(true);
    const res = await loginAgentPhonePassword(agentPhone, agentPassword);
    setSubmittingAgentLogin(false);
    if (!res.ok) {
      setError(res.error || 'Incorrect phone number or password.');
      return;
    }
    onNavigateRoute('/agent');
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

  const handlePartnerSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmittingPartner(true);
    const res = await registerSalesAgent({
      name: partnerName,
      phone: partnerPhone,
      password: partnerPassword,
      city: partnerCity,
      upiId: partnerUpi,
      agentCode: partnerCode.trim() || undefined,
    });
    setSubmittingPartner(false);
    if (!res.ok) {
      setError(res.error || 'Could not submit Sales Partner application.');
      return;
    }
    onNavigateRoute('/agent');
  };

  const combinedError = error || authError || roleResolveNotice;
  const activeEmailDisplay =
    user?.email && isPhoneAgentAuthEmail(user.email)
      ? user.email.replace(/^agent\./, '').replace(/@gmaths\.local$/, '')
      : user?.email;

  return (
    <div className="max-w-md mx-auto px-4 py-8 sm:py-14">
      <div className="rounded-3xl border-2 border-sky-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-[0_6px_0_0_rgba(186,230,253,0.45)] dark:shadow-none p-5 sm:p-7 space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400">
            <Icon className="w-5 h-5 shrink-0" />
            <span className="text-xs font-bold">
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
          <div className="rounded-2xl border-2 border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/30 px-4 py-3 text-xs sm:text-sm font-medium text-sky-800 dark:text-sky-300">
            Syncing your Cloud Firestore account ({activeEmailDisplay})…
          </div>
        )}

        {combinedError && (
          <div className="rounded-2xl border-2 border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-3 flex items-start gap-2.5 text-xs sm:text-sm font-medium text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">{combinedError}</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* AGENT PORTAL: PHONE NUMBER + PASSWORD PRIMARY FLOW                */}
        {/* ================================================================= */}
        {targetRole === 'agent' ? (
          <>
            <form onSubmit={handleAgentPhoneSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <label
                  htmlFor="agent-login-phone"
                  className="block text-xs font-semibold text-slate-900 dark:text-white"
                >
                  Registered Phone Number *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="agent-login-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    value={agentPhone}
                    onChange={(e) => setAgentPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full min-h-[46px] pl-10 pr-3.5 py-2 rounded-2xl border-2 border-sky-100 dark:border-slate-700 bg-sky-50/40 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="agent-login-password"
                  className="block text-xs font-bold text-slate-900 dark:text-white"
                >
                  Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="agent-login-password"
                    type={showAgentPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={agentPassword}
                    onChange={(e) => setAgentPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full min-h-[46px] pl-10 pr-12 py-2 rounded-2xl border-2 border-sky-100 dark:border-slate-700 bg-sky-50/40 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAgentPassword((v) => !v)}
                    aria-label={
                      showAgentPassword ? 'Hide password' : 'Show password'
                    }
                    className="absolute right-0.5 top-0.5 min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    {showAgentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingAgentLogin || authLoading}
                className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 border-b-4 border-orange-700 active:border-b-0 active:translate-y-[2px] disabled:opacity-50 text-white font-display text-sm sm:text-base font-bold transition-all whitespace-nowrap"
              >
                {submittingAgentLogin || authLoading
                  ? 'Signing In…'
                  : 'Sign In with Phone & Password'}
              </button>
            </form>

            {/* Sales Partner Self-Onboarding (Phone + Password Registration) */}
            <div className="pt-3 border-t-2 border-sky-100 dark:border-slate-800 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setShowPartnerSignup((v) => !v);
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl border-2 border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/30 flex items-center justify-between text-xs font-bold text-sky-700 dark:text-sky-300"
              >
                <span className="inline-flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 shrink-0" />
                  Apply as Sales Partner (₹300–₹350/sale)
                </span>
                {showPartnerSignup ? (
                  <ChevronUp className="w-4 h-4 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 shrink-0" />
                )}
              </button>

              {showPartnerSignup && (
                <form
                  onSubmit={handlePartnerSignupSubmit}
                  className="space-y-3 pt-1"
                >
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-900 dark:text-white">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                      placeholder="e.g. Priya Nair"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-900 dark:text-white">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        required
                        value={partnerPhone}
                        onChange={(e) => setPartnerPhone(e.target.value)}
                        placeholder="10-digit mobile"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-900 dark:text-white">
                        City *
                      </label>
                      <input
                        type="text"
                        required
                        value={partnerCity}
                        onChange={(e) => setPartnerCity(e.target.value)}
                        placeholder="e.g. Pune"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-900 dark:text-white">
                      Create Password * (min 6 characters)
                    </label>
                    <div className="relative">
                      <input
                        type={showPartnerPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        value={partnerPassword}
                        onChange={(e) => setPartnerPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full min-h-[44px] pl-3 pr-12 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPartnerPassword((v) => !v)}
                        aria-label={
                          showPartnerPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                        className="absolute right-0.5 top-0 min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        {showPartnerPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-900 dark:text-white">
                        UPI ID (for Payouts) *
                      </label>
                      <input
                        type="text"
                        required
                        value={partnerUpi}
                        onChange={(e) => setPartnerUpi(e.target.value)}
                        placeholder="name@okicici"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-900 dark:text-white">
                        Preferred Code
                      </label>
                      <input
                        type="text"
                        value={partnerCode}
                        onChange={(e) =>
                          setPartnerCode(e.target.value.toUpperCase())
                        }
                        placeholder="Optional (e.g. PRIYA26)"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono uppercase text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingPartner || authLoading}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 border-b-4 border-emerald-700 active:border-b-0 active:translate-y-[2px] disabled:opacity-50 text-white font-display text-sm sm:text-base font-bold transition-all"
                  >
                    {submittingPartner
                      ? 'Creating Partner Account…'
                      : 'Register & Open Partner Portal'}
                  </button>
                </form>
              )}
            </div>

            {/* Active Session Notice or Legacy Google Account Sign-In */}
            {isConfigured && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                {user && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-2.5">
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Currently signed in
                      </p>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white break-all">
                        {activeEmailDisplay}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleGoogleSignIn()}
                        className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold whitespace-nowrap"
                      >
                        Open Assigned Portal
                      </button>
                      <button
                        type="button"
                        onClick={() => void logoutRole()}
                        className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowLegacyGoogle((v) => !v)}
                  className="w-full min-h-[44px] flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <span>Legacy Google Account Sign-In</span>
                  {showLegacyGoogle ? (
                    <ChevronUp className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  )}
                </button>

                {showLegacyGoogle && (
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={() => void handleGoogleSignIn()}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-900 dark:text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
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
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {copy.googleHint}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* ================================================================= */
          /* ADMIN & PARENT PORTALS: GOOGLE SIGN-IN + PASSCODE SWITCH          */
          /* ================================================================= */
          <>
            {isConfigured ? (
              <div className="space-y-3">
                {!user ? (
                  <>
                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={() => void handleGoogleSignIn()}
                      className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 border-b-4 border-orange-700 active:border-b-0 active:translate-y-[2px] disabled:opacity-50 text-white font-display text-sm sm:text-base font-bold transition-all whitespace-nowrap"
                    >
                      {authLoading
                        ? 'Connecting Google…'
                        : 'Sign in with Google'}
                    </button>

                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={() => void signInWithGoogleRedirectFlow()}
                      className="w-full min-h-[44px] px-4 py-2 rounded-2xl border-2 border-sky-200 dark:border-slate-700 bg-sky-50/70 dark:bg-slate-950 hover:bg-sky-100 dark:hover:bg-slate-800 disabled:opacity-50 text-xs font-bold text-sky-800 dark:text-slate-300 transition-colors"
                    >
                      Popup blocked on mobile? Use Redirect Sign-In
                    </button>
                  </>
                ) : (
                  <div className="rounded-2xl border-2 border-sky-100 dark:border-slate-800 bg-sky-50/50 dark:bg-slate-950/60 p-4 space-y-3">
                    <div className="space-y-0.5">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Signed in account
                      </p>
                      <p className="text-sm font-bold text-slate-950 dark:text-white break-all">
                        {activeEmailDisplay}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleGoogleSignIn()}
                        className="flex-1 min-h-[44px] px-3.5 py-2 rounded-2xl bg-orange-500 hover:bg-orange-600 border-b-4 border-orange-700 active:border-b-0 active:translate-y-[2px] text-white text-xs sm:text-sm font-bold transition-all whitespace-nowrap"
                      >
                        Open My Assigned Portal
                      </button>
                      <button
                        type="button"
                        onClick={() => void logoutRole()}
                        className="min-h-[44px] px-3.5 py-2 rounded-2xl border-2 border-sky-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
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
              <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-xs sm:text-sm text-amber-800 dark:text-amber-300">
                Firebase is not configured yet. Configure Cloud Firestore to
                enable multi-device portals.
              </div>
            )}

            {/* Secondary Passcode Switch (Only when connected for Parent portal switching) */}
            {user && targetRole === 'parent' && (
              <div className="pt-3 border-t-2 border-sky-100 dark:border-slate-800 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowPasscodeForm((v) => !v)}
                  className="w-full min-h-[44px] flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <span>Switch to a synced parent account with passcode</span>
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
                        className="block text-xs font-bold text-slate-900 dark:text-white"
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
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl border-2 border-sky-100 dark:border-slate-700 bg-sky-50/40 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="role-secret"
                        className="block text-xs font-bold text-slate-900 dark:text-white"
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
                          className="w-full min-h-[44px] pl-3.5 pr-12 py-2 rounded-2xl border-2 border-sky-100 dark:border-slate-700 bg-sky-50/40 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret((s) => !s)}
                          aria-label={
                            showSecret ? 'Hide passcode' : 'Show passcode'
                          }
                          className="absolute right-0.5 top-0 min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
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
                      className="w-full min-h-[46px] px-4 py-2 rounded-2xl bg-sky-500 hover:bg-sky-600 border-b-4 border-sky-700 active:border-b-0 active:translate-y-[2px] disabled:opacity-50 text-white text-sm font-bold transition-all whitespace-nowrap"
                    >
                      {submitting ? 'Verifying…' : copy.submitLabel}
                    </button>
                  </form>
                )}
              </div>
            )}
          </>
        )}

        {/* Quick Portal Switcher (Admin, Agent, Parent only — no child login) */}
        <div className="pt-4 border-t-2 border-sky-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Switch portal:</span>
          <div className="flex flex-wrap items-center gap-1 font-bold">
            {(['parent', 'agent', 'admin'] as AuthPortalRole[])
              .filter((r) => r !== targetRole)
              .map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onNavigateRoute(`/${r}` as PlatformRoute)}
                  className="min-h-[44px] px-2.5 rounded-xl text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 capitalize whitespace-nowrap transition-colors"
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
