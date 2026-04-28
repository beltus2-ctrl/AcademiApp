import { initializeApp } from "firebase/app"; //démarre la connexion
import { getAuth } from "firebase/auth"; // gère l'authentification
import { getFirestore } from "firebase/firestore"; //gère la base de données
import { getStorage } from "firebase/storage"; // gère le stockage de fichiers
// clés d'identification : 
const firebaseConfig = {
    apiKey: "AIzaSyBMt_orAjIF0VVtFded4z2ZV1N-SRjM4QQ",
    authDomain: "academiapp-f0b53.firebaseapp.com",
    projectId: "academiapp-f0b53",
    storageBucket: "academiapp-f0b53.firebasestorage.app",
    messagingSenderId: "939484010415",
    appId: "1:939484010415:web:22b9ce4d15fff8b4b7c15a"
};

const app = initializeApp(firebaseConfig);// établit la connexion entre AcademiApp et firebase en utilisant les clés
// les exports permettent à n'importe quel fichier de l'application d'utiliser le Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
