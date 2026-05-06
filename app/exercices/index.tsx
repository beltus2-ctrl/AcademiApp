import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated,
  ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

interface Niveau {
  id: string;
  label: string;
  emoji: string;
  couleur: string;
  couleurFond: string;
  description: string;
  messageMotivation: string;
  messageVerrouille: string;
  xp: number;
}

const NIVEAUX: Niveau[] = [
  {
    id: 'facile',
    label: 'Debutant',
    emoji: '🌱',
    couleur: '#4CAF50',
    couleurFond: 'rgba(76,175,80,0.12)',
    description: 'Pose les bases solides de ta comprehension !',
    messageMotivation: 'Parfait pour commencer, tu vas cartonner ! 🚀',
    messageVerrouille: 'Completez le niveau precedent pour debloquer',
    xp: 100,
  },
  {
    id: 'intermediaire',
    label: 'Intermediaire',
    emoji: '⚡',
    couleur: '#FFC107',
    couleurFond: 'rgba(255,193,7,0.12)',
    description: 'Monte en puissance avec des exercices plus profonds !',
    messageMotivation: 'Tu chauffes ! Montre ce que tu sais faire ! 🔥',
    messageVerrouille: 'Atteignez 70% au niveau Debutant pour debloquer',
    xp: 200,
  },
  {
    id: 'avance',
    label: 'Avance',
    emoji: '🎯',
    couleur: '#FF7043',
    couleurFond: 'rgba(255,112,67,0.12)',
    description: 'Les vrais defis commencent ici. Es-tu pret ?',
    messageMotivation: 'Peu d etudiants arrivent ici. Tu es dans l elite ! 👑',
    messageVerrouille: 'Atteignez 70% au niveau Intermediaire pour debloquer',
    xp: 350,
  },
  {
    id: 'expert',
    label: 'Expert',
    emoji: '🏆',
    couleur: '#FF5252',
    couleurFond: 'rgba(255,82,82,0.12)',
    description: 'Le sommet de la maitrise. Legendaire !',
    messageMotivation: 'Tu es une legende vivante ! Rien ne peut t arreter ! 🌟',
    messageVerrouille: 'Atteignez 70% au niveau Avance pour debloquer',
    xp: 500,
  },
];

const MESSAGES_ACCUEIL = [
  'Pret a dominer ces exercices ? 💪',
  'Chaque exercice te rend plus fort ! 🧠',
  'La pratique fait le maitre ! 🎓',
  'Aujourd hui tu deviens imbattable ! ⚡',
];

const FELICITATIONS = [
  'Incroyable travail ! 🎉',
  'Tu es en feu ! 🔥',
  'Continue comme ca champion ! 🏆',
  'Rien ne peut t arreter ! 💫',
];

export default function Exercices() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [niveauxDebloques, setNiveauxDebloques] = useState<string[]>(['facile']);
  const [scoresPrecedents, setScoresPrecedents] = useState<Record<string, number>>({});
  const [chargement, setChargement] = useState(true);
  const [messageAccueil] = useState(MESSAGES_ACCUEIL[Math.floor(Math.random() * MESSAGES_ACCUEIL.length)]);
  const [xpTotal, setXpTotal] = useState(0);
  const [nouveauNiveauDebloque, setNouveauNiveauDebloque] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cardsAnim = useRef(NIVEAUX.map(() => new Animated.Value(0))).current;

  const pourcentageQuiz = params.pourcentage ? parseInt(params.pourcentage as string) : 0;
  const niveauDebloque = params.niveauDebloque as string || '';

  useEffect(() => {
    chargerProgression();
    animerEntree();
    animerPulsation();
  }, []);

  useEffect(() => {
    if (pourcentageQuiz >= 70 && niveauDebloque) {
      debloquerNiveauSuivant(niveauDebloque);
    }
  }, [pourcentageQuiz, niveauDebloque]);

  const animerEntree = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => {
      NIVEAUX.forEach((_, index) => {
        Animated.timing(cardsAnim[index], {
          toValue: 1,
          duration: 400,
          delay: index * 120,
          useNativeDriver: true,
        }).start();
      });
    });
  };

  const animerPulsation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  };

  const chargerProgression = async () => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    try {
      const docSnap = await getDoc(doc(db, 'progression', utilisateur.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        const niveaux = data.niveauxDebloques || ['facile'];
        const scores = data.scores || {};
        setNiveauxDebloques(niveaux);
        setScoresPrecedents(scores);
        const xp = niveaux.reduce((acc: number, n: string) => {
          const niveau = NIVEAUX.find(nv => nv.id === n);
          return acc + (niveau ? niveau.xp : 0);
        }, 0);
        setXpTotal(xp);
      }
    } catch (erreur) {
      console.log('Erreur chargement progression');
    } finally {
      setChargement(false);
    }
  };

  const debloquerNiveauSuivant = async (niveauActuel: string) => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    const ordre = ['facile', 'intermediaire', 'avance', 'expert'];
    const indexActuel = ordre.indexOf(niveauActuel);
    if (indexActuel < ordre.length - 1) {
      const prochainNiveau = ordre[indexActuel + 1];
      if (!niveauxDebloques.includes(prochainNiveau)) {
        const nouveauxNiveaux = [...new Set([...niveauxDebloques, prochainNiveau])];
        setNiveauxDebloques(nouveauxNiveaux);
        setNouveauNiveauDebloque(prochainNiveau);
        const nouveauNiveauInfo = NIVEAUX.find(n => n.id === prochainNiveau);
        const xp = nouveauxNiveaux.reduce((acc, n) => {
          const niveau = NIVEAUX.find(nv => nv.id === n);
          return acc + (niveau ? niveau.xp : 0);
        }, 0);
        setXpTotal(xp);
        try {
          await setDoc(doc(db, 'progression', utilisateur.uid), {
            niveauxDebloques: nouveauxNiveaux,
            scores: { ...scoresPrecedents, [niveauActuel]: pourcentageQuiz }
          }, { merge: true });
        } catch (erreur) {
          console.log('Erreur sauvegarde progression');
        }
        setTimeout(() => {
          Alert.alert(
            '🎉 Niveau debloque !',
            `Felicitations ! Tu as debloque le niveau ${nouveauNiveauInfo?.label} ${nouveauNiveauInfo?.emoji}\n\n${FELICITATIONS[Math.floor(Math.random() * FELICITATIONS.length)]}\n\n+${nouveauNiveauInfo?.xp} XP gagnes !`
          );
        }, 500);
      }
    }
  };

  const getNombreNiveauxCompletes = () => {
    return Object.keys(scoresPrecedents).filter(k => scoresPrecedents[k] >= 70).length;
  };

  const getEtoiles = () => {
    const completes = getNombreNiveauxCompletes();
    return '⭐'.repeat(completes) + '☆'.repeat(4 - completes);
  };

  if (chargement) {
    return (
      <View style={styles.chargementContainer}>
        <Text style={styles.chargementEmoji}>📚</Text>
        <Text style={styles.chargementTitre}>Chargement de votre aventure...</Text>
        <Text style={styles.chargementSous}>Preparation des exercices en cours</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
          <Text style={styles.retourTexte}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitre}>Exercices</Text>
        <View style={styles.xpBadge}>
          <Text style={styles.xpTexte}>⚡{xpTotal}</Text>
          <Text style={styles.xpSous}>XP</Text>
        </View>
      </View>

      {/* Bannière animée */}
      <Animated.View style={[styles.banniere, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.banniereTitre}>Banque d Exercices 📚</Text>
          <Text style={styles.banniereTexte}>{messageAccueil}</Text>
          <Text style={styles.banniereEtoiles}>{getEtoiles()}</Text>
        </View>
        <Animated.View style={[styles.progressionCircle, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.progressionChiffre}>{niveauxDebloques.length}</Text>
          <Text style={styles.progressionSous}>/ 4</Text>
        </Animated.View>
      </Animated.View>

      {/* Barre XP */}
      <View style={styles.xpContainer}>
        <View style={styles.xpHeader}>
          <Text style={styles.xpLabel}>⚡ Progression XP</Text>
          <Text style={styles.xpValeur}>{xpTotal} / 1150 XP</Text>
        </View>
        <View style={styles.xpBarre}>
          <Animated.View style={[styles.xpRemplissage, {
            width: `${Math.min((xpTotal / 1150) * 100, 100)}%` as any
          }]} />
        </View>
        <Text style={styles.xpMessage}>
          {xpTotal === 0 ? 'Commence les exercices pour gagner des XP !' :
           xpTotal < 500 ? 'Continue, tu progresses bien ! 💪' :
           xpTotal < 1000 ? 'Impressionnant ! Tu es dans le top ! 🔥' :
           'LEGENDAIRE ! Tu as tout debloque ! 🏆'}
        </Text>
      </View>

      {/* Nouveau niveau débloqué */}
      {nouveauNiveauDebloque !== '' && (
        <Animated.View style={[styles.nouveauNiveauBanner, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.nouveauNiveauTexte}>
            🎉 Nouveau niveau debloque : {NIVEAUX.find(n => n.id === nouveauNiveauDebloque)?.label} !
          </Text>
        </Animated.View>
      )}

      {/* Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoTexte}>
          🔓 Score ≥ <Text style={styles.infoGras}>70%</Text> au quiz pour debloquer le niveau suivant
        </Text>
      </View>

      {/* Niveaux */}
      {NIVEAUX.map((niveau, index) => {
        const estDebloque = niveauxDebloques.includes(niveau.id);
        const scorePrecedent = scoresPrecedents[niveau.id];
        const estComplete = scorePrecedent !== undefined && scorePrecedent >= 70;

        return (
          <Animated.View
            key={niveau.id}
            style={{
              opacity: cardsAnim[index],
              transform: [{
                translateY: cardsAnim[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [40, 0],
                })
              }]
            }}
          >
            <TouchableOpacity
              style={[
                styles.niveauCard,
                { borderColor: estDebloque ? niveau.couleur + '66' : 'rgba(255,255,255,0.06)' },
                estComplete && { borderColor: niveau.couleur, borderWidth: 2 },
                !estDebloque && styles.niveauCardVerrouille,
              ]}
              onPress={() => {
                if (!estDebloque) {
                  Alert.alert(
                    '🔒 Niveau verrouille',
                    niveau.messageVerrouille + '\n\nChaque grand voyage commence par un premier pas. Continue ! 💪'
                  );
                  return;
                }
                router.push({
                  pathname: '/exercices/exercice',
                  params: { niveau: niveau.id, 
                  couleur: niveau.couleur,
                }
                });
              }}
              activeOpacity={estDebloque ? 0.75 : 1}
            >
              {/* Badge XP */}
              {estDebloque && (
                <View style={[styles.xpNiveauBadge, { backgroundColor: niveau.couleur + '22', borderColor: niveau.couleur + '55' }]}>
                  <Text style={[styles.xpNiveauTexte, { color: niveau.couleur }]}>+{niveau.xp} XP</Text>
                </View>
              )}

              <View style={styles.niveauContenu}>
                <View style={[styles.niveauIcone, { backgroundColor: estDebloque ? niveau.couleurFond : 'rgba(255,255,255,0.03)' }]}>
                  <Text style={styles.niveauEmoji}>
                    {estComplete ? '✅' : estDebloque ? niveau.emoji : '🔒'}
                  </Text>
                </View>

                <View style={styles.niveauInfo}>
                  <View style={styles.niveauTitreRow}>
                    <Text style={[styles.niveauLabel, { color: estDebloque ? niveau.couleur : '#4A6080' }]}>
                      {niveau.label}
                    </Text>
                    {estComplete && (
                      <View style={[styles.scoreBadge, { backgroundColor: niveau.couleur + '22', borderColor: niveau.couleur }]}>
                        <Text style={[styles.scoreTexte, { color: niveau.couleur }]}>✓ {scorePrecedent}%</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.niveauDescription, { color: estDebloque ? '#A8C0DC' : '#4A6080' }]}>
                    {estDebloque ? niveau.description : niveau.messageVerrouille}
                  </Text>
                  {estDebloque && (
                    <Text style={[styles.niveauMotivation, { color: niveau.couleur + 'BB' }]}>
                      {niveau.messageMotivation}
                    </Text>
                  )}
                </View>

                <Text style={[styles.niveauFleche, { color: estDebloque ? niveau.couleur : '#4A6080' }]}>
                  {estDebloque ? '→' : '🔒'}
                </Text>
              </View>

              {/* Barre de progression du niveau */}
              {estDebloque && (
                <View style={styles.niveauBarreContainer}>
                  <View style={styles.niveauBarre}>
                    <View style={[styles.niveauBarreRemplissage, {
                      width: `${scorePrecedent ? Math.min(scorePrecedent, 100) : 0}%` as any,
                      backgroundColor: niveau.couleur
                    }]} />
                  </View>
                  <Text style={[styles.niveauBarreTexte, { color: niveau.couleur }]}>
                    {scorePrecedent ? scorePrecedent + '%' : 'Non commence'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {/* Astuce finale */}
      <View style={styles.astuce}>
        <Text style={styles.astuceTitre}>🧠 Le savais-tu ?</Text>
        <Text style={styles.astuceTexte}>
          Les etudiants qui pratiquent des exercices regulierement obtiennent en moyenne <Text style={styles.astuceGras}>40% de meilleures notes</Text> aux examens. Tu es sur la bonne voie ! 🎓
        </Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 60, paddingHorizontal: 24 },
  chargementContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  chargementEmoji: { fontSize: 56 },
  chargementTitre: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  chargementSous: { color: '#8BA4C4', fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 20 },
  retourBtn: { width: 70 },
  retourTexte: { color: '#4A90D9', fontSize: 14, fontWeight: '600' },
  headerTitre: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  xpBadge: { alignItems: 'center', backgroundColor: 'rgba(255,193,7,0.15)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,193,7,0.4)' },
  xpTexte: { color: '#FFC107', fontSize: 13, fontWeight: '800' },
  xpSous: { color: '#FFC107', fontSize: 9, fontWeight: '600' },
  banniere: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74,144,217,0.12)', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', gap: 14 },
  banniereTitre: { fontSize: 17, fontWeight: 'bold', color: '#4A90D9', marginBottom: 4 },
  banniereTexte: { fontSize: 13, color: '#A8C0DC', marginBottom: 6 },
  banniereEtoiles: { fontSize: 18, letterSpacing: 2 },
  progressionCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(74,144,217,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#4A90D9' },
  progressionChiffre: { color: '#4A90D9', fontSize: 22, fontWeight: '900' },
  progressionSous: { color: '#8BA4C4', fontSize: 10 },
  xpContainer: { backgroundColor: 'rgba(255,193,7,0.06)', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,193,7,0.2)', gap: 8 },
  xpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  xpLabel: { color: '#FFC107', fontSize: 13, fontWeight: '700' },
  xpValeur: { color: '#FFC107', fontSize: 12, fontWeight: '600' },
  xpBarre: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  xpRemplissage: { height: '100%', backgroundColor: '#FFC107', borderRadius: 4 },
  xpMessage: { color: '#A8C0DC', fontSize: 12, fontStyle: 'italic' },
  nouveauNiveauBanner: { backgroundColor: 'rgba(76,175,80,0.15)', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#4CAF5066', alignItems: 'center' },
  nouveauNiveauTexte: { color: '#4CAF50', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  infoContainer: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  infoTexte: { color: '#A8C0DC', fontSize: 13, lineHeight: 20 },
  infoGras: { color: '#4A90D9', fontWeight: 'bold' },
  niveauCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, gap: 12 },
  niveauCardVerrouille: { opacity: 0.45 },
  xpNiveauBadge: { alignSelf: 'flex-end', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, marginBottom: 4 },
  xpNiveauTexte: { fontSize: 11, fontWeight: '700' },
  niveauContenu: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  niveauIcone: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  niveauEmoji: { fontSize: 26 },
  niveauInfo: { flex: 1, gap: 4 },
  niveauTitreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  niveauLabel: { fontSize: 16, fontWeight: '800' },
  scoreBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  scoreTexte: { fontSize: 11, fontWeight: '700' },
  niveauDescription: { fontSize: 12, lineHeight: 18 },
  niveauMotivation: { fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  niveauFleche: { fontSize: 20, fontWeight: 'bold', flexShrink: 0 },
  niveauBarreContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  niveauBarre: { flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  niveauBarreRemplissage: { height: '100%', borderRadius: 3 },
  niveauBarreTexte: { fontSize: 11, fontWeight: '700', width: 80, textAlign: 'right' },
  astuce: { backgroundColor: 'rgba(74,144,217,0.07)', borderRadius: 14, padding: 16, marginTop: 8, borderWidth: 1, borderColor: 'rgba(74,144,217,0.2)', gap: 6 },
  astuceTitre: { color: '#4A90D9', fontSize: 14, fontWeight: '700' },
  astuceTexte: { color: '#8BA4C4', fontSize: 13, lineHeight: 21 },
  astuceGras: { color: '#4A90D9', fontWeight: 'bold' },
});