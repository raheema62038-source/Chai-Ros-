import { initializeApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;
export const ADMIN_EMAIL = 'raheema62038@gmail.com';
export const ADMIN_EMAILS = [
  'raheema62038@gmail.com',
  'isaqureshinew@gmail.com',
];

export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

// Configure persistent browser session
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Session persistence warning:', err);
});

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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
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

export async function verifyFirestoreConnection(): Promise<{
  connected: boolean;
  errorHi?: string;
}> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { connected: true };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
      return {
        connected: false,
        errorHi:
          'Firebase सर्वर से संपर्क नहीं हो पा रहा है। कृपया अपना इंटरनेट कनेक्शन या Firebase कॉन्फ़िगरेशन जांचें।',
      };
    }
    // Even if 'test/connection' returns permission error before rules propagate, server responded
    return { connected: true };
  }
}

// Run initial connection check on boot
verifyFirestoreConnection();

export interface TranslatedAuthError {
  messageHi: string;
  messageEn: string;
  code: string;
  requiresConsoleProviderSetup: boolean;
  providerToEnable?: 'Email/Password' | 'Phone';
}

export function translateFirebaseAuthError(error: unknown): TranslatedAuthError {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const codeMatch = rawMessage.match(/\((auth\/[a-z0-9-]+)\)/);
  const code = codeMatch ? codeMatch[1] : 'auth/unknown';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return {
        code,
        messageHi:
          'ईमेल आईडी या पासवर्ड गलत है। यदि आप पासवर्ड भूल गए हैं तो "पासवर्ड भूल गए?" पर क्लिक करें, या नया खाता बनाने के लिए "नया अकाउंट बनाएं" चुनें।',
        messageEn:
          'Invalid Email ID or Password. Click "Forgot Password?" to reset your password, or "Create New Account" to register.',
        requiresConsoleProviderSetup: false,
      };
    case 'auth/user-not-found':
      return {
        code,
        messageHi:
          'इस ईमेल आईडी से कोई खाता नहीं मिला। कृपया "नया अकाउंट बनाएं" पर क्लिक करके रजिस्टर करें।',
        messageEn:
          'No account found with this Email ID. Please click "Create New Account" to register first.',
        requiresConsoleProviderSetup: false,
      };
    case 'auth/email-already-in-use':
      return {
        code,
        messageHi:
          'यह ईमेल आईडी पहले से पंजीकृत है। कृपया अपने पासवर्ड से लॉगिन करें या "पासवर्ड भूल गए?" का उपयोग करें।',
        messageEn:
          'This Email ID is already registered. Please log in with your password or use "Forgot Password?".',
        requiresConsoleProviderSetup: false,
      };
    case 'auth/invalid-email':
      return {
        code,
        messageHi:
          'दर्ज की गई ईमेल आईडी अमान्य है। कृपया सही ईमेल आईडी दर्ज करें (जैसे name@gmail.com)।',
        messageEn:
          'Invalid Email ID format. Please enter a valid email address (e.g. name@gmail.com).',
        requiresConsoleProviderSetup: false,
      };
    case 'auth/weak-password':
      return {
        code,
        messageHi:
          'पासवर्ड बहुत कमज़ोर है। सुरक्षा के लिए कृपया कम से कम 6 अक्षरों का मज़बूत पासवर्ड चुनें।',
        messageEn:
          'Password is too weak. Please choose a strong password with at least 6 characters.',
        requiresConsoleProviderSetup: false,
      };
    case 'auth/operation-not-allowed':
      return {
        code,
        messageHi:
          'Firebase Console में Email/Password साइन-इन विधि अभी सक्रिय (Enabled) नहीं है। नीचे दिए गए "Firebase सेटअप गाइड" बटन से इसे 30 सेकंड में चालू करें, या अभी तुरंत "Google से लॉगिन करें" का उपयोग करें।',
        messageEn:
          'Email/Password sign-in is not yet enabled in Firebase Console. Open the "Firebase Setup Guide" below to enable it in 30 seconds, or use "Sign in with Google" right away.',
        requiresConsoleProviderSetup: true,
        providerToEnable: 'Email/Password',
      };
    case 'auth/too-many-requests':
      return {
        code,
        messageHi:
          'बार-बार गलत प्रयास के कारण सुरक्षा के लिए खाता कुछ समय के लिए रोका गया है। कृपया थोड़ी देर बाद पुनः प्रयास करें।',
        messageEn:
          'Account temporarily locked due to too many failed attempts. Please try again after a few minutes.',
        requiresConsoleProviderSetup: false,
      };
    case 'auth/popup-closed-by-user':
      return {
        code,
        messageHi: 'लॉगिन विंडो बंद कर दी गई। कृपया दोबारा प्रयास करें।',
        messageEn: 'Sign-in popup was closed. Please try again.',
        requiresConsoleProviderSetup: false,
      };
    case 'auth/network-request-failed':
      return {
        code,
        messageHi: 'इंटरनेट कनेक्शन में समस्या है। कृपया अपना नेटवर्क जांचें और पुनः प्रयास करें।',
        messageEn: 'Network connection error. Please check your internet and try again.',
        requiresConsoleProviderSetup: false,
      };
    default:
      if (rawMessage.includes('Quota exceeded')) {
        return {
          code: 'firestore/quota-exceeded',
          messageHi:
            'आज का मुफ़्त डेटाबेस कोटा समाप्त हो गया है। यह कल स्वतः रीसेट हो जाएगा।',
          messageEn:
            'Daily free database quota exceeded. It will reset automatically tomorrow.',
          requiresConsoleProviderSetup: false,
        };
      }
      return {
        code,
        messageHi: `प्रमाणीकरण में त्रुटि हुई (${code})। कृपया विवरण जांचें और पुनः प्रयास करें।`,
        messageEn: `Authentication error (${code}). Please check your details and try again.`,
        requiresConsoleProviderSetup: false,
      };
  }
}
