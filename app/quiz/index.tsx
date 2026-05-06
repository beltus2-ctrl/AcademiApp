import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { obtenirQuota, verifierEtDecrementerQuota } from '../../utils/quota';

import { API_URL } from '../../utils/config';

interface Question {
  id: number;
  question: string;
  options: string[];
  reponseCorrecte: number;
  explication: string;
  difficulte: string;
}

const COULEURS_DIFFICULTE: Record<string, string> = {
  facile: '#4CAF50',
  intermediaire: '#FFC107',
  avance: '#FF7043',
  expert: '#FF5252',
};

const EMOJI_DIFFICULTE: Record<string, string> = {
  facile: '🟢',
  intermediaire: '🟡',
  avance: '🟠',
  expert: '🔴',
};

const LETTRES = ['A', 'B', 'C', 'D'];

const MESSAGES_MOTIVATION = [
  'Tu peux le faire ! 💪',
  'Concentre-toi ! 🎯',
  'Reste focus ! 🧠',
  'Tu es sur la bonne voie ! 🚀',
  'Chaque question te rend plus fort ! ⚡',
];

export default function Quiz() {
  const router = useRouter();
  const [etape, setEtape] = useState<'saisie' | 'quiz' | 'chargement'>('saisie');
  const [cours, setCours] = useState('');
  const [nombreQuestions, setNombreQuestions] = useState('10');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [reponses, setReponses] = useState<number[]>([]);
  const [questionActuelle, setQuestionActuelle] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [quotaRestant, setQuotaRestant] = useState<number | null>(null);
  const [messageMotivation, setMessageMotivation] = useState('');

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const chargerQuota = async () => {
      const quota = await obtenirQuota();
      setQuotaRestant(quota);
    };
    chargerQuota();
    setMessageMotivation(MESSAGES_MOTIVATION[Math.floor(Math.random() * MESSAGES_MOTIVATION.length)]);
  }, []);

  useEffect(() => {
    if (questions.length > 0) {
      const progression = ((questionActuelle + 1) / questions.length) * 100;
      Animated.timing(progressAnim, {
        toValue: progression,
        duration: 400,
        useNativeDriver: false,
      }).start();
    }
  }, [questionActuelle, questions]);

  const animerTransition = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      callback();
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  };

  const genererQuiz = async () => {
    if (!cours.trim()) {
      Alert.alert('Champ manquant', 'Veuillez entrer le contenu de votre cours');
      return;
    }
    const quota = await verifierEtDecrementerQuota();
    if (!quota.autorise) {
      Alert.alert('⚠️ Quota atteint', quota.message || 'Reessayez demain.');
      return;
    }
    setQuotaRestant(quota.requetesRestantes);
    setChargement(true);
    setEtape('chargement');
    try {
      const response = await fetch(`${API_URL}/generer-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cours, nombreQuestions: parseInt(nombreQuestions) })
      });
      const data = await response.json();
      if (response.status === 429) {
        Alert.alert('⚠️ Quota atteint', 'Reessayez demain. 📅');
        setEtape('saisie');
        return;
      }
      if (!response.ok || !data.questions) {
        Alert.alert('Erreur', 'Impossible de generer le quiz. Reessayez.');
        setEtape('saisie');
        return;
      }
      setQuestions(data.questions);
      setReponses(new Array(data.questions.length).fill(-1));
      setQuestionActuelle(0);
      setEtape('quiz');
    } catch (erreur) {
      Alert.alert('🔌 Connexion impossible', 'Verifiez que le backend est lance.');
      setEtape('saisie');
    } finally {
      setChargement(false);
    }
  };

  const selectionnerReponse = (index: number) => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.98, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    const nouvellesReponses = [...reponses];
    nouvellesReponses[questionActuelle] = index;
    setReponses(nouvellesReponses);
    setMessageMotivation(MESSAGES_MOTIVATION[Math.floor(Math.random() * MESSAGES_MOTIVATION.length)]);
  };

  const questionSuivante = () => {
    if (reponses[questionActuelle] === -1) {
      Alert.alert('Reponse manquante', 'Veuillez selectionner une reponse avant de continuer.');
      return;
    }
    if (questionActuelle < questions.length - 1) {
      animerTransition(() => setQuestionActuelle(questionActuelle + 1));
    } else {
      terminerQuiz();
    }
  };

  const terminerQuiz = () => {
    if (reponses.includes(-1)) {
      Alert.alert('Quiz incomplet', 'Veuillez repondre a toutes les questions.');
      return;
    }
    const score = reponses.reduce((acc, reponse, index) => {
      return reponse === questions[index].reponseCorrecte ? acc + 1 : acc;
    }, 0);
    const pourcentage = Math.round((score / questions.length) * 100);
    router.push({
      pathname: '/quiz/resultats',
      params: {
        score: score.toString(),
        total: questions.length.toString(),
        pourcentage: pourcentage.toString(),
        questions: JSON.stringify(questions),
        reponses: JSON.stringify(reponses),
      }
    });
  };

  // ─── ÉCRAN SAISIE ───────────────────────────────────────────────
  if (etape === 'saisie') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
              <Text style={styles.retourTexte}>← Retour</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitre}>Quiz</Text>
            <View style={{ width: 70 }} />
          </View>

          {/* Bannière */}
          <View style={styles.banniere}>
            <Text style={styles.banniereEmoji}>🧠</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.banniereTitre}>Quiz Adaptatif</Text>
              <Text style={styles.banniereTexte}>Teste ta comprehension avec l IA</Text>
            </View>
            <View style={styles.banniereStatut}>
              <View style={styles.pointVert} />
              <Text style={styles.banniereStatutTexte}>En ligne</Text>
            </View>
          </View>

          {/* Quota */}
          {quotaRestant !== null && (
            <View style={styles.quotaContainer}>
              <Text style={styles.quotaTexte}>
                {quotaRestant > 5 ? `✅ ${quotaRestant} requetes restantes`
                  : quotaRestant > 0 ? `⚠️ ${quotaRestant} requetes restantes`
                  : `❌ Quota journalier epuise`}
              </Text>
              <View style={styles.quotaBarre}>
                <View style={[styles.quotaProgression, {
                  width: `${(quotaRestant / 20) * 100}%` as any,
                  backgroundColor: quotaRestant > 5 ? '#4CAF50' : quotaRestant > 0 ? '#FFC107' : '#FF5252'
                }]} />
              </View>
            </View>
          )}

          {/* Règles du jeu */}
          <View style={styles.reglesContainer}>
            <Text style={styles.reglesTitre}>📋 Regles du Quiz</Text>
            <View style={styles.regleItem}>
              <Text style={styles.regleEmoji}>🎯</Text>
              <Text style={styles.regleTexte}>Score minimum de <Text style={styles.regleBold}>70%</Text> pour valider</Text>
            </View>
            <View style={styles.regleItem}>
              <Text style={styles.regleEmoji}>🔁</Text>
              <Text style={styles.regleTexte}>En dessous de 70%, le quiz recommence</Text>
            </View>
            <View style={styles.regleItem}>
              <Text style={styles.regleEmoji}>🏆</Text>
              <Text style={styles.regleTexte}>Au dessus de 70%, acces aux exercices</Text>
            </View>
            <View style={styles.regleItem}>
              <Text style={styles.regleEmoji}>💡</Text>
              <Text style={styles.regleTexte}>Chaque reponse est expliquee apres</Text>
            </View>
          </View>

          {/* Champ cours */}
          <Text style={styles.label}>📚 Contenu de votre cours *</Text>
          <TextInput
            style={[styles.champ, styles.champMultiline]}
            placeholder="Collez ou tapez le contenu de votre cours ici..."
            placeholderTextColor="#4A6080"
            value={cours}
            onChangeText={setCours}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />

          {/* Nombre de questions */}
          <Text style={styles.label}>🔢 Nombre de questions</Text>
          <View style={styles.nombreContainer}>
            {['5', '10', '15', '20'].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.nombreBtn, nombreQuestions === n && styles.nombreBtnActif]}
                onPress={() => setNombreQuestions(n)}
                activeOpacity={0.7}
              >
                <Text style={[styles.nombreTexte, nombreQuestions === n && styles.nombreTexteActif]}>{n}</Text>
                {nombreQuestions === n && <Text style={styles.nombreSous}>questions</Text>}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.bouton, (!cours.trim() || chargement) && styles.boutonDesactive]}
            onPress={genererQuiz}
            disabled={!cours.trim() || chargement}
            activeOpacity={0.8}
          >
            <Text style={styles.texteBouton}>🧠 Generer le quiz</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── ÉCRAN CHARGEMENT ─────────────────────────────────────────────
  if (etape === 'chargement') {
    return (
      <View style={styles.chargementContainer}>
        <Text style={styles.chargementEmoji}>🧠</Text>
        <ActivityIndicator size="large" color="#4A90D9" style={{ marginVertical: 16 }} />
        <Text style={styles.chargementTitre}>AcademiAI prepare votre quiz</Text>
        <Text style={styles.chargementSous}>Generation de {nombreQuestions} questions en cours...</Text>
        <View style={styles.chargementInfo}>
          <Text style={styles.chargementInfoTexte}>💡 Les questions sont adaptees a votre niveau</Text>
        </View>
      </View>
    );
  }

  // ─── ÉCRAN QUIZ ────────────────────────────────────────────────────
  const question = questions[questionActuelle];
  const couleurDifficulte = COULEURS_DIFFICULTE[question.difficulte] || '#8BA4C4';
  const repondues = reponses.filter(r => r !== -1).length;

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* Header Quiz */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => Alert.alert('Quitter le quiz ?', 'Votre progression sera perdue.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Quitter', style: 'destructive', onPress: () => setEtape('saisie') }
          ])}
          style={styles.retourBtn}
        >
          <Text style={[styles.retourTexte, { color: '#FF5252' }]}>✕ Quitter</Text>
        </TouchableOpacity>
        <View style={styles.headerCentre}>
          <Text style={styles.headerTitre}>{questionActuelle + 1} / {questions.length}</Text>
          <Text style={styles.headerSous}>{repondues} repondues</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>

      {/* Barre de progression */}
      <View style={styles.progressionContainer}>
        <Animated.View style={[styles.progressionRemplissage, {
          width: progressAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          })
        }]} />
      </View>

      {/* Message motivation */}
      <Animated.View style={[styles.motivationContainer, { opacity: fadeAnim }]}>
        <Text style={styles.motivationTexte}>{messageMotivation}</Text>
      </Animated.View>

      {/* Badge difficulté */}
      <View style={[styles.difficulteBadge, { backgroundColor: couleurDifficulte + '22', borderColor: couleurDifficulte + '55' }]}>
        <Text style={[styles.difficulteTexte, { color: couleurDifficulte }]}>
          {EMOJI_DIFFICULTE[question.difficulte] || '⚪'} {question.difficulte}
        </Text>
      </View>

      {/* Question */}
      <Animated.View style={[styles.questionContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.questionNumero}>Question {questionActuelle + 1}</Text>
        <Text style={styles.questionTexte}>{question.question}</Text>
      </Animated.View>

      {/* Options */}
      <Animated.View style={[styles.optionsContainer, { opacity: fadeAnim }]}>
        {question.options.map((option, index) => {
          const estSelectionne = reponses[questionActuelle] === index;
          return (
            <TouchableOpacity
              key={index}
              style={[styles.optionBtn, estSelectionne && styles.optionBtnSelectionne]}
              onPress={() => selectionnerReponse(index)}
              activeOpacity={0.7}
            >
              <View style={[styles.optionLettre, estSelectionne && styles.optionLettreSelectionnee]}>
                <Text style={styles.optionLettreTexte}>{LETTRES[index]}</Text>
              </View>
              <Text style={[styles.optionTexte, estSelectionne && styles.optionTexteSelectionne]}>
                {option}
              </Text>
              {estSelectionne && <Text style={styles.optionCheck}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </Animated.View>

      {/* Bouton suivant */}
      <TouchableOpacity
        style={[styles.bouton, reponses[questionActuelle] === -1 && styles.boutonDesactive]}
        onPress={questionSuivante}
        disabled={reponses[questionActuelle] === -1}
        activeOpacity={0.8}
      >
        <Text style={styles.texteBouton}>
          {questionActuelle < questions.length - 1 ? 'Question suivante →' : '✅ Terminer le quiz'}
        </Text>
      </TouchableOpacity>

      {/* Mini recap */}
      <View style={styles.recapContainer}>
        <Text style={styles.recapTexte}>
          {repondues} / {questions.length} questions repondues
        </Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 60, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 16 },
  headerCentre: { alignItems: 'center' },
  retourBtn: { width: 70 },
  retourTexte: { color: '#4A90D9', fontSize: 14, fontWeight: '600' },
  headerTitre: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  headerSous: { fontSize: 11, color: '#8BA4C4', marginTop: 2 },
  banniere: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74,144,217,0.12)', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', gap: 12 },
  banniereEmoji: { fontSize: 34 },
  banniereTitre: { fontSize: 16, fontWeight: 'bold', color: '#4A90D9', marginBottom: 2 },
  banniereTexte: { fontSize: 12, color: '#8BA4C4' },
  banniereStatut: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pointVert: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  banniereStatutTexte: { fontSize: 11, color: '#4CAF50', fontWeight: '600' },
  quotaContainer: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  quotaTexte: { color: '#C8D8EE', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  quotaBarre: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  quotaProgression: { height: '100%', borderRadius: 3 },
  reglesContainer: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 10 },
  reglesTitre: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  regleItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  regleEmoji: { fontSize: 16 },
  regleTexte: { color: '#A8C0DC', fontSize: 13, flex: 1 },
  regleBold: { color: '#4A90D9', fontWeight: 'bold' },
  label: { color: '#8BA4C4', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  champ: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, color: '#FFFFFF', fontSize: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  champMultiline: { height: 160, textAlignVertical: 'top' },
  nombreContainer: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  nombreBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  nombreBtnActif: { backgroundColor: 'rgba(74,144,217,0.2)', borderColor: '#4A90D9' },
  nombreTexte: { color: '#8BA4C4', fontWeight: '800', fontSize: 18 },
  nombreTexteActif: { color: '#4A90D9' },
  nombreSous: { color: '#4A90D9', fontSize: 9, marginTop: 2 },
  bouton: { backgroundColor: '#4A90D9', borderRadius: 12, padding: 16, alignItems: 'center', elevation: 4 },
  boutonDesactive: { backgroundColor: 'rgba(74,144,217,0.25)', elevation: 0 },
  texteBouton: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  chargementContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  chargementEmoji: { fontSize: 60 },
  chargementTitre: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  chargementSous: { color: '#8BA4C4', fontSize: 14, textAlign: 'center' },
  chargementInfo: { marginTop: 20, backgroundColor: 'rgba(74,144,217,0.12)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)' },
  chargementInfoTexte: { color: '#8BA4C4', fontSize: 13, textAlign: 'center' },
  progressionContainer: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
  progressionRemplissage: { height: '100%', backgroundColor: '#4A90D9', borderRadius: 4 },
  motivationContainer: { backgroundColor: 'rgba(74,144,217,0.1)', borderRadius: 10, padding: 10, marginBottom: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(74,144,217,0.2)' },
  motivationTexte: { color: '#4A90D9', fontSize: 13, fontWeight: '600', fontStyle: 'italic' },
  difficulteBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, marginBottom: 14 },
  difficulteTexte: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  questionContainer: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(74,144,217,0.2)', shadowColor: '#4A90D9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },
  questionNumero: { color: '#4A90D9', fontSize: 11, fontWeight: '800', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.5 },
  questionTexte: { color: '#FFFFFF', fontSize: 16, lineHeight: 26, fontWeight: '500' },
  optionsContainer: { gap: 12, marginBottom: 24 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 14 },
  optionBtnSelectionne: { backgroundColor: 'rgba(74,144,217,0.18)', borderColor: '#4A90D9', borderWidth: 1.5 },
  optionLettre: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  optionLettreSelectionnee: { backgroundColor: '#4A90D9' },
  optionLettreTexte: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  optionTexte: { flex: 1, color: '#A8C0DC', fontSize: 14, lineHeight: 20 },
  optionTexteSelectionne: { color: '#FFFFFF', fontWeight: '500' },
  optionCheck: { color: '#4A90D9', fontSize: 18, fontWeight: 'bold' },
  recapContainer: { alignItems: 'center', marginTop: 16 },
  recapTexte: { color: '#4A6080', fontSize: 12 },
});