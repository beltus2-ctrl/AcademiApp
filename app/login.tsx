import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../firebaseConfig';

export default function Login() {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);
  const router = useRouter();

  const seConnecter = async () => {
    if (!email || !motDePasse) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    setChargement(true);
    try {
      await signInWithEmailAndPassword(auth, email, motDePasse);
      Alert.alert('Succès', 'Connexion réussie !');
    } catch (erreur) {
      Alert.alert('Erreur', 'Email ou mot de passe incorrect');
    } finally {
      setChargement(false);
    }
  };

  return (
    <View>
      <Text style={styles.titre}>Connexion 🎓</Text>
      <TextInput
        style={styles.champ}
        placeholder="Email"
        placeholderTextColor="#8BA4C4"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.champ}
        placeholder="Mot de passe"
        placeholderTextColor="#8BA4C4"
        value={motDePasse}
        onChangeText={setMotDePasse}
        secureTextEntry
      />
      <TouchableOpacity style={styles.bouton} onPress={seConnecter}>
        <Text style={styles.texteBouton}>
          {chargement ? 'Connexion...' : 'Se connecter'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.replace('/inscription')}>
        <Text style={styles.lienInscription}>Pas de compte ? S'inscrire</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
  lienInscription: {
    color: '#8BA4C4',
    textAlign: 'center',
    fontSize: 14,
  },
});