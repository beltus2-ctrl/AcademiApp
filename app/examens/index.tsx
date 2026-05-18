import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing,
  ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

interface ExamenPlanifie {
  id: string;
  matiere: string;
  date: string;
  heure: string;
}

const MESSAGES_MOTIVATION = [
  { texte: 'La preparation d aujourd hui est le succes de demain !', emoji: '🌟' },
  { texte: 'Chaque heure de revision te rapproche de ton objectif !', emoji: '⏰' },
  { texte: 'Tu es plus intelligent que tu ne le crois !', emoji: '🧠' },
  { texte: 'L excellence se prepare, jamais par hasard !', emoji: '🎯' },
  { texte: 'Chaque effort compte. Ne lache rien !', emoji: '💪' },
];

const CONSEILS = [
  { icone: '⏱️', texte: 'Faites des pauses de 10 min toutes les 45 min (methode Pomodoro)' },
  { icone: '💧', texte: 'Restez hydrate ! Votre cerveau fonctionne mieux avec de l eau' },
  { icone: '😴', texte: 'Un bon sommeil vaut mieux que reviser toute la nuit' },
  { icone: '📝', texte: 'Resumer un cours en une page aide a retenir 3x mieux' },
  { icone: '🎯', texte: 'Commencez par les chapitres les plus difficiles quand vous etes frais' },
  { icone: '🤝', texte: 'Expliquer un cours a quelqu un est la meilleure facon de le maitriser' },
];

const STATS_MOTIVATION = [
  { valeur: '70%', description: 'des etudiants qui planifient reussissent mieux', couleur: '#4CAF50' },
  { valeur: '3x', description: 'plus efficace de reviser en plusieurs fois qu en une', couleur: '#4A90D9' },
  { valeur: '40%', description: 'de meilleures notes avec une simulation d examen', couleur: '#FFC107' },
];

export default function ExamensAccueil() {
  const router = useRouter();
  const [profil, setProfil] = useState<any>(null);
  const [examens, setExamens] = useState<ExamenPlanifie[]>([]);
  const [prochainExamen, setProchainExamen] = useState<ExamenPlanifie | null>(null);
  const [joursRestants, setJoursRestants] = useState<number | null>(null);
  const [motifIndex, setMotifIndex] = useState(0);
  const [conseilIndex, setConseilIndex] = useState(0);
  const [statIndex, setStatIndex] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const countdownAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const motifAnim = useRef(new Animated.Value(1)).current;
  const conseilAnim = useRef(new Animated.Value(1)).current;
  const statAnim = useRef(new Animated.Value(1)).current;
  const urgenceAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    chargerDonnees();
    animerEntree();
    animerPulsation();
    animerRotation();
    rotationMessages();
    rotationConseils();
    rotationStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animerEntree = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
    ]).start(() => {
      Animated.stagger(130, cardsAnim.map(anim =>
        Animated.spring(anim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true })
      )).start();
    });
  };

  const animerPulsation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  };

  const animerRotation = () => {
    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 10000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  };

  const rotationMessages = () => {
    setInterval(() => {
      Animated.timing(motifAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setMotifIndex(prev => (prev + 1) % MESSAGES_MOTIVATION.length);
        Animated.timing(motifAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 4000);
  };

  const rotationConseils = () => {
    setInterval(() => {
      Animated.timing(conseilAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setConseilIndex(prev => (prev + 1) % CONSEILS.length);
        Animated.timing(conseilAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 3500);
  };

  const rotationStats = () => {
    setInterval(() => {
      Animated.timing(statAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setStatIndex(prev => (prev + 1) % STATS_MOTIVATION.length);
        Animated.timing(statAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 5000);
  };

  const chargerDonnees = async () => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    try {
      const docSnap = await getDoc(doc(db, 'utilisateurs', utilisateur.uid));
      if (docSnap.exists()) setProfil(docSnap.data());

      const examensSnap = await getDocs(collection(db, `examens/${utilisateur.uid}/liste`));
      const liste: ExamenPlanifie[] = examensSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamenPlanifie));
      const aujourd = new Date();
      const futurs = liste
        .filter(e => new Date(e.date) >= aujourd)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setExamens(futurs);

      if (futurs.length > 0) {
        const prochain = futurs[0];
        setProchainExamen(prochain);
        const diff = Math.ceil((new Date(prochain.date).getTime() - aujourd.getTime()) / (1000 * 60 * 60 * 24));
        setJoursRestants(diff);

        if (diff <= 3) {
          Animated.loop(
            Animated.sequence([
              Animated.timing(urgenceAnim, { toValue: 1.12, duration: 400, useNativeDriver: true }),
              Animated.timing(urgenceAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
              Animated.timing(urgenceAnim, { toValue: 1.12, duration: 400, useNativeDriver: true }),
              Animated.timing(urgenceAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
            ])
          ).start();
        } else {
          Animated.loop(
            Animated.sequence([
              Animated.timing(countdownAnim, { toValue: 1.06, duration: 700, useNativeDriver: true }),
              Animated.timing(countdownAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
            ])
          ).start();
        }
      }
    } catch {}
  };

  const cardStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{
      translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] })
    }, {
      scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1] })
    }]
  });

  const getCouleurJours = () => {
    if (joursRestants === null) return '#4A90D9';
    if (joursRestants <= 1) return '#FF5252';
    if (joursRestants <= 3) return '#FF7043';
    if (joursRestants <= 7) return '#FFC107';
    return '#4CAF50';
  };

  const getMessageJours = () => {
    if (joursRestants === null) return '';
    if (joursRestants === 0) return 'C EST AUJOURD HUI ! 🔥';
    if (joursRestants === 1) return 'DEMAIN ! Prepare-toi ! ⚡';
    if (joursRestants <= 3) return 'Dans peu de temps ! 💪';
    if (joursRestants <= 7) return 'Cette semaine ! 📚';
    return 'Tu as le temps ! 🌟';
  };

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const motif = MESSAGES_MOTIVATION[motifIndex];
  const conseil = CONSEILS[conseilIndex];
  const stat = STATS_MOTIVATION[statIndex];
  const prenom = profil?.nom?.split(' ')[0] || 'Etudiant';

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
          <Text style={styles.retourTexte}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitre}>Examens</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeTexte}>📅 {examens.length}</Text>
        </View>
      </Animated.View>

      {/* Bannière principale */}
      <Animated.View style={[styles.banniere, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.banniereSalut}>Salut {prenom} ! 👋</Text>
          <Animated.View style={{ opacity: motifAnim }}>
            <Text style={styles.banniereMotif}>
              {motif.emoji} {motif.texte}
            </Text>
          </Animated.View>
          <View style={styles.banniereStatRow}>
            <Animated.View style={[styles.banniereStatBadge, { opacity: statAnim }]}>
              <Text style={[styles.banniereStatValeur, { color: stat.couleur }]}>{stat.valeur}</Text>
              <Text style={styles.banniereStatDesc}>{stat.description}</Text>
            </Animated.View>
          </View>
        </View>
        <Animated.Text style={[styles.banniereEmoji, { transform: [{ rotate: spin }] }]}>
          🎓
        </Animated.Text>
      </Animated.View>

      {/* Conseil rotatif */}
      <Animated.View style={[styles.conseilContainer, { opacity: conseilAnim }]}>
        <Text style={styles.conseilIcone}>{conseil.icone}</Text>
        <Text style={styles.conseilTexte}>{conseil.texte}</Text>
      </Animated.View>

      {/* Prochain examen */}
      {prochainExamen && joursRestants !== null ? (
        <Animated.View style={[
          styles.prochainContainer,
          { borderColor: getCouleurJours() + '77', backgroundColor: getCouleurJours() + '11' },
          joursRestants <= 3 && { transform: [{ scale: urgenceAnim }] }
        ]}>
          <View style={styles.prochainGauche}>
            <Text style={styles.prochainLabel}>⏰ PROCHAIN EXAMEN</Text>
            <Text style={styles.prochainMatiere}>{prochainExamen.matiere}</Text>
            <Text style={styles.prochainDate}>
              {new Date(prochainExamen.date).toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long'
              })} à {prochainExamen.heure}
            </Text>
            <Text style={[styles.prochainMessage, { color: getCouleurJours() }]}>
              {getMessageJours()}
            </Text>
          </View>
          <Animated.View style={[
            styles.countdownBadge,
            { backgroundColor: getCouleurJours() + '22', borderColor: getCouleurJours() },
            { transform: [{ scale: countdownAnim }] }
          ]}>
            <Text style={[styles.countdownChiffre, { color: getCouleurJours() }]}>
              {joursRestants}
            </Text>
            <Text style={[styles.countdownLabel, { color: getCouleurJours() }]}>
              {joursRestants <= 1 ? '🔥' : 'jours'}
            </Text>
          </Animated.View>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.aucunExamen, cardStyle(cardsAnim[0])]}>
          <Text style={styles.aucunExamenEmoji}>😌</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.aucunExamenTitre}>Aucun examen planifie</Text>
            <Text style={styles.aucunExamenTexte}>
              Ajoutez vos dates d examens pour recevoir des rappels et ne plus jamais etre pris de court ! 🔔
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Titre section */}
      <Text style={styles.sectionTitre}>🛠️ Vos outils de preparation</Text>

      {/* Simulation d'examen */}
      <Animated.View style={cardStyle(cardsAnim[0])}>
        <TouchableOpacity
          style={[styles.optionCard, styles.optionBleu]}
          onPress={() => router.push('/examens/simulation' as any)}
          activeOpacity={0.75}
        >
          <View style={[styles.optionIconeWrapper, { backgroundColor: 'rgba(74,144,217,0.2)' }]}>
            <Text style={styles.optionEmoji}>📝</Text>
          </View>
          <View style={styles.optionInfo}>
            <Text style={styles.optionTitre}>Simulation d examen</Text>
            <Text style={styles.optionDescription}>
              Conditions reelles avec chronometre — Correction detaillee par l IA apres !
            </Text>
            <View style={styles.optionTags}>
              <View style={[styles.tag, { backgroundColor: 'rgba(74,144,217,0.25)' }]}>
                <Text style={[styles.tagTexte, { color: '#4A90D9' }]}>⏱️ Chrono</Text>
              </View>
              <View style={[styles.tag, { backgroundColor: 'rgba(76,175,80,0.25)' }]}>
                <Text style={[styles.tagTexte, { color: '#4CAF50' }]}>🤖 IA</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.optionFleche, { color: '#4A90D9' }]}>→</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Planning */}
      <Animated.View style={cardStyle(cardsAnim[1])}>
        <TouchableOpacity
          style={[styles.optionCard, styles.optionJaune]}
          onPress={() => router.push('/examens/planning' as any)}
          activeOpacity={0.75}
        >
          <View style={[styles.optionIconeWrapper, { backgroundColor: 'rgba(255,193,7,0.2)' }]}>
            <Text style={styles.optionEmoji}>📅</Text>
          </View>
          <View style={styles.optionInfo}>
            <Text style={[styles.optionTitre, { color: '#FFC107' }]}>Planning des examens</Text>
            <Text style={styles.optionDescription}>
              Enregistrez vos dates et recevez un rappel chaleureux la veille a 18h !
            </Text>
            <View style={styles.optionTags}>
              <View style={[styles.tag, { backgroundColor: 'rgba(255,193,7,0.25)' }]}>
                <Text style={[styles.tagTexte, { color: '#FFC107' }]}>🔔 Rappels 18h</Text>
              </View>
              <View style={[styles.tag, { backgroundColor: 'rgba(255,112,67,0.25)' }]}>
                <Text style={[styles.tagTexte, { color: '#FF7043' }]}>📋 {examens.length} planifie(s)</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.optionFleche, { color: '#FFC107' }]}>→</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Quiz de veille */}
      <Animated.View style={cardStyle(cardsAnim[2])}>
        <TouchableOpacity
          style={[styles.optionCard, styles.optionViolet]}
          onPress={() => router.push('/examens/planning' as any)}
          activeOpacity={0.75}
        >
          <Animated.View style={[styles.optionIconeWrapper, { backgroundColor: 'rgba(171,71,188,0.2)', transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.optionEmoji}>🧠</Text>
          </Animated.View>
          <View style={styles.optionInfo}>
            <Text style={[styles.optionTitre, { color: '#AB47BC' }]}>Quiz de veille</Text>
            <Text style={styles.optionDescription}>
              La veille du jour-J, entrez votre programme — l IA genere jusqu a 50 questions ultra-ciblees !
            </Text>
            <View style={styles.optionTags}>
              <View style={[styles.tag, { backgroundColor: 'rgba(171,71,188,0.25)' }]}>
                <Text style={[styles.tagTexte, { color: '#AB47BC' }]}>⚡ 50 questions</Text>
              </View>
              <View style={[styles.tag, { backgroundColor: 'rgba(74,144,217,0.25)' }]}>
                <Text style={[styles.tagTexte, { color: '#4A90D9' }]}>🎯 Cible</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.optionFleche, { color: '#AB47BC' }]}>→</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Emploi du temps */}
      <Animated.View style={cardStyle(cardsAnim[3])}>
        <TouchableOpacity
          style={[styles.optionCard, styles.optionVert]}
          onPress={() => router.push('/planning' as any)}
          activeOpacity={0.75}
        >
          <View style={[styles.optionIconeWrapper, { backgroundColor: 'rgba(76,175,80,0.2)' }]}>
            <Text style={styles.optionEmoji}>🗓️</Text>
          </View>
          <View style={styles.optionInfo}>
            <Text style={[styles.optionTitre, { color: '#4CAF50' }]}>Emploi du temps</Text>
            <Text style={styles.optionDescription}>
              Entrez vos disponibilites — l IA cree un planning sur-mesure adapte a vos examens !
            </Text>
            <View style={styles.optionTags}>
              <View style={[styles.tag, { backgroundColor: 'rgba(76,175,80,0.25)' }]}>
                <Text style={[styles.tagTexte, { color: '#4CAF50' }]}>🤖 Sur-mesure</Text>
              </View>
              <View style={[styles.tag, { backgroundColor: 'rgba(255,193,7,0.25)' }]}>
                <Text style={[styles.tagTexte, { color: '#FFC107' }]}>📊 Optimise</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.optionFleche, { color: '#4CAF50' }]}>→</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Citation finale */}
      <View style={styles.citation}>
        <Text style={styles.citationTexte}>
          &quot;Le succes c est tomber sept fois et se relever huit.&quot;
        </Text>
        <Text style={styles.citationAuteur}>— Proverbe japonais 🇯🇵</Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 60, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 20 },
  retourBtn: { width: 70 },
  retourTexte: { color: '#4A90D9', fontSize: 14, fontWeight: '600' },
  headerTitre: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  headerBadge: { backgroundColor: 'rgba(74,144,217,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(74,144,217,0.4)' },
  headerBadgeTexte: { color: '#4A90D9', fontSize: 13, fontWeight: '700' },
  banniere: { backgroundColor: 'rgba(74,144,217,0.1)', borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', flexDirection: 'row', alignItems: 'center', gap: 12 },
  banniereSalut: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  banniereMotif: { fontSize: 13, color: '#A8C0DC', lineHeight: 20 },
  banniereStatRow: { marginTop: 4 },
  banniereStatBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  banniereStatValeur: { fontSize: 16, fontWeight: '900' },
  banniereStatDesc: { color: '#8BA4C4', fontSize: 11, flex: 1 },
  banniereEmoji: { fontSize: 42 },
  conseilContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,193,7,0.08)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,193,7,0.2)', gap: 10 },
  conseilIcone: { fontSize: 18 },
  conseilTexte: { flex: 1, color: '#A8C0DC', fontSize: 12, fontStyle: 'italic' },
  prochainContainer: { borderRadius: 18, padding: 18, marginBottom: 20, borderWidth: 2, flexDirection: 'row', alignItems: 'center', gap: 14 },
  prochainGauche: { flex: 1, gap: 4 },
  prochainLabel: { color: '#8BA4C4', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  prochainMatiere: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  prochainDate: { color: '#A8C0DC', fontSize: 12 },
  prochainMessage: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  countdownBadge: { alignItems: 'center', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 2, flexShrink: 0 },
  countdownChiffre: { fontSize: 32, fontWeight: '900' },
  countdownLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  aucunExamen: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12 },
  aucunExamenEmoji: { fontSize: 32 },
  aucunExamenTitre: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  aucunExamenTexte: { color: '#8BA4C4', fontSize: 12, lineHeight: 18 },
  sectionTitre: { color: '#8BA4C4', fontSize: 12, fontWeight: '700', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1.5 },
  optionCard: { borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' },
  optionBleu: { backgroundColor: 'rgba(74,144,217,0.08)', borderColor: 'rgba(74,144,217,0.3)' },
  optionJaune: { backgroundColor: 'rgba(255,193,7,0.07)', borderColor: 'rgba(255,193,7,0.3)' },
  optionViolet: { backgroundColor: 'rgba(171,71,188,0.07)', borderColor: 'rgba(171,71,188,0.3)' },
  optionVert: { backgroundColor: 'rgba(76,175,80,0.07)', borderColor: 'rgba(76,175,80,0.3)' },
  optionIconeWrapper: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  optionEmoji: { fontSize: 28 },
  optionInfo: { flex: 1, gap: 6 },
  optionTitre: { color: '#4A90D9', fontSize: 15, fontWeight: '800' },
  optionDescription: { color: '#A8C0DC', fontSize: 12, lineHeight: 18 },
  optionTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  tagTexte: { fontSize: 11, fontWeight: '700' },
  optionFleche: { fontSize: 20, fontWeight: 'bold', flexShrink: 0 },
  citation: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 18, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#4A90D9', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  citationTexte: { color: '#C8D8EE', fontSize: 14, fontStyle: 'italic', lineHeight: 22, marginBottom: 8 },
  citationAuteur: { color: '#4A90D9', fontSize: 12, fontWeight: '700', textAlign: 'right' },
});
