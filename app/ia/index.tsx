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

const TIPS_IA = [
  'L IA analyse vos resultats pour personnaliser votre apprentissage ! 🧠',
  'Plus vous utilisez AcademiApp, plus l IA devient precis ! 📈',
  'Le tuteur IA s adapte a votre niveau en temps reel ! ⚡',
  'Vos badges refletent votre progression reelle ! 🏆',
];

export default function IAHub() {
  const router = useRouter();
  const [profil, setProfil] = useState<any>(null);
  const [progression, setProgression] = useState<any>(null);
  const [tipIndex, setTipIndex] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef([0,1,2,3].map(() => new Animated.Value(0))).current;
  const tipAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    chargerDonnees();
    animerEntree();
    animerPulsation();
    animerRotation();
    animerGlow();
    rotationTips();
  }, []);

  const animerEntree = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
    ]).start(() => {
      Animated.stagger(130, cardsAnim.map(a =>
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

  const animerRotation = () => {
    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  };

  const animerGlow = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  };

  const rotationTips = () => {
    setInterval(() => {
      Animated.timing(tipAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setTipIndex(prev => (prev + 1) % TIPS_IA.length);
        Animated.timing(tipAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 4000);
  };

  const chargerDonnees = async () => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    try {
      const profilSnap = await getDoc(doc(db, 'utilisateurs', utilisateur.uid));
      if (profilSnap.exists()) setProfil(profilSnap.data());
      const progSnap = await getDoc(doc(db, 'progression', utilisateur.uid));
      if (progSnap.exists()) setProgression(progSnap.data());
    } catch (e) {}
  };

  const getNiveauIA = () => {
    if (!progression) return { label: 'Debutant', couleur: '#4CAF50', emoji: '🌱' };
    const xp = Object.values(progression.xp || {}).reduce((a: number, b: any) => a + (b || 0), 0) as number;
    if (xp >= 1000) return { label: 'Expert', couleur: '#FF5252', emoji: '🏆' };
    if (xp >= 500) return { label: 'Avance', couleur: '#FF7043', emoji: '🎯' };
    if (xp >= 200) return { label: 'Intermediaire', couleur: '#FFC107', emoji: '⚡' };
    return { label: 'Debutant', couleur: '#4CAF50', emoji: '🌱' };
  };

  const cardStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{
      translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] })
    }, {
      scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1] })
    }]
  });

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });
  const niveau = getNiveauIA();
  const prenom = profil?.nom?.split(' ')[0] || 'Etudiant';

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
          <Text style={styles.retourTexte}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitre}>AcademiAI</Text>
        <View style={[styles.niveauBadge, { backgroundColor: niveau.couleur + '22', borderColor: niveau.couleur + '55' }]}>
          <Text style={styles.niveauBadgeTexte}>{niveau.emoji} {niveau.label}</Text>
        </View>
      </Animated.View>

      {/* Bannière IA */}
      <Animated.View style={[styles.banniere, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.banniereGauche}>
          <Text style={styles.banniereSalut}>Salut {prenom} ! 🤖</Text>
          <Text style={styles.banniereTexte}>
            Votre assistant IA personnel est pret a vous accompagner vers l excellence !
          </Text>
          <View style={styles.banniereStatut}>
            <Animated.View style={[styles.statutPoint, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.statutTexte}>AcademiAI actif et operationnel</Text>
          </View>
        </View>
        <View style={styles.banniereIconeContainer}>
          <Animated.View style={[styles.banniereHalo, { opacity: glowOpacity }]} />
          <Animated.View style={[styles.banniereOrbite, { transform: [{ rotate: spin }] }]}>
            <View style={styles.orbiteDot} />
          </Animated.View>
          <Animated.Text style={[styles.banniereIcone, { transform: [{ scale: pulseAnim }] }]}>
            🤖
          </Animated.Text>
        </View>
      </Animated.View>

      {/* Tip rotatif */}
      <Animated.View style={[styles.tipContainer, { opacity: tipAnim }]}>
        <Text style={styles.tipEmoji}>💡</Text>
        <Text style={styles.tipTexte}>{TIPS_IA[tipIndex]}</Text>
      </Animated.View>

      {/* Titre section */}
      <Text style={styles.sectionTitre}>🛠️ Outils IA</Text>

      {/* Tuteur IA */}
      <Animated.View style={cardStyle(cardsAnim[0])}>
        <TouchableOpacity
          style={[styles.toolCard, styles.toolBleu]}
          onPress={() => router.push('/ia/tuteur' as any)}
          activeOpacity={0.75}
        >
          <View style={styles.toolCardTop}>
            <Animated.View style={[styles.toolIcone, { backgroundColor: 'rgba(74,144,217,0.2)', transform: [{ scale: pulseAnim }] }]}>
              <Text style={styles.toolEmoji}>🎓</Text>
            </Animated.View>
            <View style={styles.toolBadgeNouveau}>
              <Text style={styles.toolBadgeNouveauTexte}>✨ NOUVEAU</Text>
            </View>
          </View>
          <Text style={styles.toolTitre}>Tuteur IA Personnel</Text>
          <Text style={styles.toolDescription}>
            Un tuteur qui vous connait, s adapte a votre niveau et repond a toutes vos questions academiques avec bienveillance !
          </Text>
          <View style={styles.toolFooter}>
            <View style={styles.toolTag}>
              <Text style={styles.toolTagTexte}>🧠 Adaptatif</Text>
            </View>
            <View style={styles.toolTag}>
              <Text style={styles.toolTagTexte}>💬 Conversationnel</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Progression */}
      <Animated.View style={cardStyle(cardsAnim[1])}>
        <TouchableOpacity
          style={[styles.toolCard, styles.toolVert]}
          onPress={() => router.push('/ia/progression' as any)}
          activeOpacity={0.75}
        >
          <View style={styles.toolCardTop}>
            <View style={[styles.toolIcone, { backgroundColor: 'rgba(76,175,80,0.2)' }]}>
              <Text style={styles.toolEmoji}>📈</Text>
            </View>
          </View>
          <Text style={[styles.toolTitre, { color: '#4CAF50' }]}>Analyse de Progression</Text>
          <Text style={styles.toolDescription}>
            Visualisez vos scores, votre evolution XP et identifiez vos points forts et axes d amelioration !
          </Text>
          <View style={styles.toolFooter}>
            <View style={[styles.toolTag, { backgroundColor: 'rgba(76,175,80,0.2)' }]}>
              <Text style={[styles.toolTagTexte, { color: '#4CAF50' }]}>📊 Graphiques</Text>
            </View>
            <View style={[styles.toolTag, { backgroundColor: 'rgba(76,175,80,0.2)' }]}>
              <Text style={[styles.toolTagTexte, { color: '#4CAF50' }]}>🎯 Insights</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Badges */}
      <Animated.View style={cardStyle(cardsAnim[2])}>
        <TouchableOpacity
          style={[styles.toolCard, styles.toolOr]}
          onPress={() => router.push('/badges' as any)}
          activeOpacity={0.75}
        >
          <View style={styles.toolCardTop}>
            <View style={[styles.toolIcone, { backgroundColor: 'rgba(255,193,7,0.2)' }]}>
              <Text style={styles.toolEmoji}>🏆</Text>
            </View>
          </View>
          <Text style={[styles.toolTitre, { color: '#FFC107' }]}>Mes Badges & Recompenses</Text>
          <Text style={styles.toolDescription}>
            Debloquez des badges en progressant — chaque effort est recompense et reconnu !
          </Text>
          <View style={styles.toolFooter}>
            <View style={[styles.toolTag, { backgroundColor: 'rgba(255,193,7,0.2)' }]}>
              <Text style={[styles.toolTagTexte, { color: '#FFC107' }]}>🌟 Achievements</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Recommandations */}
      <Animated.View style={cardStyle(cardsAnim[3])}>
        <View style={[styles.toolCard, styles.toolViolet]}>
          <View style={styles.toolCardTop}>
            <View style={[styles.toolIcone, { backgroundColor: 'rgba(171,71,188,0.2)' }]}>
              <Text style={styles.toolEmoji}>🎯</Text>
            </View>
            <View style={[styles.toolBadgeNouveau, { backgroundColor: 'rgba(171,71,188,0.3)' }]}>
              <Text style={[styles.toolBadgeNouveauTexte, { color: '#AB47BC' }]}>IA ANALYSE</Text>
            </View>
          </View>
          <Text style={[styles.toolTitre, { color: '#AB47BC' }]}>Recommandations IA</Text>
          <Text style={styles.toolDescription}>
            {progression
              ? 'L IA a analyse votre profil ! Consultez le Tuteur IA pour des recommandations personnalisees.'
              : 'Commencez les quiz et exercices pour que l IA puisse analyser votre profil et vous guider !'}
          </Text>
          <View style={styles.toolFooter}>
            <View style={[styles.toolTag, { backgroundColor: 'rgba(171,71,188,0.2)' }]}>
              <Text style={[styles.toolTagTexte, { color: '#AB47BC' }]}>
                {progression ? '✅ Profil analyse' : '⏳ En attente'}
              </Text>
            </View>
          </View>
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
  niveauBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  niveauBadgeTexte: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  banniere: { backgroundColor: 'rgba(74,144,217,0.1)', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', flexDirection: 'row', alignItems: 'center', gap: 14 },
  banniereGauche: { flex: 1, gap: 6 },
  banniereSalut: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  banniereTexte: { fontSize: 13, color: '#A8C0DC', lineHeight: 20 },
  banniereStatut: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statutPoint: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  statutTexte: { color: '#4CAF50', fontSize: 11, fontWeight: '600' },
  banniereIconeContainer: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center' },
  banniereHalo: { position: 'absolute', width: 70, height: 70, borderRadius: 35, backgroundColor: '#4A90D9' },
  banniereOrbite: { position: 'absolute', width: 70, height: 70, borderRadius: 35, borderWidth: 1, borderColor: 'rgba(74,144,217,0.4)' },
  orbiteDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4A90D9', position: 'absolute', top: -4, left: '50%', marginLeft: -4 },
  banniereIcone: { fontSize: 36 },
  tipContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,193,7,0.08)', borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,193,7,0.2)', gap: 10 },
  tipEmoji: { fontSize: 18 },
  tipTexte: { flex: 1, color: '#A8C0DC', fontSize: 12, fontStyle: 'italic' },
  sectionTitre: { color: '#8BA4C4', fontSize: 12, fontWeight: '700', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1.5 },
  toolCard: { borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, gap: 10 },
  toolBleu: { backgroundColor: 'rgba(74,144,217,0.08)', borderColor: 'rgba(74,144,217,0.3)' },
  toolVert: { backgroundColor: 'rgba(76,175,80,0.07)', borderColor: 'rgba(76,175,80,0.3)' },
  toolOr: { backgroundColor: 'rgba(255,193,7,0.07)', borderColor: 'rgba(255,193,7,0.3)' },
  toolViolet: { backgroundColor: 'rgba(171,71,188,0.07)', borderColor: 'rgba(171,71,188,0.3)' },
  toolCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toolIcone: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  toolEmoji: { fontSize: 26 },
  toolBadgeNouveau: { backgroundColor: 'rgba(74,144,217,0.25)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(74,144,217,0.4)' },
  toolBadgeNouveauTexte: { color: '#4A90D9', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  toolTitre: { color: '#4A90D9', fontSize: 16, fontWeight: '800' },
  toolDescription: { color: '#A8C0DC', fontSize: 13, lineHeight: 20 },
  toolFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  toolTag: { backgroundColor: 'rgba(74,144,217,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  toolTagTexte: { color: '#4A90D9', fontSize: 11, fontWeight: '600' },
  toolFleche: { color: '#4A90D9', fontSize: 18, fontWeight: 'bold', marginLeft: 'auto' },
});
