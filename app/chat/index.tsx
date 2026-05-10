import { useRouter } from 'expo-router';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing,
  ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

const MESSAGES_ACCUEIL = [
  'Ensemble on va plus loin ! 🚀',
  'Partage et apprends avec ta communaute ! 💡',
  'La solidarite c est la cle du succes ! 🤝',
  'Ton prof ou tes camarades sont la pour toi ! 🎓',
  'Seul on va vite, ensemble on va loin ! ⚡',
];

const TIPS = [
  'Les etudiants qui collaborent obtiennent 35% de meilleures notes ! 📈',
  'Partager ses notes, c est doubler ses chances de reussite ! 🎯',
  'Une question posee = une difficulte surmontee ! 💪',
  'Ton camarade d aujourd hui est ton collegue de demain ! 🌟',
];

export default function ChatAccueil() {
  const router = useRouter();
  const [profil, setProfil] = useState<any>(null);
  const [nbProfsDisponibles, setNbProfsDisponibles] = useState(0);
  const [nbMessagesNonLus, setNbMessagesNonLus] = useState(0);
  const [messageAccueil] = useState(
    MESSAGES_ACCUEIL[Math.floor(Math.random() * MESSAGES_ACCUEIL.length)]
  );
  const [tipActuel, setTipActuel] = useState(0);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const tipAnim = useRef(new Animated.Value(1)).current;
  const urgenceAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    chargerProfil();
    chargerProfsDisponibles();
    animerEntree();
    animerPulsation();
    animerUrgence();
    tournerRotation();
    rotationTips();
  }, []);

  const animerEntree = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start(() => {
      Animated.stagger(120, cardsAnim.map(anim =>
        Animated.spring(anim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true })
      )).start();
    });
  };

  const animerPulsation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  };

  const animerUrgence = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(urgenceAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
        Animated.timing(urgenceAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(urgenceAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
        Animated.timing(urgenceAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  };

  const tournerRotation = () => {
    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  };

  const rotationTips = () => {
    setInterval(() => {
      Animated.timing(tipAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setTipActuel(prev => (prev + 1) % TIPS.length);
        Animated.timing(tipAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 4000);
  };

  const chargerProfil = async () => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    try {
      const docSnap = await getDoc(doc(db, 'utilisateurs', utilisateur.uid));
      if (docSnap.exists()) setProfil(docSnap.data());
    } catch (e) {}
  };

  const chargerProfsDisponibles = () => {
    const q = query(
      collection(db, 'utilisateurs'),
      where('role', '==', 'professeur'),
      where('disponible', '==', true)
    );
    const unsub = onSnapshot(q, snap => setNbProfsDisponibles(snap.size));
    return unsub;
  };

  const cardStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{
      translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] })
    }, {
      scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] })
    }]
  });

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const prenom = profil?.nom?.split(' ')[0] || 'Etudiant';

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
          <Text style={styles.retourTexte}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitre}>Chat</Text>
        <View style={styles.statutContainer}>
          <Animated.View style={[styles.pointVert, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={styles.statutTexte}>En ligne</Text>
        </View>
      </Animated.View>

      {/* Bannière principale */}
      <Animated.View style={[styles.banniere, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.banniereGauche}>
          <Text style={styles.banniereSalut}>👋 Salut {prenom} !</Text>
          <Text style={styles.banniereMessage}>{messageAccueil}</Text>
          <View style={styles.banniereStats}>
            <View style={styles.statItem}>
              <Text style={styles.statChiffre}>{nbProfsDisponibles}</Text>
              <Text style={styles.statLabel}>prof(s) dispo</Text>
            </View>
            <View style={styles.statSeparateur} />
            <View style={styles.statItem}>
              <Text style={styles.statChiffre}>∞</Text>
              <Text style={styles.statLabel}>camarades</Text>
            </View>
          </View>
        </View>
        <Animated.Text style={[styles.banniereDeco, { transform: [{ rotate: spin }] }]}>
          🌐
        </Animated.Text>
      </Animated.View>

      {/* Tip rotatif */}
      <Animated.View style={[styles.tipContainer, { opacity: tipAnim }]}>
        <Text style={styles.tipEmoji}>💡</Text>
        <Text style={styles.tipTexte}>{TIPS[tipActuel]}</Text>
      </Animated.View>

      {/* Section titre */}
      <Animated.View style={[{ opacity: fadeAnim }]}>
        <Text style={styles.sectionTitre}>🗂️ Choisissez votre espace</Text>
      </Animated.View>

      {/* Card Chat Communautaire */}
      <Animated.View style={cardStyle(cardsAnim[0])}>
        <TouchableOpacity
          style={styles.cardCommunautaire}
          onPress={() => router.push('/chat/communautaire' as any)}
          activeOpacity={0.75}
        >
          <View style={styles.cardGradientTop} />
          <View style={styles.cardContenu}>
            <View style={styles.cardIconeWrapper}>
              <Text style={styles.cardIcone}>👥</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitre}>Chat Communautaire</Text>
              <Text style={styles.cardDescription}>
                Echangez avec vos camarades, partagez vos notes et progressez ensemble !
              </Text>
              <View style={styles.cardTags}>
                <View style={[styles.tag, { backgroundColor: 'rgba(74,144,217,0.25)' }]}>
                  <Text style={[styles.tagTexte, { color: '#4A90D9' }]}>📝 Notes</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: 'rgba(76,175,80,0.25)' }]}>
                  <Text style={[styles.tagTexte, { color: '#4CAF50' }]}>🤝 Entraide</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: 'rgba(171,71,188,0.25)' }]}>
                  <Text style={[styles.tagTexte, { color: '#AB47BC' }]}>💬 Groupe</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterTexte}>Rejoindre la communaute</Text>
            <Text style={styles.cardFooterFleche}>→</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Card Chat Professeur */}
      <Animated.View style={cardStyle(cardsAnim[1])}>
        <TouchableOpacity
          style={styles.cardProfesseur}
          onPress={() => router.push('/chat/professeur' as any)}
          activeOpacity={0.75}
        >
          <View style={[styles.cardGradientTop, { backgroundColor: 'rgba(255,193,7,0.15)' }]} />
          <View style={styles.cardContenu}>
            <View style={[styles.cardIconeWrapper, { backgroundColor: 'rgba(255,193,7,0.2)' }]}>
              <Text style={styles.cardIcone}>🎓</Text>
            </View>
            <View style={styles.cardInfo}>
              <View style={styles.cardTitreRow}>
                <Text style={[styles.cardTitre, { color: '#FFC107' }]}>Chat Professeur</Text>
                {nbProfsDisponibles > 0 && (
                  <Animated.View style={[styles.dispoBadge, { transform: [{ scale: pulseAnim }] }]}>
                    <Text style={styles.dispoBadgeTexte}>{nbProfsDisponibles} dispo</Text>
                  </Animated.View>
                )}
              </View>
              <Text style={styles.cardDescription}>
                Contactez un professeur disponible ou laissez AcademiAI vous guider !
              </Text>
              <View style={styles.cardTags}>
                <View style={[styles.tag, { backgroundColor: 'rgba(255,193,7,0.25)' }]}>
                  <Text style={[styles.tagTexte, { color: '#FFC107' }]}>👨‍🏫 Profs</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: 'rgba(74,144,217,0.25)' }]}>
                  <Text style={[styles.tagTexte, { color: '#4A90D9' }]}>🤖 IA relais</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={[styles.cardFooter, { borderTopColor: 'rgba(255,193,7,0.2)' }]}>
            <Text style={[styles.cardFooterTexte, { color: '#FFC107' }]}>Contacter un professeur</Text>
            <Text style={[styles.cardFooterFleche, { color: '#FFC107' }]}>→</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Bouton Appel Urgent */}
      <Animated.View style={cardStyle(cardsAnim[2])}>
        <TouchableOpacity
          style={styles.cardUrgence}
          onPress={() => router.push('/chat/professeur' as any)}
          activeOpacity={0.8}
        >
          <View style={styles.urgenceGauche}>
            <Animated.View style={[styles.urgenceIcone, { transform: [{ scale: urgenceAnim }] }]}>
              <Text style={styles.urgenceEmoji}>📞</Text>
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={styles.urgenceTitre}>Appel d urgence !</Text>
              <Text style={styles.urgenceDescription}>
                Besoin d aide immediate ? Alertez TOUS les professeurs disponibles en un clic !
              </Text>
            </View>
          </View>
          <View style={styles.urgenceBadgeRow}>
            <Animated.View style={[styles.urgenceBadge, { transform: [{ scale: urgenceAnim }] }]}>
              <Text style={styles.urgenceBadgeTexte}>🚨 URGENT</Text>
            </Animated.View>
            <Text style={styles.urgenceFleche}>→</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Section IA */}
      <Animated.View style={[cardStyle(cardsAnim[3]), styles.iaSection]}>
        <View style={styles.iaGauche}>
          <Animated.Text style={[styles.iaEmoji, { transform: [{ scale: pulseAnim }] }]}>🤖</Animated.Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.iaTitre}>AcademiAI toujours disponible</Text>
            <Text style={styles.iaDescription}>
              Aucun prof disponible ? Pas de panique ! AcademiAI prend automatiquement le relais 24h/24. 🌙
            </Text>
          </View>
        </View>
        <View style={styles.iaStatut}>
          <View style={styles.iaPointVert} />
          <Text style={styles.iaStatutTexte}>Toujours en ligne</Text>
        </View>
      </Animated.View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 60, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 20 },
  retourBtn: { width: 70 },
  retourTexte: { color: '#4A90D9', fontSize: 14, fontWeight: '600' },
  headerTitre: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  statutContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pointVert: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#4CAF50' },
  statutTexte: { color: '#4CAF50', fontSize: 11, fontWeight: '700' },
  banniere: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74,144,217,0.1)', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(74,144,217,0.3)' },
  banniereGauche: { flex: 1, gap: 6 },
  banniereSalut: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  banniereMessage: { fontSize: 13, color: '#A8C0DC', lineHeight: 20 },
  banniereStats: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  statItem: { alignItems: 'center' },
  statChiffre: { color: '#4A90D9', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#8BA4C4', fontSize: 10 },
  statSeparateur: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)' },
  banniereDeco: { fontSize: 42, marginLeft: 12 },
  tipContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,193,7,0.08)', borderRadius: 10, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,193,7,0.2)', gap: 8 },
  tipEmoji: { fontSize: 18 },
  tipTexte: { flex: 1, color: '#A8C0DC', fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
  sectionTitre: { color: '#8BA4C4', fontSize: 12, fontWeight: '700', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1.5 },
  cardCommunautaire: { backgroundColor: 'rgba(74,144,217,0.08)', borderRadius: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(74,144,217,0.3)', overflow: 'hidden' },
  cardProfesseur: { backgroundColor: 'rgba(255,193,7,0.07)', borderRadius: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,193,7,0.3)', overflow: 'hidden' },
  cardGradientTop: { height: 4, backgroundColor: 'rgba(74,144,217,0.4)', width: '100%' },
  cardContenu: { flexDirection: 'row', padding: 16, gap: 14, alignItems: 'flex-start' },
  cardIconeWrapper: { width: 54, height: 54, borderRadius: 16, backgroundColor: 'rgba(74,144,217,0.18)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardIcone: { fontSize: 28 },
  cardInfo: { flex: 1, gap: 6 },
  cardTitreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitre: { color: '#4A90D9', fontSize: 16, fontWeight: '800' },
  cardDescription: { color: '#A8C0DC', fontSize: 12, lineHeight: 18 },
  cardTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  tagTexte: { fontSize: 11, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(74,144,217,0.15)' },
  cardFooterTexte: { color: '#4A90D9', fontSize: 13, fontWeight: '700' },
  cardFooterFleche: { color: '#4A90D9', fontSize: 18, fontWeight: 'bold' },
  dispoBadge: { backgroundColor: '#4CAF5033', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#4CAF5066' },
  dispoBadgeTexte: { color: '#4CAF50', fontSize: 11, fontWeight: '700' },
  cardUrgence: { backgroundColor: 'rgba(255,82,82,0.08)', borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: 'rgba(255,82,82,0.4)', gap: 12 },
  urgenceGauche: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  urgenceIcone: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,82,82,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  urgenceEmoji: { fontSize: 26 },
  urgenceTitre: { color: '#FF5252', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  urgenceDescription: { color: '#A8C0DC', fontSize: 12, lineHeight: 18 },
  urgenceBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  urgenceBadge: { backgroundColor: '#FF5252', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  urgenceBadgeTexte: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  urgenceFleche: { color: '#FF5252', fontSize: 20, fontWeight: 'bold' },
  iaSection: { backgroundColor: 'rgba(74,144,217,0.06)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(74,144,217,0.2)', gap: 10 },
  iaGauche: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iaEmoji: { fontSize: 32 },
  iaTitre: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  iaDescription: { color: '#8BA4C4', fontSize: 12, lineHeight: 19 },
  iaStatut: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iaPointVert: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4CAF50' },
  iaStatutTexte: { color: '#4CAF50', fontSize: 11, fontWeight: '600' },
});