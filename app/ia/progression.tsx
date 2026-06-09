import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated, Easing,
  ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

interface DonneeProgression {
  niveauxDebloques: string[];
  scores: Record<string, number>;
  xp: Record<string, number>;
  derniereActivite: string;
}

const NIVEAUX_COULEURS: Record<string, string> = {
  facile: '#4CAF50',
  intermediaire: '#FFC107',
  avance: '#FF7043',
  expert: '#FF5252',
};

const NIVEAUX_EMOJIS: Record<string, string> = {
  facile: '🌱',
  intermediaire: '⚡',
  avance: '🎯',
  expert: '🏆',
};

export default function Progression() {
  const router = useRouter();
  const [progression, setProgression] = useState<DonneeProgression | null>(null);
  const [profil, setProfil] = useState<any>(null);
  const [chargement, setChargement] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const barresAnim = useRef(
    ['facile', 'intermediaire', 'avance', 'expert'].map(() => new Animated.Value(0))
  ).current;
  const xpAnim = useRef(new Animated.Value(0)).current;
  const cercleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    chargerDonnees();
    animerEntree();
    animerPulsation();
  }, []);

  const animerEntree = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const animerPulsation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  };

  const animerBarres = (scores: Record<string, number>, xpTotal: number, xpMax: number) => {
    const niveaux = ['facile', 'intermediaire', 'avance', 'expert'];
    Animated.stagger(200, niveaux.map((niveau, i) =>
      Animated.timing(barresAnim[i], {
        toValue: (scores[niveau] || 0) / 100,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      })
    )).start();

    Animated.timing(xpAnim, {
      toValue: Math.min(xpTotal / xpMax, 1),
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    Animated.timing(cercleAnim, {
      toValue: Math.min(xpTotal / xpMax, 1),
      duration: 1500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const chargerDonnees = async () => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    try {
      const profilSnap = await getDoc(doc(db, 'utilisateurs', utilisateur.uid));
      if (profilSnap.exists()) setProfil(profilSnap.data());

      const progSnap = await getDoc(doc(db, 'progression', utilisateur.uid));
      if (progSnap.exists()) {
        const data = progSnap.data() as DonneeProgression;
        setProgression(data);
        const xpTotal = Object.values(data.xp || {}).reduce((a: any, b: any) => a + (b || 0), 0) as number;
        setTimeout(() => animerBarres(data.scores || {}, xpTotal, 1150), 300);
      }
    } catch (e) {
    } finally {
      setChargement(false);
    }
  };

  const getXpTotal = () => {
    if (!progression?.xp) return 0;
    return Object.values(progression.xp).reduce((a: any, b: any) => a + (b || 0), 0) as number;
  };

  const getScoreMoyen = () => {
    if (!progression?.scores) return 0;
    const scores = Object.values(progression.scores);
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  const getNiveauGlobal = () => {
    const xp = getXpTotal();
    if (xp >= 1000) return { label: 'Expert', couleur: '#FF5252', emoji: '🏆', xpSuivant: 1150 };
    if (xp >= 500) return { label: 'Avance', couleur: '#FF7043', emoji: '🎯', xpSuivant: 1000 };
    if (xp >= 200) return { label: 'Intermediaire', couleur: '#FFC107', emoji: '⚡', xpSuivant: 500 };
    return { label: 'Debutant', couleur: '#4CAF50', emoji: '🌱', xpSuivant: 200 };
  };

  const getAnalyseIA = () => {
    if (!progression) return 'Commencez les exercices pour obtenir une analyse personnalisee !';
    const scores = progression.scores || {};
    const scoreMoyen = getScoreMoyen();
    const niveaux = ['facile', 'intermediaire', 'avance', 'expert'];
    const pointsFaibles = niveaux.filter(n => (scores[n] || 0) < 70 && progression.niveauxDebloques?.includes(n));
    const pointsForts = niveaux.filter(n => (scores[n] || 0) >= 70);

    let analyse = '';
    if (pointsForts.length > 0) {
      analyse += `✅ Points forts : ${pointsForts.join(', ')}\n`;
    }
    if (pointsFaibles.length > 0) {
      analyse += `⚠️ A ameliorer : ${pointsFaibles.join(', ')}\n`;
    }
    if (scoreMoyen >= 80) {
      analyse += '🌟 Excellente progression ! Continuez comme ca !';
    } else if (scoreMoyen >= 60) {
      analyse += '💪 Bonne progression ! Encore un effort pour atteindre l excellence !';
    } else {
      analyse += '📚 Continuez a pratiquer regulierement — la perseverance paie toujours !';
    }
    return analyse;
  };

  const niveau = getNiveauGlobal();
  const xpTotal = getXpTotal();
  const scoreMoyen = getScoreMoyen();

  if (chargement) {
    return (
      <View style={styles.chargementContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
        <Text style={styles.chargementTexte}>Analyse de votre progression...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
          <Text style={styles.retourTexte}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitre}>Ma Progression</Text>
        <View style={{ width: 70 }} />
      </Animated.View>

      {/* Carte niveau global */}
      <Animated.View style={[styles.niveauGlobalCard, {
        opacity: fadeAnim,
        borderColor: niveau.couleur + '55'
      }]}>
        <View style={styles.niveauGlobalGauche}>
          <Text style={styles.niveauGlobalLabel}>NIVEAU ACTUEL</Text>
          <Text style={styles.niveauGlobalTitre}>
            {niveau.emoji} {niveau.label}
          </Text>
          <Text style={styles.niveauGlobalXP}>
            {xpTotal} / {niveau.xpSuivant} XP
          </Text>
          <View style={styles.niveauGlobalBarre}>
            <Animated.View style={[styles.niveauGlobalBarreRemplissage, {
              width: xpAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: niveau.couleur,
            }]} />
          </View>
        </View>
        <Animated.View style={[styles.niveauGlobalCercle, {
          backgroundColor: niveau.couleur + '22',
          borderColor: niveau.couleur,
          transform: [{ scale: pulseAnim }]
        }]}>
          <Text style={styles.niveauGlobalEmoji}>{niveau.emoji}</Text>
          <Text style={[styles.niveauGlobalPct, { color: niveau.couleur }]}>
            {Math.round(Math.min((xpTotal / niveau.xpSuivant) * 100, 100))}%
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Stats rapides */}
      <View style={styles.statsRapidesContainer}>
        {[
          { valeur: xpTotal.toString(), label: 'XP Total', emoji: '⚡', couleur: '#FFC107' },
          { valeur: scoreMoyen + '%', label: 'Score moyen', emoji: '🎯', couleur: '#4A90D9' },
          { valeur: (progression?.niveauxDebloques?.length || 1).toString() + '/4', label: 'Niveaux', emoji: '🔓', couleur: '#4CAF50' },
          { valeur: Object.keys(progression?.scores || {}).length.toString(), label: 'Completions', emoji: '✅', couleur: '#AB47BC' },
        ].map((stat, i) => (
          <Animated.View key={i} style={[styles.statRapideCard, {
            opacity: fadeAnim,
            borderColor: stat.couleur + '44'
          }]}>
            <Text style={styles.statRapideEmoji}>{stat.emoji}</Text>
            <Text style={[styles.statRapideValeur, { color: stat.couleur }]}>{stat.valeur}</Text>
            <Text style={styles.statRapideLabel}>{stat.label}</Text>
          </Animated.View>
        ))}
      </View>

      {/* Graphique barres par niveau */}
      <Text style={styles.sectionTitre}>📊 Scores par niveau</Text>
      <View style={styles.graphiqueContainer}>
        {['facile', 'intermediaire', 'avance', 'expert'].map((niveau_, i) => {
          const score = progression?.scores?.[niveau_] || 0;
          const estDebloque = progression?.niveauxDebloques?.includes(niveau_);
          const couleur = NIVEAUX_COULEURS[niveau_];

          return (
            <View key={niveau_} style={styles.graphiqueItem}>
              <View style={styles.graphiqueBarreContainer}>
                <Text style={styles.graphiqueScore}>
                  {estDebloque ? `${score}%` : '🔒'}
                </Text>
                <View style={styles.graphiqueBarre}>
                  <Animated.View style={[styles.graphiqueBarreRemplissage, {
                    height: barresAnim[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                    backgroundColor: estDebloque ? couleur : 'rgba(255,255,255,0.1)',
                  }]} />
                </View>
              </View>
              <Text style={[styles.graphiqueLabel, { color: estDebloque ? couleur : '#4A6080' }]}>
                {NIVEAUX_EMOJIS[niveau_]}
              </Text>
              <Text style={[styles.graphiqueNiveau, { color: estDebloque ? couleur : '#4A6080' }]}>
                {niveau_.slice(0, 5)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* XP par niveau */}
      <Text style={styles.sectionTitre}>⚡ XP gagnes par niveau</Text>
      <View style={styles.xpContainer}>
        {['facile', 'intermediaire', 'avance', 'expert'].map((niveau_, i) => {
          const xp = progression?.xp?.[niveau_] || 0;
          const xpMax = niveau_ === 'facile' ? 100 : niveau_ === 'intermediaire' ? 200 : niveau_ === 'avance' ? 350 : 500;
          const couleur = NIVEAUX_COULEURS[niveau_];
          const pct = Math.min((xp / xpMax) * 100, 100);

          return (
            <View key={niveau_} style={styles.xpItem}>
              <View style={styles.xpItemHeader}>
                <Text style={styles.xpItemEmoji}>{NIVEAUX_EMOJIS[niveau_]}</Text>
                <Text style={[styles.xpItemNiveau, { color: couleur }]}>
                  {niveau_.charAt(0).toUpperCase() + niveau_.slice(1)}
                </Text>
                <Text style={styles.xpItemValeur}>{xp} / {xpMax} XP</Text>
              </View>
              <View style={styles.xpItemBarre}>
                <Animated.View style={[styles.xpItemBarreRemplissage, {
                  width: barresAnim[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', `${pct}%`],
                  }),
                  backgroundColor: couleur,
                }]} />
              </View>
            </View>
          );
        })}
      </View>

      {/* Analyse IA */}
      <View style={styles.analyseContainer}>
        <View style={styles.analyseTitreRow}>
          <Animated.Text style={[styles.analyseIcone, { transform: [{ scale: pulseAnim }] }]}>
            🤖
          </Animated.Text>
          <Text style={styles.analyseTitre}>Analyse AcademiAI</Text>
        </View>
        <Text style={styles.analyseTexte}>{getAnalyseIA()}</Text>
        <TouchableOpacity
          style={styles.analyseBouton}
          onPress={() => router.push('/ia/tuteur' as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.analyseBoutonTexte}>
            💬 Discuter avec le Tuteur IA →
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dernière activité */}
      {progression?.derniereActivite && (
        <View style={styles.derniereActivite}>
          <Text style={styles.derniereActiviteTexte}>
            🕐 Derniere activite : {new Date(progression.derniereActivite).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'long', year: 'numeric'
            })}
          </Text>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 60, paddingHorizontal: 24 },
  chargementContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  chargementTexte: { color: '#8BA4C4', fontSize: 15 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 20 },
  retourBtn: { width: 70 },
  retourTexte: { color: '#4A90D9', fontSize: 14, fontWeight: '600' },
  headerTitre: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  niveauGlobalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1.5, gap: 16 },
  niveauGlobalGauche: { flex: 1, gap: 6 },
  niveauGlobalLabel: { color: '#4A6080', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  niveauGlobalTitre: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  niveauGlobalXP: { color: '#8BA4C4', fontSize: 13 },
  niveauGlobalBarre: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  niveauGlobalBarreRemplissage: { height: '100%', borderRadius: 4 },
  niveauGlobalCercle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2, flexShrink: 0, gap: 2 },
  niveauGlobalEmoji: { fontSize: 24 },
  niveauGlobalPct: { fontSize: 13, fontWeight: '900' },
  statsRapidesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statRapideCard: { flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, gap: 4 },
  statRapideEmoji: { fontSize: 22 },
  statRapideValeur: { fontSize: 20, fontWeight: '900' },
  statRapideLabel: { color: '#8BA4C4', fontSize: 11 },
  sectionTitre: { color: '#8BA4C4', fontSize: 12, fontWeight: '700', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1.5 },
  graphiqueContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 8, alignItems: 'flex-end', justifyContent: 'space-around' },
  graphiqueItem: { flex: 1, alignItems: 'center', gap: 6 },
  graphiqueBarreContainer: { alignItems: 'center', gap: 4 },
  graphiqueScore: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  graphiqueBarre: { width: 28, height: 120, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  graphiqueBarreRemplissage: { width: '100%', borderRadius: 6 },
  graphiqueLabel: { fontSize: 18 },
  graphiqueNiveau: { fontSize: 9, fontWeight: '600', textTransform: 'capitalize' },
  xpContainer: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 14 },
  xpItem: { gap: 8 },
  xpItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  xpItemEmoji: { fontSize: 18 },
  xpItemNiveau: { flex: 1, fontSize: 13, fontWeight: '700' },
  xpItemValeur: { color: '#8BA4C4', fontSize: 12 },
  xpItemBarre: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  xpItemBarreRemplissage: { height: '100%', borderRadius: 4 },
  analyseContainer: { backgroundColor: 'rgba(74,144,217,0.08)', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', gap: 12 },
  analyseTitreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  analyseIcone: { fontSize: 28 },
  analyseTitre: { color: '#4A90D9', fontSize: 16, fontWeight: '800' },
  analyseTexte: { color: '#A8C0DC', fontSize: 14, lineHeight: 24 },
  analyseBouton: { backgroundColor: 'rgba(74,144,217,0.2)', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(74,144,217,0.35)' },
  analyseBoutonTexte: { color: '#4A90D9', fontSize: 13, fontWeight: '700' },
  derniereActivite: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  derniereActiviteTexte: { color: '#4A6080', fontSize: 12, textAlign: 'center' },
});