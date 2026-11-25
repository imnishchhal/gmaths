import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Lock,
  Sparkles,
  Tag,
  Ticket,
  X,
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { PromoValidationResult, usePlatform } from '../context/PlatformContext';
import {
  ANNUAL_PLAN_PRICE_INR,
  REFERRAL_DISCOUNT_INR,
  formatCurrency,
  formatIsoDate,
} from '../types/platform';

export const CheckoutModal: React.FC = () => {
  const { user, isConfigured, authLoading, signInWithGoogle } = useFirebase();
  const {
    isCheckoutOpen,
    checkoutInitialTab,
    closeCheckoutModal,
    capturedReferralCode,
    validatePromoCode,
    completeAnnualCheckout,
    redeemOfflineVoucher,
    isProSubscriber,
    myStudentSubscription,
  } = usePlatform();

  const [tab, setTab] = useState<'plan' | 'voucher'>('plan');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card'>('upi');
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState<PromoValidationResult | null>(
    null
  );
  const [checkingPromo, setCheckingPromo] = useState(false);

  const [voucherCode, setVoucherCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync defaults when modal opens
  useEffect(() => {
    if (!isCheckoutOpen) return;
    setTab(checkoutInitialTab);
    setError(null);
    setSuccessMessage(null);
    setName((prev) => prev || user?.displayName || '');
    setEmail((prev) => prev || user?.email || '');
    if (capturedReferralCode && !promoCode) {
      setPromoCode(capturedReferralCode);
    }
  }, [
    capturedReferralCode,
    checkoutInitialTab,
    isCheckoutOpen,
    promoCode,
    user?.displayName,
    user?.email,
  ]);

  // Auto-validate prefilled referral code when modal opens
  useEffect(() => {
    if (!isCheckoutOpen) return;
    const candidate = (promoCode || capturedReferralCode || '').trim();
    if (!candidate) {
      setPromoResult(null);
      return;
    }
    let cancelled = false;
    setCheckingPromo(true);
    void validatePromoCode(
      candidate,
      email || user?.email || undefined,
      phone || undefined
    ).then((res) => {
      if (!cancelled) {
        setPromoResult(res);
        setCheckingPromo(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    capturedReferralCode,
    email,
    isCheckoutOpen,
    phone,
    promoCode,
    user?.email,
    validatePromoCode,
  ]);

  if (!isCheckoutOpen) return null;

  const discount = promoResult?.valid ? promoResult.discountAmount : 0;
  const finalAmount = Math.max(0, ANNUAL_PLAN_PRICE_INR - discount);

  const handleApplyPromo = async () => {
    setError(null);
    const trimmed = promoCode.trim();
    if (!trimmed) {
      setPromoResult(null);
      return;
    }
    setCheckingPromo(true);
    const res = await validatePromoCode(
      trimmed,
      email || user?.email || undefined,
      phone || undefined
    );
    setPromoResult(res);
    setCheckingPromo(false);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isConfigured && !user) {
      setError('Please sign in with Google first to link your Pro subscription.');
      return;
    }

    setSubmitting(true);
    const res = await completeAnnualCheckout({
      subscriberName: name || user?.displayName || 'Student',
      subscriberEmail: email || user?.email || '',
      subscriberPhone: phone,
      paymentMethod,
      promoCode: promoCode.trim() || undefined,
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'Could not complete checkout.');
      return;
    }

    setSuccessMessage(
      `Annual Pro unlocked! Valid through ${formatIsoDate(
        res.subscription?.expiryDate ?? ''
      )} (${formatCurrency(res.subscription?.amountPaid ?? finalAmount)}).`
    );
  };

  const handleVoucherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isConfigured && !user) {
      setError('Please sign in with Google first to redeem your voucher.');
      return;
    }

    setSubmitting(true);
    const res = await redeemOfflineVoucher({
      voucherCode,
      subscriberName: name || user?.displayName || undefined,
      subscriberPhone: phone || undefined,
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'Could not redeem voucher code.');
      return;
    }

    setSuccessMessage(
      `Voucher activated! Annual Pro plan valid through ${formatIsoDate(
        res.subscription?.expiryDate ?? ''
      )}.`
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto">
        {/* Top Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Math Speedster Pro</span>
            </div>
            <h2
              id="checkout-modal-title"
              className="font-display text-lg sm:text-xl font-bold text-slate-950 dark:text-white"
            >
              Unlock Annual Pro Access
            </h2>
          </div>

          <button
            type="button"
            onClick={closeCheckoutModal}
            aria-label="Close checkout"
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[82vh] overflow-y-auto">
          {isProSubscriber && myStudentSubscription && !successMessage && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/35 p-4 flex items-start gap-2.5 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Annual Pro is already active</p>
                <p>
                  Valid until {formatIsoDate(myStudentSubscription.expiryDate)}.
                </p>
              </div>
            </div>
          )}

          {successMessage ? (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/30 p-6 text-center space-y-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                  Pro Subscription Active
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {successMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCheckoutModal}
                className="w-full min-h-[48px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
              >
                Continue Practicing
              </button>
            </div>
          ) : (
            <>
              {/* Included Features Summary */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-white">
                  Included in 1-Year Pro ({formatCurrency(ANNUAL_PLAN_PRICE_INR)}/year):
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <li className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    Unlimited Adaptive 5Q Drills
                  </li>
                  <li className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    Operation & Latency Analytics
                  </li>
                  <li className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    Custom Saved Drill Presets
                  </li>
                  <li className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    Use Referral Code for {formatCurrency(REFERRAL_DISCOUNT_INR)} Off
                  </li>
                </ul>
              </div>

              {/* Tab Switcher */}
              <div
                role="tablist"
                aria-label="Payment or voucher activation"
                className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'plan'}
                  onClick={() => {
                    setTab('plan');
                    setError(null);
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                    tab === 'plan'
                      ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4 shrink-0" />
                  UPI / Card
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'voucher'}
                  onClick={() => {
                    setTab('voucher');
                    setError(null);
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                    tab === 'voucher'
                      ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  <Ticket className="w-4 h-4 shrink-0" />
                  Cash Voucher
                </button>
              </div>

              {/* Google Sign-In Reminder if signed out */}
              {isConfigured && !user && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-blue-900 dark:text-blue-200">
                    <p className="font-semibold">Sign in with Google to sync Pro</p>
                    <p>Links your 1-year plan across desktop and mobile.</p>
                  </div>
                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={() => void signInWithGoogle()}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold whitespace-nowrap shrink-0"
                  >
                    {authLoading ? 'Connecting…' : 'Sign in with Google'}
                  </button>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 flex items-start gap-2 text-xs sm:text-sm text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {tab === 'plan' ? (
                <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                  {/* Referral / Promo Code Field */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="checkout-promo"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Referral / Promo Code (₹{REFERRAL_DISCOUNT_INR} Off)
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="checkout-promo"
                        type="text"
                        value={promoCode}
                        onChange={(e) =>
                          setPromoCode(e.target.value.toUpperCase())
                        }
                        placeholder="e.g. AG01"
                        className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono uppercase text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <button
                        type="button"
                        disabled={checkingPromo}
                        onClick={() => void handleApplyPromo()}
                        className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap"
                      >
                        {checkingPromo ? 'Checking…' : 'Apply'}
                      </button>
                    </div>
                    {promoResult && (
                      <p
                        className={`text-xs font-medium ${
                          promoResult.valid
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : promoResult.isSelfReferral
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {promoResult.message}
                      </p>
                    )}
                  </div>

                  {/* Subscriber Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Student / Parent Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Aarav Sharma"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="10-digit mobile"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Google Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@gmail.com"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Payment Mode
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: 'upi', label: 'UPI (GPay / PhonePe)' },
                          { id: 'card', label: 'Debit / Credit Card' },
                        ] as const
                      ).map((pm) => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setPaymentMethod(pm.id)}
                          className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                            paymentMethod === pm.id
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {pm.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Order Summary & Submit */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      <span className="block font-semibold text-slate-900 dark:text-white">
                        Annual Pro Total
                      </span>
                      {discount > 0 ? (
                        <span>
                          <s>{formatCurrency(ANNUAL_PLAN_PRICE_INR)}</s> −{' '}
                          {formatCurrency(discount)} referral perk
                        </span>
                      ) : (
                        <span>1 year · non-recurring</span>
                      )}
                    </div>
                    <span className="font-mono text-xl font-bold text-slate-950 dark:text-white tabular-nums">
                      {formatCurrency(finalAmount)}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || (isConfigured && !user)}
                    className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold inline-flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4 shrink-0" />
                    {submitting
                      ? 'Activating Annual Pro…'
                      : `Pay ${formatCurrency(finalAmount)} & Unlock 1 Year`}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVoucherSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="voucher-code-input"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Offline Cash Activation Voucher *
                    </label>
                    <input
                      id="voucher-code-input"
                      type="text"
                      required
                      value={voucherCode}
                      onChange={(e) =>
                        setVoucherCode(e.target.value.toUpperCase())
                      }
                      placeholder="GM-XXXXXX"
                      className="w-full min-h-[48px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-base font-mono uppercase tracking-wider text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Enter the 1-year voucher code received from an authorized
                      partner or Admin.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Student / Parent Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Optional"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Mobile Number
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Optional"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || (isConfigured && !user)}
                    className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold inline-flex items-center justify-center gap-2"
                  >
                    <Ticket className="w-4 h-4 shrink-0" />
                    {submitting ? 'Redeeming Voucher…' : 'Activate 1-Year Voucher'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
