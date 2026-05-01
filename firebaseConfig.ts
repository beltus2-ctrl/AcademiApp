import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
const firebaseConfig = {
    apiKey: "AIzaSyBMt_orAjIF0VVtFded4z2ZV1N-SRjM4QQ",
    authDomain: "academiapp-f0b53.firebaseapp.com",
    projectId: "academiapp-f0b53",
    storageBucket: "academiapp-f0b53.firebasestorage.app",
    messagingSenderId: "939484010415",
    appId: "1:939484010415:web:22b9ce4d15fff8b4b7c15a"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getFirestore(app);