import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { obtenirQuota, verifierEtDecrementerQuota } from '../../utils/quota';

import { API_URL } from '../../utils/config';

import { doc, setDoc } from "firebase/firestore";
import { KeyboardAvoidingView, Platform } from 'react-native';
import { auth, db } from "../../firebaseConfig";

interface Exercice {
  id: number;
  titre: string;
  enonce: string;
  indices: string[];
  solution: string;
  explication: string;
  difficulte: string;
  points: number;
}

const MESSAGES_ENCOURAGEMENT = [
  'Reflechis bien, tu as toutes les cartes en main ! 🧠',
  'Prends ton temps, la reflexion est la cle ! 🔑',
  'Chaque erreur est une lecon deguisee ! 💡',
  'Tu es plus capable que tu ne le penses ! 💪',
  'Concentrate-toi et fais confiance a ton intuition ! 🎯',
];

export default function ExerciceDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const niveau = params.niveau as string || 'facile';
  const couleur = params.couleur as string || '#4CAF50';

  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [exerciceActuel, setExerciceActuel] = useState(0);
  const [reponseEtudiant, setReponseEtudiant] = useState('');
  const [indiceVisible, setIndiceVisible] = useState(false);
  const [solutionVisible, setSolutionVisible] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [quotaRestant, setQuotaRestant] = useState<number | null>(null);
  const [pointsGagnes, setPointsGagnes] = useState(0);
  const [exercicesValides, setExercicesValides] = useState<number[]>([]);
  const [messageEncouragement] = useState(
    MESSAGES_ENCOURAGEMENT[Math.floor(Math.random() * MESSAGES_ENCOURAGEMENT.length)]
  );

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    chargerExercices();
    chargerQuota();
  }, []);

  const animerTransition = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  };

  const chargerQuota = async () => {
    const quota = await obtenirQuota();
    setQuotaRestant(quota);
  };

  const chargerExercices = async () => {
    const quota = await verifierEtDecrementerQuota();
    if (!quota.autorise) {
      Alert.alert('⚠️ Quota atteint', quota.message || 'Reessayez demain.');
      router.back();
      return;
    }
    setQuotaRestant(quota.requetesRestantes);
    setChargement(true);
    try {
      const response = await fetch(`${API_URL}/generer-exercices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niveau, nombreExercices: 5 })
      });
      const data = await response.json();
      if (!response.ok || !data.exercices) {
        Alert.alert('Erreur', 'Impossible de charger les exercices. Reessayez.');
        router.back();
        return;
      }
      setExercices(data.exercices);
      animerTransition();
    } catch (erreur) {
      Alert.alert('🔌 Connexion impossible', 'Verifiez que le backend est lance.');
      router.back();
    } finally {
      setChargement(false);
    }
  };

  const validerReponse = () => {
  if (!reponseEtudiant.trim()) {
    Alert.alert('Reponse vide', 'Ecrivez votre reponse avant de valider. 💪');
    return;
  }
  const exercice = exercices[exerciceActuel];
  if (!exercicesValides.includes(exerciceActuel)) {
    const nouveauxValides = [...exercicesValides, exerciceActuel];
    setExercicesValides(nouveauxValides);
    setPointsGagnes(prev => prev + exercice.points);
  }
  setSolutionVisible(true);
  };

  const exerciceSuivant = () => {
    if (exerciceActuel < exercices.length - 1) {
      setExerciceActuel(exerciceActuel + 1);
      setReponseEtudiant('');
      setIndiceVisible(false);
      setSolutionVisible(false);
      animerTransition();
    } else {
      terminerExercices();
    }
  };

  const terminerExercices = async () => {
  const totalPoints = exercices.reduce((acc, ex) => acc + ex.points, 0);
  const pointsFinaux = exercicesValides.length * exercices[0]?.points || 0;
  const pourcentage = Math.round((exercicesValides.length / exercices.length) * 100);
  
  const utilisateur = auth.currentUser;
  if (utilisateur) {
    try {
      await setDoc(doc(db, 'progression', utilisateur.uid), {
        [`scores.${niveau}`]: pourcentage,
        [`xp.${niveau}`]: pointsGagnes,
        derniereActivite: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.log('Erreur sauvegarde XP');
    }
  }

  Alert.alert(
    pourcentage >= 70 ? '🎉 Niveau maitrise !' : '💪 Continue !',
    `Tu as complete ${exercicesValides.length} / ${exercices.length} exercices\n\n` +
    `⚡ Points gagnes : ${pointsGagnes}\n` +
    (pourcentage >= 70
      ? '🏆 Bravo ! Le niveau suivant est debloque !'
      : '📚 Relis le cours et retente pour debloquer le niveau suivant !'),
    [{
      text: 'Retour aux niveaux',
      onPress: () => router.replace({
        pathname: '/exercices' as any,
        params: {
          pourcentage: pourcentage.toString(),
          niveauDebloque: niveau
        }
      })
    }]
  );
};

  if (chargement) {
    return (
      <View style={styles.chargementContainer}>
        <Text style={styles.chargementEmoji}>⚙️</Text>
        <ActivityIndicator size="large" color={couleur} style={{ marginVertical: 16 }} />
        <Text style={styles.chargementTitre}>Preparation des exercices</Text>
        <Text style={styles.chargementSous}>AcademiAI cree des exercices adaptes...</Text>
        <View style={[styles.chargementInfo, { borderColor: couleur + '44' }]}>
          <Text style={styles.chargementInfoTexte}>
            🎯 Niveau : <Text style={{ color: couleur, fontWeight: 'bold' }}>{niveau}</Text>
          </Text>
        </View>
      </View>
    );
  }

  if (exercices.length === 0) {
    return (
      <View style={styles.chargementContainer}>
        <Text style={styles.chargementEmoji}>😕</Text>
        <Text style={styles.chargementTitre}>Aucun exercice disponible</Text>
        <TouchableOpacity style={[styles.bouton, { backgroundColor: couleur }]} onPress={() => router.back()}>
          <Text style={styles.texteBouton}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const exercice = exercices[exerciceActuel];
  const progression = ((exerciceActuel + 1) / exercices.length) * 100;
  const totalPoints = exercices.reduce((acc, ex) => acc + ex.points, 0);

  return (
    <KeyboardAvoidingView 
      style={{ flex:1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => Alert.alert('Quitter ?', 'Ta progression sera perdue.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Quitter', style: 'destructive', onPress: () => router.back() }
          ])}
          style={styles.retourBtn}
        >
          <Text style={[styles.retourTexte, { color: '#FF5252' }]}>✕ Quitter</Text>
        </TouchableOpacity>
        <View style={styles.headerCentre}>
          <Text style={styles.headerTitre}>{exerciceActuel + 1} / {exercices.length}</Text>
          <Text style={styles.headerSous}>⚡ {pointsGagnes} pts</Text>
        </View>
        <View style={[styles.niveauBadge, { backgroundColor: couleur + '22', borderColor: couleur + '55' }]}>
          <Text style={[styles.niveauBadgeTexte, { color: couleur }]}>{niveau}</Text>
        </View>
      </View>

      {/* Barre de progression */}
      <View style={styles.progressionContainer}>
        <View style={styles.progressionBarre}>
          <Animated.View style={[styles.progressionRemplissage, {
            width: `${progression}%` as any,
            backgroundColor: couleur
          }]} />
        </View>
        <Text style={[styles.progressionTexte, { color: couleur }]}>{Math.round(progression)}%</Text>
      </View>

      {/* Points totaux */}
      <View style={[styles.pointsContainer, { borderColor: couleur + '33' }]}>
        <Text style={styles.pointsTexte}>
          🏆 <Text style={{ color: couleur, fontWeight: '800' }}>{pointsGagnes}</Text> / {totalPoints} points • {exercicesValides.length} exercice(s) valide(s)
        </Text>
      </View>

      {/* Exercice */}
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

        {/* Titre exercice */}
        <View style={[styles.exerciceHeader, { borderColor: couleur + '44', backgroundColor: couleur + '11' }]}>
          <View style={styles.exerciceHeaderGauche}>
            <Text style={[styles.exerciceNumero, { color: couleur }]}>Exercice {exerciceActuel + 1}</Text>
            <Text style={styles.exerciceTitre}>{exercice.titre}</Text>
          </View>
          <View style={[styles.pointsBadge, { backgroundColor: couleur + '22', borderColor: couleur }]}>
            <Text style={[styles.pointsBadgeTexte, { color: couleur }]}>+{exercice.points}</Text>
            <Text style={[styles.pointsBadgeSous, { color: couleur }]}>pts</Text>
          </View>
        </View>

        {/* Énoncé */}
        <View style={styles.enonceContainer}>
          <Text style={styles.enonceTitre}>📋 Enonce</Text>
          <Text style={styles.enonceTexte}>{exercice.enonce}</Text>
        </View>

        {/* Message encouragement */}
        <View style={[styles.encouragementContainer, { borderColor: couleur + '33' }]}>
          <Text style={[styles.encouragementTexte, { color: couleur + 'BB' }]}>
            💬 {messageEncouragement}
          </Text>
        </View>

        {/* Zone de réponse */}
        {!solutionVisible && (
          <View style={styles.reponseContainer}>
            <Text style={styles.reponseLabel}>✏️ Votre reponse</Text>
            <TextInput
              style={[styles.reponseInput, { borderColor: couleur + '44' }]}
              placeholder="Ecrivez votre reponse ici..."
              placeholderTextColor="#4A6080"
              value={reponseEtudiant}
              onChangeText={setReponseEtudiant}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Bouton indice */}
        {!solutionVisible && !indiceVisible && exercice.indices && exercice.indices.length > 0 && (
          <TouchableOpacity
            style={[styles.boutonIndice, { borderColor: couleur + '55' }]}
            onPress={() => setIndiceVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.boutonIndiceTexte, { color: couleur }]}>💡 Voir un indice</Text>
          </TouchableOpacity>
        )}

        {/* Indice */}
        {indiceVisible && exercice.indices && (
          <View style={[styles.indiceContainer, { borderColor: couleur + '44', backgroundColor: couleur + '0A' }]}>
            <Text style={[styles.indiceTitre, { color: couleur }]}>💡 Indice</Text>
            <Text style={styles.indiceTexte}>{exercice.indices[0]}</Text>
          </View>
        )}

        {/* Bouton valider */}
        {!solutionVisible && (
          <TouchableOpacity
            style={[styles.bouton, { backgroundColor: couleur }, !reponseEtudiant.trim() && styles.boutonDesactive]}
            onPress={validerReponse}
            disabled={!reponseEtudiant.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.texteBouton}>✅ Valider ma reponse</Text>
          </TouchableOpacity>
        )}

        {/* Solution */}
        {solutionVisible && (
          <View style={styles.solutionWrapper}>
            <View style={styles.reponseEtudiantContainer}>
              <Text style={styles.reponseEtudiantTitre}>✏️ Votre reponse</Text>
              <Text style={styles.reponseEtudiantTexte}>{reponseEtudiant}</Text>
            </View>

            <View style={[styles.solutionContainer, { borderColor: couleur + '55', backgroundColor: couleur + '0A' }]}>
              <Text style={[styles.solutionTitre, { color: couleur }]}>✅ Solution correcte</Text>
              <Text style={styles.solutionTexte}>{exercice.solution}</Text>
            </View>

            <View style={styles.explicationContainer}>
              <Text style={styles.explicationTitre}>💡 Explication detaillee</Text>
              <Text style={styles.explicationTexte}>{exercice.explication}</Text>
            </View>

            <TouchableOpacity
              style={[styles.bouton, { backgroundColor: couleur }]}
              onPress={exerciceSuivant}
              activeOpacity={0.8}
            >
              <Text style={styles.texteBouton}>
                {exerciceActuel < exercices.length - 1 ? 'Exercice suivant →' : '🏁 Terminer'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

      </Animated.View>

    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 60, paddingHorizontal: 24 },
  chargementContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  chargementEmoji: { fontSize: 56 },
  chargementTitre: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  chargementSous: { color: '#8BA4C4', fontSize: 14, textAlign: 'center' },
  chargementInfo: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, borderWidth: 1 },
  chargementInfoTexte: { color: '#8BA4C4', fontSize: 13, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 16 },
  retourBtn: { width: 70 },
  retourTexte: { fontSize: 14, fontWeight: '600' },
  headerCentre: { alignItems: 'center' },
  headerTitre: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  headerSous: { fontSize: 12, color: '#FFC107', fontWeight: '600', marginTop: 2 },
  niveauBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  niveauBadgeTexte: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  progressionContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  progressionBarre: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  progressionRemplissage: { height: '100%', borderRadius: 4 },
  progressionTexte: { fontSize: 13, fontWeight: '700', width: 40 },
  pointsContainer: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 10, marginBottom: 18, borderWidth: 1 },
  pointsTexte: { color: '#C8D8EE', fontSize: 13, textAlign: 'center' },
  exerciceHeader: { borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  exerciceHeaderGauche: { flex: 1, gap: 4 },
  exerciceNumero: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  exerciceTitre: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', lineHeight: 22 },
  pointsBadge: { alignItems: 'center', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, flexShrink: 0 },
  pointsBadgeTexte: { fontSize: 16, fontWeight: '900' },
  pointsBadgeSous: { fontSize: 9, fontWeight: '600' },
  enonceContainer: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 10 },
  enonceTitre: { color: '#8BA4C4', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  enonceTexte: { color: '#FFFFFF', fontSize: 15, lineHeight: 24 },
  encouragementContainer: { borderRadius: 10, padding: 10, marginBottom: 16, borderWidth: 1 },
  encouragementTexte: { fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
  reponseContainer: { marginBottom: 14, gap: 8 },
  reponseLabel: { color: '#8BA4C4', fontSize: 13, fontWeight: '600' },
  reponseInput: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14, color: '#FFFFFF', fontSize: 14, minHeight: 130, borderWidth: 1 },
  boutonIndice: { borderRadius: 10, padding: 12, borderWidth: 1, alignItems: 'center', marginBottom: 14, backgroundColor: 'rgba(255,255,255,0.03)' },
  boutonIndiceTexte: { fontSize: 14, fontWeight: '600' },
  indiceContainer: { borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, gap: 6 },
  indiceTitre: { fontSize: 13, fontWeight: '700' },
  indiceTexte: { color: '#C8D8EE', fontSize: 14, lineHeight: 22 },
  bouton: { borderRadius: 12, padding: 16, alignItems: 'center', elevation: 4, marginBottom: 8 },
  boutonDesactive: { opacity: 0.35, elevation: 0 },
  texteBouton: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  solutionWrapper: { gap: 14 },
  reponseEtudiantContainer: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 8 },
  reponseEtudiantTitre: { color: '#8BA4C4', fontSize: 12, fontWeight: '700' },
  reponseEtudiantTexte: { color: '#C8D8EE', fontSize: 14, lineHeight: 22 },
  solutionContainer: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 8 },
  solutionTitre: { fontSize: 14, fontWeight: '800' },
  solutionTexte: { color: '#FFFFFF', fontSize: 14, lineHeight: 24 },
  explicationContainer: { backgroundColor: 'rgba(74,144,217,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', gap: 8 },
  explicationTitre: { color: '#4A90D9', fontSize: 13, fontWeight: '700' },
  explicationTexte: { color: '#A8C0DC', fontSize: 13, lineHeight: 22 },
});