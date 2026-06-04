import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    Animated, Easing,
    ScrollView,
    StyleSheet,
    Text, TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

interface Badge {
  id: string;
  emoji: string;
  titre: string;
  description: string;
  couleur: string;
  condition: (progression: any) => boolean;
  xpRequis: number;
  categorie: string;
}

const TOUS_BADGES: Badge[] = [
  {
    id: 'premier_pas',
    emoji: '🌱',
    titre: 'Premier Pas',
    description: 'Completez votre premier exercice',
    couleur: '#4CAF50',
    condition: (p) => Object.keys(p?.scores || {}).length >= 1,
    xpRequis: 0,
    categorie: 'Debutant',
  },
  {
    id: 'quizzeur',
    emoji: '🧠',
    titre: 'Quizzeur',
    description: 'Reussissez un quiz avec 70% ou plus',
    couleur: '#4A90D9',
    condition: (p) => Object.values(p?.scores || {}).some((s: any) => s >= 70),
    xpRequis: 50,
    categorie: 'Quiz',
  },
  {
    id: 'cent_xp',
    emoji: '⚡',
    titre: 'Chargeur',
    description: 'Atteignez 100 XP total',
    couleur: '#FFC107',
    condition: (p) => {
      const xp = Object.values(p?.xp || {}).reduce((a: any, b: any) => a + (b || 0), 0) as number;
      return xp >= 100;
    },
    xpRequis: 100,
    categorie: 'XP',
  },
  {
    id: 'debloqueur',
    emoji: '🔓',
    titre: 'Debloqueur',
    description: 'Debloquez le niveau intermediaire',
    couleur: '#FF7043',
    condition: (p) => p?.niveauxDebloques?.includes('intermediaire'),
    xpRequis: 100,
    categorie: 'Progression',
  },
  {
    id: 'cinq_cents_xp',
    emoji: '🔥',
    titre: 'En Feu',
    description: 'Atteignez 500 XP total',
    couleur: '#FF7043',
    condition: (p) => {
      const xp = Object.values(p?.xp || {}).reduce((a: any, b: any) => a + (b || 0), 0) as number;
      return xp >= 500;
    },
    xpRequis: 500,
    categorie: 'XP',
  },
  {
    id: 'avance_debloque',
    emoji: '🎯',
    titre: 'Tireur d Elite',
    description: 'Debloquez le niveau avance',
    couleur: '#FF7043',
    condition: (p) => p?.niveauxDebloques?.includes('avance'),
    xpRequis: 300,
    categorie: 'Progression',
  },
  {
    id: 'perfectionniste',
    emoji: '💎',
    titre: 'Perfectionniste',
    description: 'Obtenez 90% ou plus dans un niveau',
    couleur: '#4A90D9',
    condition: (p) => Object.values(p?.scores || {}).some((s: any) => s >= 90),
    xpRequis: 200,
    categorie: 'Excellence',
  },
  {
    id: 'expert_debloque',
    emoji: '👑',
    titre: 'Roi du Savoir',
    description: 'Debloquez le niveau expert',
    couleur: '#FF5252',
    condition: (p) => p?.niveauxDebloques?.includes('expert'),
    xpRequis: 500,
    categorie: 'Progression',
  },
  {
    id: 'mille_xp',
    emoji: '🌟',
    titre: 'Legende',
    description: 'Atteignez 1000 XP total',
    couleur: '#FF5252',
    condition: (p) => {
      const xp = Object.values(p?.xp || {}).reduce((a: any, b: any) => a + (b || 0), 0) as number;
      return xp >= 1000;
    },
    xpRequis: 1000,
    categorie: 'XP',
  },
  {
    id: 'maitre_quiz',
    emoji: '🏆',
    titre: 'Maitre du Quiz',
    description: 'Reussissez tous les niveaux de quiz',
    couleur: '#FFC107',
    condition: (p) => {
      const scores = p?.scores || {};
      return ['facile', 'intermediaire', 'avance', 'expert'].every(n => (scores[n] || 0) >= 70);
    },
    xpRequis: 800,
    categorie: 'Excellence',
  },
  {
    id: 'perseverant',
    emoji: '💪',
    titre: 'Perseverant',
    description: 'Completez au moins 3 niveaux d exercices',
    couleur: '#AB47BC',
    condition: (p) => Object.keys(p?.scores || {}).length >= 3,
    xpRequis: 300,
    categorie: 'Perseverance',
  },
  {
    id: 'complet',
    emoji: '🎓',
    titre: 'Diplome d Honneur',
    description: 'Debloquez tous les 4 niveaux',
    couleur: '#4CAF50',
    condition: (p) => (p?.niveauxDebloques?.length || 0) >= 4,
    xpRequis: 1150,
    categorie: 'Excellence',
  },
];

const CATEGORIES = ['Tous', 'Debutant', 'Quiz', 'XP', 'Progression', 'Excellence', 'Perseverance'];

export default function Badges() {
  const router = useRouter();
  const [progression, setProgression] = useState<any>(null);
  const [categorieActive, setCategorieActive] = useState('Tous');
  const [badgesDebloques, setBadgesDebloques] = useState<string[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const badgesAnim = useRef(TOUS_BADGES.map(() => new Animated.Value(0))).current;
  const celebrationAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    chargerProgression();
    animerEntree();
    animerPulsation();
  }, []);

  const animerEntree = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
    ]).start(() => {
      Animated.stagger(80, badgesAnim.map(a =>
        Animated.spring(a, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true })
      )).start();
    });
  };

  const animerPulsation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  };

  const animerCelebration = () => {
    Animated.sequence([
      Animated.timing(celebrationAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(celebrationAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(celebrationAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(celebrationAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const chargerProgression = async () => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    try {
      const progSnap = await getDoc(doc(db, 'progression', utilisateur.uid));
      if (progSnap.exists()) {
        const data = progSnap.data();
        setProgression(data);
        const debloques = TOUS_BADGES
          .filter(badge => badge.condition(data))
          .map(badge => badge.id);
        setBadgesDebloques(debloques);
        if (debloques.length > 0) {
          setTimeout(() => animerCelebration(), 500);
        }
      }
    } catch (e) {}
  };

  const getXpTotal = () => {
    if (!progression?.xp) return 0;
    return Object.values(progression.xp).reduce((a: any, b: any) => a + (b || 0), 0) as number;
  };

  const badgesFiltres = TOUS_BADGES.filter(b =>
    categorieActive === 'Tous' || b.categorie === categorieActive
  );

  const badgesDebloquesCount = TOUS_BADGES.filter(b => badgesDebloques.includes(b.id)).length;
  const xpTotal = getXpTotal();

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
          <Text style={styles.retourTexte}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitre}>Mes Badges</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeTexte}>
            {badgesDebloquesCount}/{TOUS_BADGES.length}
          </Text>
        </View>
      </Animated.View>

      {/* Bannière */}
      <Animated.View style={[styles.banniere, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.banniereIcone, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.banniereIconeTexte}>🏆</Text>
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={styles.banniereTitre}>Tableau des Recompenses</Text>
          <Text style={styles.banniereTexte}>
            {badgesDebloquesCount} badge(s) debloque(s) sur {TOUS_BADGES.length} • {xpTotal} XP
          </Text>
          <View style={styles.banniereProgressBarre}>
            <View style={[styles.banniereProgressRemplissage, {
              width: `${(badgesDebloquesCount / TOUS_BADGES.length) * 100}%` as any
            }]} />
          </View>
        </View>
      </Animated.View>

      {/* Stats badges */}
      <View style={styles.statsContainer}>
        {[
          { valeur: badgesDebloquesCount.toString(), label: 'Debloques', emoji: '🔓', couleur: '#4CAF50' },
          { valeur: (TOUS_BADGES.length - badgesDebloquesCount).toString(), label: 'Restants', emoji: '🔒', couleur: '#FF5252' },
          { valeur: Math.round((badgesDebloquesCount / TOUS_BADGES.length) * 100) + '%', label: 'Completion', emoji: '📊', couleur: '#4A90D9' },
        ].map((stat, i) => (
          <View key={i} style={[styles.statCard, { borderColor: stat.couleur + '44' }]}>
            <Text style={styles.statEmoji}>{stat.emoji}</Text>
            <Text style={[styles.statValeur, { color: stat.couleur }]}>{stat.valeur}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Filtre catégories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.categorieBtn, categorieActive === cat && styles.categorieBtnActif]}
            onPress={() => setCategorieActive(cat)}
            activeOpacity={0.7}
          >
            <Text style={[styles.categorieBtnTexte, categorieActive === cat && styles.categorieBtnTexteActif]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Grille de badges */}
      <View style={styles.badgesGrille}>
        {badgesFiltres.map((badge, index) => {
          const estDebloque = badgesDebloques.includes(badge.id);
          const anim = badgesAnim[TOUS_BADGES.indexOf(badge)];

          return (
            <Animated.View
              key={badge.id}
              style={[styles.badgeCard, {
                opacity: anim,
                transform: [{
                  scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] })
                }],
                borderColor: estDebloque ? badge.couleur + '66' : 'rgba(255,255,255,0.06)',
                backgroundColor: estDebloque ? badge.couleur + '11' : 'rgba(255,255,255,0.03)',
              }]}
            >
              {/* Badge verrouillé overlay */}
              {!estDebloque && (
                <View style={styles.badgeVerrouille}>
                  <Text style={styles.badgeVerrouilleCadenas}>🔒</Text>
                </View>
              )}

              {/* Halo derrière l'emoji si débloqué */}
              {estDebloque && (
                <Animated.View style={[styles.badgeHalo, {
                  backgroundColor: badge.couleur + '22',
                  transform: [{ scale: pulseAnim }]
                }]} />
              )}

              <Text style={[styles.badgeEmoji, !estDebloque && styles.badgeEmojiVerrouille]}>
                {badge.emoji}
              </Text>

              <Text style={[styles.badgeTitre, { color: estDebloque ? badge.couleur : '#4A6080' }]}>
                {badge.titre}
              </Text>

              <Text style={styles.badgeDescription}>
                {badge.description}
              </Text>

              {estDebloque ? (
                <View style={[styles.badgeStatut, { backgroundColor: badge.couleur + '22', borderColor: badge.couleur + '55' }]}>
                  <Text style={[styles.badgeStatutTexte, { color: badge.couleur }]}>✓ Obtenu</Text>
                </View>
              ) : (
                <View style={styles.badgeXpRequis}>
                  <Text style={styles.badgeXpRequisTexte}>⚡ {badge.xpRequis} XP requis</Text>
                </View>
              )}
            </Animated.View>
          );
        })}
      </View>

      {/* Message encouragement */}
      <View style={styles.encouragement}>
        <Text style={styles.encouragementTitre}>
          {badgesDebloquesCount === TOUS_BADGES.length
            ? '🎊 Incroyable ! Vous avez tous les badges !'
            : `💪 Plus que ${TOUS_BADGES.length - badgesDebloquesCount} badge(s) pour completer la collection !`}
        </Text>
        <Text style={styles.encouragementTexte}>
          Continuez a pratiquer les quiz et exercices pour debloquer tous les badges. Chaque effort compte ! 🌟
        </Text>
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
  headerBadge: { backgroundColor: 'rgba(255,193,7,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,193,7,0.4)' },
  headerBadgeTexte: { color: '#FFC107', fontSize: 13, fontWeight: '700' },
  banniere: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,193,7,0.08)', borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,193,7,0.25)', gap: 14 },
  banniereIcone: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,193,7,0.2)', alignItems: 'center', justifyContent: 'center' },
  banniereIconeTexte: { fontSize: 28 },
  banniereTitre: { color: '#FFC107', fontSize: 15, fontWeight: '800', marginBottom: 3 },
  banniereTexte: { color: '#A8C0DC', fontSize: 12, marginBottom: 8 },
  banniereProgressBarre: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  banniereProgressRemplissage: { height: '100%', backgroundColor: '#FFC107', borderRadius: 3 },
  statsContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, gap: 4 },
  statEmoji: { fontSize: 20 },
  statValeur: { fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#8BA4C4', fontSize: 10 },
  categoriesScroll: { marginBottom: 20 },
  categorieBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  categorieBtnActif: { backgroundColor: 'rgba(74,144,217,0.2)', borderColor: '#4A90D9' },
  categorieBtnTexte: { color: '#4A6080', fontSize: 12, fontWeight: '600' },
  categorieBtnTexteActif: { color: '#4A90D9' },
  badgesGrille: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  badgeCard: { width: '47%', borderRadius: 16, padding: 14, borderWidth: 1, alignItems: 'center', gap: 8, position: 'relative', overflow: 'hidden' },
  badgeVerrouille: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  badgeVerrouilleCadenas: { fontSize: 24 },
  badgeHalo: { position: 'absolute', width: 60, height: 60, borderRadius: 30, top: 10 },
  badgeEmoji: { fontSize: 36, zIndex: 2 },
  badgeEmojiVerrouille: { opacity: 0.3 },
  badgeTitre: { fontSize: 13, fontWeight: '800', textAlign: 'center', zIndex: 2 },
  badgeDescription: { color: '#8BA4C4', fontSize: 10, textAlign: 'center', lineHeight: 14, zIndex: 2 },
  badgeStatut: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, zIndex: 2 },
  badgeStatutTexte: { fontSize: 11, fontWeight: '700' },
  badgeXpRequis: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, zIndex: 2 },
  badgeXpRequisTexte: { color: '#4A6080', fontSize: 10 },
  encouragement: { backgroundColor: 'rgba(74,144,217,0.07)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(74,144,217,0.2)', gap: 8 },
  encouragementTitre: { color: '#4A90D9', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  encouragementTexte: { color: '#8BA4C4', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});