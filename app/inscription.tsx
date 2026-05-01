import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function Inscription() {
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [role, setRole] = useState('etudiant');
  const [chargement, setChargement] = useState(false);
  const router = useRouter();
  const [montrerMotDePasse, setMontrerMotDePasse] = useState(false);

  const sInscrire = async () => {
    if (!nom || !email || !motDePasse) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    if (motDePasse.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setChargement(true);
    try {
      const resultat = await createUserWithEmailAndPassword(auth, email, motDePasse);
      await setDoc(doc(db, 'utilisateurs', resultat.user.uid), {
        nom: nom,
        email: email,
        role: role,
        dateInscription: new Date().toISOString(),
      });
      Alert.alert('Succès', 'Compte créé avec succès !');
      router.replace('/login');
    } catch (erreur) {
      Alert.alert('Erreur', 'email invalide ou mot de passe incorrect ! veuillez réessayer.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.titre}>Inscription 📝</Text>

      <TextInput
        style={styles.champ}
        placeholder="Nom complet"
        placeholderTextColor="#8BA4C4"
        value={nom}
        onChangeText={setNom}
      />
      <TextInput
        style={styles.champ}
        placeholder="Email"
        placeholderTextColor="#8BA4C4"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <View style={styles.champContainer}>
      <TextInput
        style={styles.champSansMargin}
        placeholder="Mot de passe (min. 6 caractères)"
        placeholderTextColor="#8BA4C4"
        value={motDePasse}
        onChangeText={setMotDePasse}
        secureTextEntry={!montrerMotDePasse}
      />
      <TouchableOpacity onPress={() => setMontrerMotDePasse(!montrerMotDePasse)}>
        <Text style={styles.oeil}>{montrerMotDePasse ? '🙈' : '👁️'}</Text>
      </TouchableOpacity>
      </View>

      <Text style={styles.labelRole}>Je suis :</Text>
      <View style={styles.rolesContainer}>
        {['etudiant', 'professeur'].map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.roleBtn, role === r && styles.roleBtnActif]}
            onPress={() => setRole(r)}
          >
            <Text style={[styles.roleTexte, role === r && styles.roleTexteActif]}>
              {r === 'etudiant' ? '📚 Étudiant' : '🎓 Professeur'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.bouton} onPress={sInscrire}>
        <Text style={styles.texteBouton}>
          {chargement ? 'Création du compte...' : "S'inscrire"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace('/login')}>
        <Text style={styles.lienConnexion}>Déjà un compte ? Se connecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  titre: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 32,
    textAlign: 'center',
  },
  champ: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  labelRole: {
    color: '#8BA4C4',
    fontSize: 14,
    marginBottom: 10,
  },
  rolesContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  roleBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  roleBtnActif: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  roleTexte: {
    color: '#8BA4C4',
    fontWeight: '600',
  },
  roleTexteActif: {
    color: '#FFFFFF',
  },
  bouton: {
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  texteBouton: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  lienConnexion: {
    color: '#8BA4C4',
    textAlign: 'center',
    fontSize: 14,
  },
  champContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'rgba(255,255,255,0.1)',
  borderRadius: 10,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.2)',
  marginBottom: 16,
  paddingRight: 14,
},
champSansMargin: {
  flex: 1,
  padding: 14,
  color: '#FFFFFF',
  fontSize: 15,
},
oeil: {
  fontSize: 18,
},
});