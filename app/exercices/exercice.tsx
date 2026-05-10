import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated,
  KeyboardAvoidingView, Platform,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { API_URL } from '../../utils/config';
import { verifierEtDecrementerQuota } from '../../utils/quota';

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

const COULEURS_DIFFICULTE: Record<string, string> = {
  facile: '#4CAF50',
  intermediaire: '#FFC107',
  avance: '#FF7043',
  expert: '#FF5252',
};

const ENCOURAGEMENTS_AVANT = [
  'Reflechis bien, tu as toutes les cartes ! 🧠',
  'Prends ton temps, la reflexion est la cle ! 🔑',
  'Fais confiance a ton intuition ! 🎯',
  'Tu es plus capable que tu ne le penses ! 💪',
  'Concentre-toi, tu vas y arriver ! ⚡',
];

const ENCOURAGEMENTS_APRES = [
  'Excellent effort ! Continue comme ca ! 🔥',
  'Chaque exercice te rend plus fort ! 💪',
  'Tu progresses a vue d oeil ! 📈',
  'La pratique fait le maitre ! 🏆',
];

type EtatReponse = 'saisie' | 'auto_evaluation' | 'valide';

export default function ExerciceDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const niveau = params.niveau as string || 'facile';
  const couleur = COULEURS_DIFFICULTE[niveau] || '#4CAF50';

  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [exerciceActuel, setExerciceActuel] = useState(0);
  const [reponseEtudiant, setReponseEtudiant] = useState('');
  const [indiceVisible, setIndiceVisible] = useState(false);
  const [etatReponse, setEtatReponse] = useState<EtatReponse>('saisie');
  const [autoEvaluation, setAutoEvaluation] = useState<'correct' | 'partiel' | 'incorrect' | null>(null);
  const [chargement, setChargement] = useState(true);
  const [pointsGagnes, setPointsGagnes] = useState(0);
  const [exercicesValides, setExercicesValides] = useState<Record<number, 'correct' | 'partiel' | 'incorrect'>>({});
  const [encouragement] = useState(
    ENCOURAGEMENTS_AVANT[Math.floor(Math.random() * ENCOURAGEMENTS_AVANT.length)]
  );

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const boutonAnim = useRef(new Animated.Value(1)).current;
  const celebrationAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    chargerExercices();
  }, []);

  const animerTransition = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const animerCelebration = () => {
    celebrationAnim.setValue(0);
    Animated.sequence([
      Animated.spring(celebrationAnim, { toValue: 1, tension: 100, friction: 5, useNativeDriver: true }),
      Animated.timing(celebrationAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.spring(celebrationAnim, { toValue: 1, tension: 100, friction: 5, useNativeDriver: true }),
    ]).start();
  };

  const animerBouton = () => {
    Animated.sequence([
      Animated.timing(boutonAnim, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.spring(boutonAnim, { toValue: 1, tension: 200, friction: 5, useNativeDriver: true }),
    ]).start();
  };

  const chargerExercices = async () => {
    const quota = await verifierEtDecrementerQuota();
    if (!quota.autorise) {
      Alert.alert('⚠️ Quota atteint', quota.message || 'Reessayez demain.');
      router.back();
      return;
    }
    setChargement(true);
    try {
      const response = await fetch(`${API_URL}/generer-exercices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niveau, nombreExercices: 5 })
      });
      const data = await response.json();
      if (!response.ok || !data.exercices) {
        Alert.alert('Erreur', 'Impossible de charger les exercices.');
        router.back();
        return;
      }
      setExercices(data.exercices);
      animerTransition();
    } catch (e) {
      Alert.alert('🔌 Connexion impossible', 'Verifiez que le backend est lance.');
      router.back();
    } finally {
      setChargement(false);
    }
  };

  const voirSolution = () => {
    if (!reponseEtudiant.trim()) {
      Alert.alert('✏️ Reponse vide', 'Ecris ta reponse d abord, meme si tu n es pas sur ! Essayer c est deja gagner ! 💪');
      return;
    }
    animerBouton();
    setEtatReponse('auto_evaluation');
  };

  const evaluerReponse = (evaluation: 'correct' | 'partiel' | 'incorrect') => {
    animerCelebration();
    const exercice = exercices[exerciceActuel];
    const pointsAGagner = evaluation === 'correct'
      ? exercice.points
      : evaluation === 'partiel'
      ? Math.round(exercice.points * 0.5)
      : 0;

    const nouvellesEvaluations = { ...exercicesValides, [exerciceActuel]: evaluation };
    setExercicesValides(nouvellesEvaluations);
    setPointsGagnes(prev => prev + pointsAGagner);
    setAutoEvaluation(evaluation);
    setEtatReponse('valide');

    if (evaluation === 'correct') {
      Alert.alert(
        '🎉 Excellent !',
        `Tu as bien compris cet exercice !\n\n+${pointsAGagner} points gagnes !\n\n${ENCOURAGEMENTS_APRES[Math.floor(Math.random() * ENCOURAGEMENTS_APRES.length)]}`,
        [{ text: 'Continuer ! 🚀', style: 'default' }]
      );
    } else if (evaluation === 'partiel') {
      Alert.alert(
        '👍 Pas mal !',
        `Tu es sur la bonne voie !\n\n+${pointsAGagner} points (50%)\n\nRelis la solution pour completer ta comprehension. 📚`,
        [{ text: 'Je continue ! 💪', style: 'default' }]
      );
    } else {
      Alert.alert(
        '📚 Continue d apprendre !',
        `Pas de panique, c est en forgeant qu on devient forgeron !\n\nAnalyse bien la solution et retiens les points cles. Tu vas y arriver ! 🌟`,
        [{ text: 'J ai compris ! 🎯', style: 'default' }]
      );
    }
  };

  const exerciceSuivant = () => {
    if (exerciceActuel < exercices.length - 1) {
      setExerciceActuel(exerciceActuel + 1);
      setReponseEtudiant('');
      setIndiceVisible(false);
      setEtatReponse('saisie');
      setAutoEvaluation(null);
      animerTransition();
    } else {
      terminerExercices();
    }
  };

  const terminerExercices = async () => {
    const total = exercices.reduce((acc, ex) => acc + ex.points, 0);
    const corrects = Object.values(exercicesValides).filter(v => v === 'correct').length;
    const partiels = Object.values(exercicesValides).filter(v => v === 'partiel').length;
    const pourcentage = Math.round((pointsGagnes / total) * 100);

    const utilisateur = auth.currentUser;
    if (utilisateur) {
      try {
        await setDoc(doc(db, 'progression', utilisateur.uid), {
          [`scores.${niveau}`]: pourcentage,
          [`xp.${niveau}`]: pointsGagnes,
          derniereActivite: new Date().toISOString(),
        }, { merge: true });
      } catch (e) {}
    }

    Alert.alert(
    pourcentage >= 70 ? '🏆 Serie terminee !' : '💪 Bonne serie !',
    `Resultats :\n\n✅ Corrects : ${corrects} / ${exercices.length}\n👍 Partiels : ${partiels}\n⚡ Points : ${pointsGagnes} / ${total}\n📊 Score : ${pourcentage}%\n\nQue veux-tu faire maintenant ?`,
    [
      {
        text: '🔄 Nouvelle serie',
        onPress: () => {
          setExerciceActuel(0);
          setReponseEtudiant('');
          setIndiceVisible(false);
          setEtatReponse('saisie');
          setAutoEvaluation(null);
          setPointsGagnes(0);
          setExercicesValides({});
          chargerExercices();
        }
      },
      {
        text: pourcentage >= 70 ? '🏆 Niveau suivant' : '📚 Retour aux niveaux',
        onPress: () => router.replace({
          pathname: '/exercices' as any,
          params: {
            pourcentage: pourcentage.toString(),
            niveauDebloque: niveau
          }
        })
      }
    ]
  );
  };

  if (chargement) {
    return (
      <View style={styles.chargementContainer}>
        <Text style={styles.chargementEmoji}>⚙️</Text>
        <ActivityIndicator size="large" color={couleur} style={{ marginVertical: 16 }} />
        <Text style={styles.chargementTitre}>Preparation des exercices</Text>
        <Text style={styles.chargementSous}>AcademiAI cree des exercices niveau {niveau}...</Text>
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
      style={{ flex: 1, backgroundColor: '#0F2044' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
            <Text style={styles.headerSous}>⚡ {pointsGagnes} / {totalPoints} pts</Text>
          </View>
          <View style={[styles.niveauBadge, { backgroundColor: couleur + '22', borderColor: couleur + '55' }]}>
            <Text style={[styles.niveauBadgeTexte, { color: couleur }]}>{niveau}</Text>
          </View>
        </View>

        {/* Barre progression */}
        <View style={styles.progressionContainer}>
          <View style={styles.progressionBarre}>
            <View style={[styles.progressionRemplissage, {
              width: `${progression}%` as any,
              backgroundColor: couleur
            }]} />
          </View>
          <Text style={[styles.progressionTexte, { color: couleur }]}>{Math.round(progression)}%</Text>
        </View>

        {/* Statuts des exercices */}
        <View style={styles.statutsContainer}>
          {exercices.map((_, i) => {
            const eval_ = exercicesValides[i];
            return (
              <View key={i} style={[
                styles.statutPoint,
                i === exerciceActuel && { borderColor: couleur, borderWidth: 2 },
                eval_ === 'correct' && { backgroundColor: '#4CAF50' },
                eval_ === 'partiel' && { backgroundColor: '#FFC107' },
                eval_ === 'incorrect' && { backgroundColor: '#FF5252' },
                !eval_ && i !== exerciceActuel && { backgroundColor: 'rgba(255,255,255,0.1)' },
                !eval_ && i === exerciceActuel && { backgroundColor: couleur + '44' },
              ]}>
                <Text style={styles.statutPointTexte}>
                  {eval_ === 'correct' ? '✓' : eval_ === 'partiel' ? '~' : eval_ === 'incorrect' ? '✗' : (i + 1).toString()}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Exercice */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* En-tête exercice */}
          <View style={[styles.exerciceHeader, { borderColor: couleur + '44', backgroundColor: couleur + '0D' }]}>
            <View style={styles.exerciceHeaderGauche}>
              <Text style={[styles.exerciceNumero, { color: couleur }]}>EXERCICE {exerciceActuel + 1}</Text>
              <Text style={styles.exerciceTitre}>{exercice.titre}</Text>
            </View>
            <View style={[styles.pointsBadge, { backgroundColor: couleur + '22', borderColor: couleur }]}>
              <Text style={[styles.pointsBadgeValeur, { color: couleur }]}>+{exercice.points}</Text>
              <Text style={[styles.pointsBadgeLabel, { color: couleur }]}>pts</Text>
            </View>
          </View>

          {/* Énoncé */}
          <View style={styles.enonceContainer}>
            <View style={styles.enonceTitreRow}>
              <Text style={styles.enonceTitre}>📋 Enonce</Text>
              <View style={[styles.difficulteBadge, { backgroundColor: couleur + '22', borderColor: couleur + '55' }]}>
                <Text style={[styles.difficulteTexte, { color: couleur }]}>{exercice.difficulte}</Text>
              </View>
            </View>
            <Text style={styles.enonceTexte}>{exercice.enonce}</Text>
          </View>

          {/* Message d'encouragement */}
          {etatReponse === 'saisie' && (
            <View style={[styles.encouragementContainer, { borderColor: couleur + '33' }]}>
              <Text style={[styles.encouragementTexte, { color: couleur + 'CC' }]}>
                💬 {encouragement}
              </Text>
            </View>
          )}

          {/* Zone de réponse */}
          {etatReponse === 'saisie' && (
            <View style={styles.reponseSection}>
              <Text style={styles.reponseLabel}>✏️ Ta reponse</Text>
              <TextInput
                style={[styles.reponseInput, { borderColor: couleur + '55' }]}
                placeholder="Ecris ta reponse ici... Chaque tentative compte ! 💪"
                placeholderTextColor="#4A6080"
                value={reponseEtudiant}
                onChangeText={setReponseEtudiant}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              {/* Indice */}
              {!indiceVisible && exercice.indices?.length > 0 && (
                <TouchableOpacity
                  style={[styles.boutonIndice, { borderColor: couleur + '55' }]}
                  onPress={() => setIndiceVisible(true)}
                >
                  <Text style={[styles.boutonIndiceTexte, { color: couleur }]}>
                    💡 Voir un indice (-{Math.round(exercice.points * 0.2)} pts)
                  </Text>
                </TouchableOpacity>
              )}

              {indiceVisible && (
                <View style={[styles.indiceContainer, { borderColor: couleur + '44', backgroundColor: couleur + '0A' }]}>
                  <Text style={[styles.indiceTitre, { color: couleur }]}>💡 Indice</Text>
                  <Text style={styles.indiceTexte}>{exercice.indices[0]}</Text>
                </View>
              )}

              <Animated.View style={{ transform: [{ scale: boutonAnim }] }}>
                <TouchableOpacity
                  style={[styles.bouton, { backgroundColor: couleur }, !reponseEtudiant.trim() && styles.boutonDesactive]}
                  onPress={voirSolution}
                  disabled={!reponseEtudiant.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.texteBouton}>👁️ Voir la solution & m auto-evaluer</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}

          {/* Auto-évaluation */}
          {etatReponse === 'auto_evaluation' && (
            <View style={styles.autoEvalSection}>

              {/* Réponse de l'étudiant */}
              <View style={styles.maReponseContainer}>
                <Text style={styles.maReponseTitre}>✏️ Ta reponse</Text>
                <Text style={styles.maReponseTexte}>{reponseEtudiant}</Text>
              </View>

              {/* Solution officielle */}
              <View style={[styles.solutionContainer, { borderColor: couleur + '55', backgroundColor: couleur + '0A' }]}>
                <Text style={[styles.solutionTitre, { color: couleur }]}>✅ Solution officielle</Text>
                <Text style={styles.solutionTexte}>{exercice.solution}</Text>
              </View>

              {/* Explication */}
              <View style={styles.explicationContainer}>
                <Text style={styles.explicationTitre}>💡 Explication detaillee</Text>
                <Text style={styles.explicationTexte}>{exercice.explication}</Text>
              </View>

              {/* Auto-évaluation */}
              <View style={styles.evalContainer}>
                <Text style={styles.evalTitre}>🎯 Comment tu t evalues ?</Text>
                <Text style={styles.evalSous}>Sois honnete avec toi-meme, c est la cle du progres ! 🗝️</Text>

                <TouchableOpacity
                  style={[styles.evalBouton, styles.evalCorrect]}
                  onPress={() => evaluerReponse('correct')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.evalBoutonEmoji}>✅</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.evalBoutonTitre}>J ai bien repondu !</Text>
                    <Text style={styles.evalBoutonSous}>Ma reponse correspond a la solution • +{exercice.points} pts</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.evalBouton, styles.evalPartiel]}
                  onPress={() => evaluerReponse('partiel')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.evalBoutonEmoji}>👍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.evalBoutonTitre, { color: '#FFC107' }]}>Partiellement correct</Text>
                    <Text style={styles.evalBoutonSous}>J avais une partie de la reponse • +{Math.round(exercice.points * 0.5)} pts</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.evalBouton, styles.evalIncorrect]}
                  onPress={() => evaluerReponse('incorrect')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.evalBoutonEmoji}>📚</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.evalBoutonTitre, { color: '#FF7043' }]}>Je n avais pas bon</Text>
                    <Text style={styles.evalBoutonSous}>J ai besoin de retravailler ce point • +0 pts</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Résultat validé */}
          {etatReponse === 'valide' && (
            <Animated.View style={[styles.valideSection, { transform: [{ scale: celebrationAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }]}>

              {/* Badge résultat */}
              <View style={[
                styles.resultatBadge,
                autoEvaluation === 'correct' && styles.resultatCorrect,
                autoEvaluation === 'partiel' && styles.resultatPartiel,
                autoEvaluation === 'incorrect' && styles.resultatIncorrect,
              ]}>
                <Text style={styles.resultatEmoji}>
                  {autoEvaluation === 'correct' ? '🏆' : autoEvaluation === 'partiel' ? '👍' : '📚'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultatTitre}>
                    {autoEvaluation === 'correct' ? 'Excellent !'
                      : autoEvaluation === 'partiel' ? 'Pas mal !'
                      : 'Continue d apprendre !'}
                  </Text>
                  <Text style={styles.resultatSous}>
                    {autoEvaluation === 'correct'
                      ? `+${exercice.points} points gagnes ! 🎉`
                      : autoEvaluation === 'partiel'
                      ? `+${Math.round(exercice.points * 0.5)} points (50%) 💪`
                      : 'Analyse bien la solution ! 📖'}
                  </Text>
                </View>
              </View>

              {/* Solution rappel */}
              <View style={[styles.solutionRappel, { borderColor: couleur + '44' }]}>
                <Text style={[styles.solutionRappelTitre, { color: couleur }]}>📌 A retenir</Text>
                <Text style={styles.solutionRappelTexte}>{exercice.explication}</Text>
              </View>

              {/* Bouton suivant */}
              <TouchableOpacity
                style={[styles.bouton, { backgroundColor: couleur }]}
                onPress={exerciceSuivant}
                activeOpacity={0.8}
              >
                <Text style={styles.texteBouton}>
                  {exerciceActuel < exercices.length - 1
                    ? `Exercice suivant → (${exerciceActuel + 2}/${exercices.length})`
                    : '🏁 Voir mes resultats finaux'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
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
  statutsContainer: { flexDirection: 'row', gap: 8, marginBottom: 20, justifyContent: 'center' },
  statutPoint: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  statutPointTexte: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  exerciceHeader: { borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  exerciceHeaderGauche: { flex: 1, gap: 4 },
  exerciceNumero: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  exerciceTitre: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', lineHeight: 22 },
  pointsBadge: { alignItems: 'center', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, flexShrink: 0 },
  pointsBadgeValeur: { fontSize: 16, fontWeight: '900' },
  pointsBadgeLabel: { fontSize: 9, fontWeight: '600' },
  enonceContainer: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 10 },
  enonceTitreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  enonceTitre: { color: '#8BA4C4', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  difficulteBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  difficulteTexte: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  enonceTexte: { color: '#FFFFFF', fontSize: 15, lineHeight: 24 },
  encouragementContainer: { borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.03)' },
  encouragementTexte: { fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
  reponseSection: { gap: 12 },
  reponseLabel: { color: '#8BA4C4', fontSize: 13, fontWeight: '600' },
  reponseInput: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14, color: '#FFFFFF', fontSize: 14, minHeight: 140, borderWidth: 1 },
  boutonIndice: { borderRadius: 10, padding: 12, borderWidth: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)' },
  boutonIndiceTexte: { fontSize: 13, fontWeight: '600' },
  indiceContainer: { borderRadius: 12, padding: 14, borderWidth: 1, gap: 6 },
  indiceTitre: { fontSize: 13, fontWeight: '700' },
  indiceTexte: { color: '#C8D8EE', fontSize: 14, lineHeight: 22 },
  bouton: { borderRadius: 12, padding: 16, alignItems: 'center', elevation: 4 },
  boutonDesactive: { opacity: 0.3, elevation: 0 },
  texteBouton: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  autoEvalSection: { gap: 14 },
  maReponseContainer: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 8 },
  maReponseTitre: { color: '#8BA4C4', fontSize: 12, fontWeight: '700' },
  maReponseTexte: { color: '#C8D8EE', fontSize: 14, lineHeight: 22 },
  solutionContainer: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 8 },
  solutionTitre: { fontSize: 14, fontWeight: '800' },
  solutionTexte: { color: '#FFFFFF', fontSize: 14, lineHeight: 24 },
  explicationContainer: { backgroundColor: 'rgba(74,144,217,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', gap: 8 },
  explicationTitre: { color: '#4A90D9', fontSize: 13, fontWeight: '700' },
  explicationTexte: { color: '#A8C0DC', fontSize: 13, lineHeight: 22 },
  evalContainer: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 10 },
  evalTitre: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  evalSous: { color: '#8BA4C4', fontSize: 12, textAlign: 'center', marginBottom: 4 },
  evalBouton: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, borderWidth: 1, gap: 12 },
  evalCorrect: { backgroundColor: 'rgba(76,175,80,0.12)', borderColor: 'rgba(76,175,80,0.4)' },
  evalPartiel: { backgroundColor: 'rgba(255,193,7,0.12)', borderColor: 'rgba(255,193,7,0.4)' },
  evalIncorrect: { backgroundColor: 'rgba(255,112,67,0.12)', borderColor: 'rgba(255,112,67,0.4)' },
  evalBoutonEmoji: { fontSize: 24 },
  evalBoutonTitre: { color: '#4CAF50', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  evalBoutonSous: { color: '#8BA4C4', fontSize: 11 },
  valideSection: { gap: 14 },
  resultatBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, borderWidth: 1.5, gap: 12 },
  resultatCorrect: { backgroundColor: 'rgba(76,175,80,0.15)', borderColor: '#4CAF50' },
  resultatPartiel: { backgroundColor: 'rgba(255,193,7,0.15)', borderColor: '#FFC107' },
  resultatIncorrect: { backgroundColor: 'rgba(255,112,67,0.15)', borderColor: '#FF7043' },
  resultatEmoji: { fontSize: 32 },
  resultatTitre: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  resultatSous: { color: '#A8C0DC', fontSize: 13, marginTop: 2 },
  solutionRappel: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, borderWidth: 1, gap: 8 },
  solutionRappelTitre: { fontSize: 13, fontWeight: '700' },
  solutionRappelTexte: { color: '#A8C0DC', fontSize: 13, lineHeight: 21 },
});