import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  signOut,
  type Auth,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import rawFirebaseConfig from '../../firebase-applet-config.json';

/**
 * Clean Firebase configuration interface.
 * In AI Studio, firebase-applet-config.json is provisioned automatically.
 * If this app is exported or remixed with placeholder values, isFirebaseConfigured
 * evaluates to false and Math Speedster falls back cleanly to localStorage.
 */
export interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}

/**
 * Reference placeholder template when running outside a provisioned project.
 */
export const FIREBASE_CONFIG_PLACEHOLDER: FirebaseAppletConfig = {
  projectId: 'YOUR_FIREBASE_PROJECT_ID',
  appId: 'YOUR_FIREBASE_APP_ID',
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  firestoreDatabaseId: '(default)',
};

const firebaseConfig = rawFirebaseConfig as Partial<FirebaseAppletConfig>;

function hasValidConfig(cfg: Partial<FirebaseAppletConfig> | undefined): cfg is FirebaseAppletConfig {
  if (!cfg) return false;
  const projectId = (cfg.projectId ?? '').trim();
  const apiKey = (cfg.apiKey ?? '').trim();
  const appId = (cfg.appId ?? '').trim();

  if (!projectId || !apiKey || !appId) return false;
  if (
    projectId === 'remixed-project-id' ||
    projectId.startsWith('YOUR_') ||
    apiKey.startsWith('YOUR_')
  ) {
    return false;
  }
  return true;
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let firebaseReady = false;

if (hasValidConfig(firebaseConfig)) {
  try {
    app = initializeApp(firebaseConfig);
    db = firebaseConfig.firestoreDatabaseId
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    firebaseReady = true;
  } catch (err) {
    console.warn(
      'Firebase initialization unavailable in this browser context; falling back to localStorage.',
      err
    );
    app = null;
    db = null;
    auth = null;
    googleProvider = null;
    firebaseReady = false;
  }
}

export const isFirebaseConfigured = firebaseReady;

export { app, db, auth, googleProvider, firebaseConfig };

/**
 * Creates a Firebase Email/Password auth user in an isolated secondary app instance
 * so an active Admin Google session is never signed out when provisioning an Agent.
 */
export async function provisionAgentAuthAccount(
  authEmail: string,
  password: string
): Promise<string | null> {
  if (!firebaseReady || !hasValidConfig(firebaseConfig)) return null;
  const secondaryApp =
    getApps().find((item) => item.name === 'agent_provisioner') ??
    initializeApp(firebaseConfig, 'agent_provisioner');
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      authEmail,
      password
    );
    return credential.user.uid;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

/**
 * Structured Firestore error wrapper required for permission debugging and ErrorBoundary surfacing.
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Startup connectivity validation against Firestore server.
 * Catches misconfiguration or offline client errors early without blocking local play.
 */
export async function testFirestoreConnection(): Promise<boolean> {
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error(
        'Please check your Firebase configuration. Firestore client is offline.'
      );
      return false;
    }
    // Permission denied on /test/connection still proves the Firestore backend responded online
    return true;
  }
}

void testFirestoreConnection();
