import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { buildAgentAuthEmail } from '../utils/referral';
import {
  auth,
  googleProvider,
  isFirebaseConfigured,
  testFirestoreConnection,
} from '../lib/firebase';
import {
  clearLocalSessions,
  computePersonalBests,
  deleteCloudSession,
  ensureUserProfile,
  loadLocalSessions,
  removeLocalSession,
  saveLocalSession,
  saveSessionToCloud,
  subscribeLeaderboard,
  subscribeUserSessions,
  updateUserDisplayName,
} from '../lib/storage';
import { sanitizeDisplayName } from '../lib/firestoreValidation';
import { LeaderboardRecord, SessionRecord } from '../types/math';

const REDIRECT_PENDING_KEY = 'gmaths_google_redirect_pending_v1';

function extractAuthErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as { code?: unknown }).code ?? '');
  }
  const msg = err instanceof Error ? err.message : String(err);
  const match = /\((auth\/[a-z0-9-]+)\)/i.exec(msg);
  return match ? match[1] : '';
}

function formatGoogleAuthError(err: unknown): string | null {
  const code = extractAuthErrorCode(err);
  const host =
    typeof window !== 'undefined' ? window.location.hostname : 'this domain';

  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  ) {
    return null;
  }

  if (code === 'auth/unauthorized-domain') {
    return `Google Sign-In is blocked for "${host}" (auth/unauthorized-domain). Add "${host}" in Firebase Console → Authentication → Settings → Authorized domains.`;
  }

  if (code === 'auth/network-request-failed') {
    return 'Network error while connecting to Google Sign-In. Check your internet connection and try again.';
  }

  if (code === 'auth/web-storage-unsupported') {
    return 'Browser storage is disabled or blocked. Enable cookies/storage or open this page directly in Chrome or Safari.';
  }

  if (code === 'auth/internal-error' || code === 'auth/operation-not-allowed') {
    return `Google Sign-In is unavailable (${code}). Confirm Google provider is enabled in Firebase Console.`;
  }

  const rawMsg = err instanceof Error ? err.message : String(err);
  return code
    ? `Google Sign-In failed (${code}). Try the Redirect Sign-In option below.`
    : rawMsg || 'Unable to complete Google Sign-In.';
}

function shouldFallbackToRedirect(err: unknown): boolean {
  const code = extractAuthErrorCode(err);
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/web-storage-unsupported'
  );
}

export function formatPhoneAuthError(err: unknown): {
  code: string;
  message: string;
} {
  const code = extractAuthErrorCode(err);
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return {
      code,
      message: 'Incorrect phone number or password. Please check and try again.',
    };
  }
  if (code === 'auth/email-already-in-use') {
    return {
      code,
      message:
        'An Agent login for this phone number already exists. Sign in with your phone number and password.',
    };
  }
  if (code === 'auth/weak-password') {
    return {
      code,
      message: 'Password must be at least 6 characters long.',
    };
  }
  if (code === 'auth/too-many-requests') {
    return {
      code,
      message: 'Too many failed attempts. Please wait a moment and try again.',
    };
  }
  if (code === 'auth/network-request-failed') {
    return {
      code,
      message: 'Network error while signing in. Check your connection and try again.',
    };
  }
  if (code === 'auth/requires-recent-login') {
    return {
      code,
      message:
        'Please sign out and sign back in with your phone number and password before changing your password.',
    };
  }
  if (code === 'auth/operation-not-allowed') {
    return {
      code,
      message:
        'Phone & Password login requires Email/Password sign-in to be enabled in Firebase Console → Authentication → Sign-in method.',
    };
  }
  const raw = err instanceof Error ? err.message : String(err);
  return { code, message: raw || 'Unable to sign in with phone and password.' };
}

export interface PhoneAuthOutcome {
  user: User | null;
  code?: string;
  error?: string;
}

interface RecordOutcome {
  savedToCloud: boolean;
  leaderboardUpdated: boolean;
  cloudError?: string;
}

interface FirebaseContextValue {
  user: User | null;
  displayName: string;
  authReady: boolean;
  isConfigured: boolean;
  cloudOnline: boolean;
  authLoading: boolean;
  authError: string | null;
  cloudError: string | null;
  syncingCount: number;
  /** Increments whenever an explicit Google Sign-In (popup or redirect return) completes */
  googleSignInSeq: number;
  sessions: SessionRecord[];
  localOnlySessions: SessionRecord[];
  leaderboard: LeaderboardRecord[];
  leaderboardLoading: boolean;
  personalBests: Record<string, SessionRecord>;
  signInWithGoogle: () => Promise<User | null>;
  signInWithGoogleRedirect: () => Promise<void>;
  signInWithPhoneCredentials: (
    phone: string,
    password: string
  ) => Promise<PhoneAuthOutcome>;
  signUpWithPhoneCredentials: (
    phone: string,
    password: string,
    displayName: string
  ) => Promise<PhoneAuthOutcome>;
  changeCurrentPassword: (
    newPassword: string
  ) => Promise<{ ok: boolean; code?: string; error?: string }>;
  signOutUser: () => Promise<void>;
  updateName: (nextName: string) => Promise<void>;
  recordCompletedSession: (session: SessionRecord) => Promise<RecordOutcome>;
  syncLocalToCloud: () => Promise<number>;
  removeSession: (session: SessionRecord) => Promise<void>;
  clearAllLocalSessions: () => void;
  dismissErrors: () => void;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState<string>('Speedster');
  const [authReady, setAuthReady] = useState<boolean>(!isFirebaseConfigured);
  const [cloudOnline, setCloudOnline] = useState<boolean>(isFirebaseConfigured);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [syncingCount, setSyncingCount] = useState<number>(0);
  const [googleSignInSeq, setGoogleSignInSeq] = useState<number>(0);

  const [localSessions, setLocalSessions] = useState<SessionRecord[]>(() =>
    loadLocalSessions()
  );
  const [cloudSessions, setCloudSessions] = useState<SessionRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRecord[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState<boolean>(false);

  // Check Firestore connectivity once on boot
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let active = true;
    void testFirestoreConnection().then((ok) => {
      if (active) setCloudOnline(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  // Process any pending Google OAuth redirect result on app load (mobile browsers & GitHub Pages)
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;
    let active = true;

    void getRedirectResult(auth)
      .then((result) => {
        if (!active) return;
        if (result?.user) {
          try {
            window.sessionStorage.removeItem(REDIRECT_PENDING_KEY);
          } catch {
            // Ignore storage errors
          }
          setAuthError(null);
          setGoogleSignInSeq((seq) => seq + 1);
        }
      })
      .catch((err) => {
        if (!active) return;
        try {
          window.sessionStorage.removeItem(REDIRECT_PENDING_KEY);
        } catch {
          // Ignore storage errors
        }
        const formatted = formatGoogleAuthError(err);
        if (formatted) {
          setAuthError(formatted);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Auth listener with safety timeout so restricted mobile webviews never stall
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthReady(true);
      return;
    }

    const fallbackTimer = window.setTimeout(() => {
      setAuthReady(true);
    }, 3500);

    const unsubscribe = onAuthStateChanged(
      auth,
      async (nextUser) => {
        window.clearTimeout(fallbackTimer);
        setUser(nextUser);
        setAuthReady(true);

        if (nextUser) {
          // If returning from a mobile redirect flow where Safari cleared getRedirectResult,
          // still signal explicit Google Sign-In completion so auto-routing runs cleanly.
          try {
            if (window.sessionStorage.getItem(REDIRECT_PENDING_KEY) === '1') {
              window.sessionStorage.removeItem(REDIRECT_PENDING_KEY);
              setGoogleSignInSeq((seq) => seq + 1);
            }
          } catch {
            // Ignore storage errors
          }

          setDisplayName(
            sanitizeDisplayName(
              nextUser.displayName ?? nextUser.email?.split('@')[0]
            )
          );
          try {
            const verifiedName = await ensureUserProfile(nextUser);
            setDisplayName(verifiedName);
            setCloudError(null);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setCloudError(msg);
          }
        } else {
          setDisplayName('Speedster');
          setCloudSessions([]);
          setLeaderboard([]);
        }
      },
      () => {
        window.clearTimeout(fallbackTimer);
        setAuthReady(true);
      }
    );

    return () => {
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  // Attach real-time Firestore listeners ONLY once auth is ready and user is signed in
  useEffect(() => {
    if (!authReady || !user || !isFirebaseConfigured) {
      setLeaderboardLoading(false);
      return;
    }

    setLeaderboardLoading(true);
    const unsubSessions = subscribeUserSessions(
      user.uid,
      (items) => {
        setCloudSessions(items);
        setCloudError(null);
      },
      (err) => {
        setCloudError(err.message);
      }
    );

    const unsubLeaderboard = subscribeLeaderboard(
      (entries) => {
        setLeaderboard(entries);
        setLeaderboardLoading(false);
      },
      (err) => {
        setCloudError(err.message);
        setLeaderboardLoading(false);
      }
    );

    return () => {
      unsubSessions();
      unsubLeaderboard();
    };
  }, [authReady, user]);

  // Merge cloud & local speed-sprint sessions (cloud wins on duplicate IDs while preserving local attempts log)
  const sessions = useMemo(() => {
    const map = new Map<string, SessionRecord>();
    for (const local of localSessions) {
      map.set(local.id, local);
    }
    for (const cloud of cloudSessions) {
      const localMatch = map.get(cloud.id);
      map.set(cloud.id, {
        ...cloud,
        attempts: localMatch?.attempts,
      });
    }
    return Array.from(map.values()).sort(
      (a, b) => b.createdAtMs - a.createdAtMs
    );
  }, [localSessions, cloudSessions]);

  const localOnlySessions = useMemo(() => {
    const cloudIds = new Set(cloudSessions.map((c) => c.id));
    return localSessions.filter((l) => !cloudIds.has(l.id));
  }, [localSessions, cloudSessions]);

  const personalBests = useMemo(
    () => computePersonalBests(sessions),
    [sessions]
  );

  const signInWithGoogleRedirect = useCallback(async () => {
    if (!auth || !googleProvider) {
      setAuthError('Firebase Authentication is not configured.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      try {
        window.sessionStorage.setItem(REDIRECT_PENDING_KEY, '1');
      } catch {
        // Ignore storage errors
      }
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      try {
        window.sessionStorage.removeItem(REDIRECT_PENDING_KEY);
      } catch {
        // Ignore storage errors
      }
      const formatted = formatGoogleAuthError(err);
      if (formatted) setAuthError(formatted);
      setAuthLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    if (!auth || !googleProvider) {
      setAuthError('Firebase Authentication is not configured.');
      return null;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      setGoogleSignInSeq((seq) => seq + 1);
      setAuthLoading(false);
      return credential.user;
    } catch (err) {
      if (shouldFallbackToRedirect(err)) {
        try {
          try {
            window.sessionStorage.setItem(REDIRECT_PENDING_KEY, '1');
          } catch {
            // Ignore storage errors
          }
          await signInWithRedirect(auth, googleProvider);
          return null;
        } catch (redirectErr) {
          try {
            window.sessionStorage.removeItem(REDIRECT_PENDING_KEY);
          } catch {
            // Ignore storage errors
          }
          const formattedRedirect = formatGoogleAuthError(redirectErr);
          if (formattedRedirect) setAuthError(formattedRedirect);
          setAuthLoading(false);
          return null;
        }
      }

      const formatted = formatGoogleAuthError(err);
      if (formatted) {
        setAuthError(formatted);
      }
      setAuthLoading(false);
      return null;
    }
  }, []);

  const signInWithPhoneCredentials = useCallback(
    async (phone: string, password: string): Promise<PhoneAuthOutcome> => {
      if (!auth) {
        return {
          user: null,
          error: 'Firebase Authentication is not configured.',
        };
      }
      const authEmail = buildAgentAuthEmail(phone);
      if (!authEmail) {
        return {
          user: null,
          error: 'Enter a valid mobile phone number (at least 7 digits).',
        };
      }
      if (!password || password.length < 4) {
        return {
          user: null,
          error: 'Enter your agent password.',
        };
      }
      setAuthLoading(true);
      setAuthError(null);
      try {
        const credential = await signInWithEmailAndPassword(
          auth,
          authEmail,
          password
        );
        setAuthLoading(false);
        return { user: credential.user };
      } catch (err) {
        const formatted = formatPhoneAuthError(err);
        setAuthLoading(false);
        return {
          user: null,
          code: formatted.code,
          error: formatted.message,
        };
      }
    },
    []
  );

  const signUpWithPhoneCredentials = useCallback(
    async (
      phone: string,
      password: string,
      nextDisplayName: string
    ): Promise<PhoneAuthOutcome> => {
      if (!auth) {
        return {
          user: null,
          error: 'Firebase Authentication is not configured.',
        };
      }
      const authEmail = buildAgentAuthEmail(phone);
      if (!authEmail) {
        return {
          user: null,
          error: 'Enter a valid mobile phone number (at least 7 digits).',
        };
      }
      if (password.length < 6) {
        return {
          user: null,
          error: 'Password must be at least 6 characters long.',
        };
      }
      setAuthLoading(true);
      setAuthError(null);
      try {
        const credential = await createUserWithEmailAndPassword(
          auth,
          authEmail,
          password
        );
        const cleanName = sanitizeDisplayName(nextDisplayName || 'Partner');
        await updateProfile(credential.user, { displayName: cleanName }).catch(
          () => {}
        );
        setAuthLoading(false);
        return { user: credential.user };
      } catch (err) {
        const formatted = formatPhoneAuthError(err);
        setAuthLoading(false);
        return {
          user: null,
          code: formatted.code,
          error: formatted.message,
        };
      }
    },
    []
  );

  const changeCurrentPassword = useCallback(
    async (
      newPassword: string
    ): Promise<{ ok: boolean; code?: string; error?: string }> => {
      if (!auth || !auth.currentUser) {
        return {
          ok: false,
          error: 'Sign in with your phone number and password first.',
        };
      }
      if (newPassword.length < 6) {
        return {
          ok: false,
          error: 'New password must be at least 6 characters long.',
        };
      }
      try {
        await updatePassword(auth.currentUser, newPassword);
        return { ok: true };
      } catch (err) {
        const formatted = formatPhoneAuthError(err);
        return {
          ok: false,
          code: formatted.code,
          error: formatted.message,
        };
      }
    },
    []
  );

  const signOutUser = useCallback(async () => {
    if (!auth) return;
    setAuthError(null);
    try {
      await signOut(auth);
    } catch {
      setAuthError('Failed to sign out. Please try again.');
    }
  }, []);

  const updateName = useCallback(
    async (nextName: string) => {
      const cleaned = sanitizeDisplayName(nextName);
      setDisplayName(cleaned);
      if (user && isFirebaseConfigured) {
        try {
          const saved = await updateUserDisplayName(user, cleaned);
          setDisplayName(saved);
        } catch (err) {
          setCloudError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [user]
  );

  const recordCompletedSession = useCallback(
    async (session: SessionRecord): Promise<RecordOutcome> => {
      // 1. Keep local copy for anonymous quick-play stats
      const updatedLocal = saveLocalSession(session);
      setLocalSessions(updatedLocal);

      // 2. Persist directly to Cloud Firestore when authenticated
      if (!isFirebaseConfigured || !user) {
        return { savedToCloud: false, leaderboardUpdated: false };
      }

      setSyncingCount((c) => c + 1);
      try {
        const res = await saveSessionToCloud(user, session, displayName);
        setCloudError(null);
        return {
          savedToCloud: true,
          leaderboardUpdated: res.leaderboardUpdated,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setCloudError(msg);
        return {
          savedToCloud: false,
          leaderboardUpdated: false,
          cloudError: msg,
        };
      } finally {
        setSyncingCount((c) => Math.max(0, c - 1));
      }
    },
    [user, displayName]
  );

  const syncLocalToCloud = useCallback(async (): Promise<number> => {
    if (!user || !isFirebaseConfigured || localOnlySessions.length === 0) {
      return 0;
    }
    setSyncingCount((c) => c + 1);
    let synced = 0;
    try {
      for (const localSession of localOnlySessions) {
        await saveSessionToCloud(user, localSession, displayName);
        synced += 1;
      }
      setCloudError(null);
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncingCount((c) => Math.max(0, c - 1));
    }
    return synced;
  }, [user, localOnlySessions, displayName]);

  const removeSession = useCallback(
    async (session: SessionRecord) => {
      setLocalSessions(removeLocalSession(session.id));
      if (user && isFirebaseConfigured && session.source === 'cloud') {
        try {
          await deleteCloudSession(user.uid, session.id);
        } catch (err) {
          setCloudError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [user]
  );

  const clearAllLocalSessions = useCallback(() => {
    clearLocalSessions();
    setLocalSessions([]);
  }, []);

  const dismissErrors = useCallback(() => {
    setAuthError(null);
    setCloudError(null);
  }, []);

  const value = useMemo<FirebaseContextValue>(
    () => ({
      user,
      displayName,
      authReady,
      isConfigured: isFirebaseConfigured,
      cloudOnline,
      authLoading,
      authError,
      cloudError,
      syncingCount,
      googleSignInSeq,
      sessions,
      localOnlySessions,
      leaderboard,
      leaderboardLoading,
      personalBests,
      signInWithGoogle,
      signInWithGoogleRedirect,
      signInWithPhoneCredentials,
      signUpWithPhoneCredentials,
      changeCurrentPassword,
      signOutUser,
      updateName,
      recordCompletedSession,
      syncLocalToCloud,
      removeSession,
      clearAllLocalSessions,
      dismissErrors,
    }),
    [
      user,
      displayName,
      authReady,
      cloudOnline,
      authLoading,
      authError,
      cloudError,
      syncingCount,
      googleSignInSeq,
      sessions,
      localOnlySessions,
      leaderboard,
      leaderboardLoading,
      personalBests,
      signInWithGoogle,
      signInWithGoogleRedirect,
      signInWithPhoneCredentials,
      signUpWithPhoneCredentials,
      changeCurrentPassword,
      signOutUser,
      updateName,
      recordCompletedSession,
      syncLocalToCloud,
      removeSession,
      clearAllLocalSessions,
      dismissErrors,
    ]
  );

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return ctx;
}
