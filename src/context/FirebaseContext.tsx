import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
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
  sessions: SessionRecord[];
  localOnlySessions: SessionRecord[];
  leaderboard: LeaderboardRecord[];
  leaderboardLoading: boolean;
  personalBests: Record<string, SessionRecord>;
  signInWithGoogle: () => Promise<void>;
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

  // Auth listener with safety timeout so restricted mobile webviews never stall
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthReady(true);
      return;
    }

    const fallbackTimer = window.setTimeout(() => {
      setAuthReady(true);
    }, 3000);

    const unsubscribe = onAuthStateChanged(
      auth,
      async (nextUser) => {
        window.clearTimeout(fallbackTimer);
        setUser(nextUser);
        setAuthReady(true);

        if (nextUser) {
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

  // Merge cloud & local sessions (cloud wins on duplicate IDs while preserving local attempts log)
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

  const signInWithGoogle = useCallback(async () => {
    if (!auth || !googleProvider) {
      setAuthError('Firebase is not configured. Playing in local mode.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to complete sign-in.';
      if (!message.includes('popup-closed-by-user')) {
        setAuthError('Google sign-in could not complete. Please allow popups and try again.');
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

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
      // 1. Always persist locally immediately (zero latency, works offline)
      const updatedLocal = saveLocalSession(session);
      setLocalSessions(updatedLocal);

      // 2. Persist to Cloud Firestore when configured and authenticated
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
      sessions,
      localOnlySessions,
      leaderboard,
      leaderboardLoading,
      personalBests,
      signInWithGoogle,
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
      sessions,
      localOnlySessions,
      leaderboard,
      leaderboardLoading,
      personalBests,
      signInWithGoogle,
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
