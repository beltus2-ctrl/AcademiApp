import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
const firebaseConfig = {
    apiKey: "AIzaSyBMt_orAjIF0VVtFded4z2ZV1N-SRjM4QQ",
    authDomain: "academiapp-f0b53.firebaseapp.com",
    projectId: "academiapp-f0b53",
    storageBucket: "academiapp-f0b53.firebasestorage.app",
    messagingSenderId: "939484010415",
    appId: "1:939484010415:web:22b9ce4d15fff8b4b7c15a"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const initAuth = () => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
};

export const auth = initAuth();

export const db = getFirestore(app);
export const storage = getStorage(app);
