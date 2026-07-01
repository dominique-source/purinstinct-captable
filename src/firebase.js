import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(firebaseConfig.apiKey);

export const app = firebaseEnabled ? initializeApp(firebaseConfig) : null;
export const db = firebaseEnabled ? getFirestore(app) : null;
export const auth = firebaseEnabled ? getAuth(app) : null;

let readyResolve;
export const authReady = new Promise((resolve) => { readyResolve = resolve; });

if (firebaseEnabled) {
  onAuthStateChanged(auth, (user) => {
    if (user) readyResolve(user);
  });
  signInAnonymously(auth).catch((err) => console.error("Firebase anonymous sign-in failed", err));
}
