import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';

export default function TableauProfesseur() {
  const router = useRouter();
   const [nom, setNom] = useState('');
  
  useEffect(() => {
    const recupererNom = async () => {
      const utilisateur = auth.currentUser;
      if (utilisateur) {
        const docSnap = await getDoc(doc(db, 'utilisateurs', utilisateur.uid));
        if (docSnap.exists()) {
          setNom(docSnap.data().nom);
        }
      }
    };
    recupererNom();
  }, []);

  const seDeconnecter = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (erreur) {
      Alert.alert('Erreur', 'Impossible de se déconnecter');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titre}>🎓 Espace Professeur</Text>
      <Text style={styles.sousTitre}>Bienvenue {nom} !</Text>

      <View style={styles.grille}>
        <TouchableOpacity style={styles.carte}>
          <Text style={styles.icone}>💬</Text>
          <Text style={styles.texteCarte}>Chats</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.carte}>
          <Text style={styles.icone}>📞</Text>
          <Text style={styles.texteCarte}>Appels reçus</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.carte}>
          <Text style={styles.icone}>📝</Text>
          <Text style={styles.texteCarte}>Corrections</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.carte}>
          <Text style={styles.icone}>📊</Text>
          <Text style={styles.texteCarte}>Progression</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.boutonDeconnexion} onPress={seDeconnecter}>
        <Text style={styles.texteDeconnexion}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  titre: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  sousTitre: {
    fontSize: 15,
    color: '#8BA4C4',
    textAlign: 'center',
    marginBottom: 36,
  },
  grille: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'center',
  },
  carte: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    width: '44%',
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  icone: {
    fontSize: 32,
    marginBottom: 10,
  },
  texteCarte: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  boutonDeconnexion: {
    marginTop: 36,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,100,100,0.4)',
    alignItems: 'center',
  },
  texteDeconnexion: {
    color: '#FF6B6B',
    fontWeight: '600',
    fontSize: 14,
  },
});