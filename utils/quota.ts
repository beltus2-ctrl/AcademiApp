import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const MAX_REQUETES_PAR_JOUR = 20;

export const verifierEtDecrementerQuota = async (): Promise<{
  autorise: boolean;
  requetesRestantes: number;
  message?: string;
}> => {
  const utilisateur = auth.currentUser;
  if (!utilisateur) {
    return { autorise: false, requetesRestantes: 0, message: 'Utilisateur non connecte' };
  }

  try {
    const docRef = doc(db, 'utilisateurs', utilisateur.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { autorise: false, requetesRestantes: 0, message: 'Profil introuvable' };
    }

    const data = docSnap.data();
    const aujourdhui = new Date().toDateString();
    const derniereReinit = data.derniereReinitialisation || '';
    let requetesRestantes = data.requetesRestantes ?? MAX_REQUETES_PAR_JOUR;

    if (derniereReinit !== aujourdhui) {
      requetesRestantes = MAX_REQUETES_PAR_JOUR;
      await updateDoc(docRef, {
        requetesRestantes: MAX_REQUETES_PAR_JOUR,
        derniereReinitialisation: aujourdhui,
      });
      return { autorise: true, requetesRestantes: MAX_REQUETES_PAR_JOUR - 1 };
    }

    if (requetesRestantes <= 0) {
      return {
        autorise: false,
        requetesRestantes: 0,
        message: 'Quota journalier atteint. Revenez demain ! 📅'
      };
    }

    await updateDoc(docRef, {
      requetesRestantes: requetesRestantes - 1,
    });

    return { autorise: true, requetesRestantes: requetesRestantes - 1 };

  } catch (erreur) {
    return { autorise: false, requetesRestantes: 0, message: 'Erreur de verification du quota' };
  }
};

export const obtenirQuota = async (): Promise<number> => {
  const utilisateur = auth.currentUser;
  if (!utilisateur) return 0;

  try {
    const docSnap = await getDoc(doc(db, 'utilisateurs', utilisateur.uid));
    if (!docSnap.exists()) return 0;

    const data = docSnap.data();
    const aujourdhui = new Date().toDateString();

    if (data.derniereReinitialisation !== aujourdhui) {
      return MAX_REQUETES_PAR_JOUR;
    }

    return data.requetesRestantes ?? MAX_REQUETES_PAR_JOUR;
  } catch {
    return 0;
  }
};