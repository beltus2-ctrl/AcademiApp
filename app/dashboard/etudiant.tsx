import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

type CarteDashboard = {
  icone: string;
  label: string;
  route: string;
  code: string;
  description: string;
  accent: string;
};

type ParticuleAnim = {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  rotate: Animated.Value;
};

const { width, height } = Dimensions.get('window');
const PARTICULES = Array.from({ length: 20 }, (_, i) => i);
const GRILLE = Array.from({ length: 8 }, (_, i) => i);
const FORMES_PARTICULES = ['●', '◆', '▲', '★', '⬡'];
const COULEURS_PARTICULES = ['#4A90D9', '#4CAF50', '#FFC107', '#AB47BC', '#FF7043'];
const HAUTEUR_CARTE = Math.max(168, Math.min(210, Math.round(height * 0.2)));
const cartes: CarteDashboard[] = [
  { 
    icone: '🤖', 
    label: 'AcademiAI', 
    route: '/ia', 
    code: 'TUTOR_AI',
    description: 'Tuteur IA, analyse de progression et badges', 
    accent: '#350ad1', 
  },
  {
    icone: '📸',
    label: 'Cours',
    route: '/cours',
    code: 'COURSE_CORE',
    description: 'Capturer, ameliorer et reviser',
    accent: '#4A90D9',
  },
  {
    icone: '🧠',
    label: 'Quiz',
    route: '/quiz',
    code: 'QUIZ_ENGINE',
    description: 'Questions IA et score instantane',
    accent: '#AB47BC',
  },
  {
    icone: '📝',
    label: 'Exercices',
    route: '/exercices',
    code: 'PRACTICE_LAB',
    description: 'Entrainement progressif par niveau',
    accent: '#FF7043',
  },
  {
    icone: '💬',
    label: 'Chat',
    route: '/chat',
    code: 'COMMS_HUB',
    description: 'Messages, communaute et AcademiAI',
    accent: '#4CAF50',
  },
  {
    icone: '📅',
    label: 'Planning',
    route: '/planning',
    code: 'SCHEDULE_AI',
    description: 'Emploi du temps optimise',
    accent: '#FFC107',
  },
  {
    icone: '📞',
    label: 'Appel Prof',
    route: '/chat/professeur',
    code: 'PROF_SIGNAL',
    description: 'Assistance prof ou relais IA',
    accent: '#4A90D9',
  },
  {
    icone: '🏁',
    label: 'Corrections',
    route: '/corrections',
    code: 'CORRECTIONS',
    description: 'Rejoignez le salon de corrections de votre professeur',
    accent: '#4f36a9',
  },
];

export default function TableauEtudiant() {
  const router = useRouter();
  const [nom, setNom] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(70)).current;
  const logoScaleAnim = useRef(new Animated.Value(0)).current;
  const logoOpacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const rotate2Anim = useRef(new Animated.Value(0)).current;
  const rotate3Anim = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const telemetryAnim = useRef(new Animated.Value(0)).current;
  const cardScales = useRef(cartes.map(() => new Animated.Value(1))).current;
  const animationsRef = useRef<Animated.CompositeAnimation[]>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const actifRef = useRef(true);

  const particulesAnim = useRef<ParticuleAnim[]>(
    PARTICULES.map(() => ({
      x: new Animated.Value(Math.random() * width),
      y: new Animated.Value(height + Math.random() * 180),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(Math.random() * 0.7 + 0.25),
      rotate: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    const recupererNom = async () => {
      const utilisateur = auth.currentUser;
      if (!utilisateur) return;

      try {
        const docSnap = await getDoc(doc(db, 'utilisateurs', utilisateur.uid));
        if (docSnap.exists()) {
          setNom(docSnap.data().nom);
        }
      } catch {}
    };

    recupererNom();
  }, []);

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    const animations = animationsRef.current;
    actifRef.current = true;
    animerEntree();
    animerParticules();
    animerPulsation();
    animerRotations();
    animerScan();
    animerGlow();
    animerTelemetrie();

    return () => {
      actifRef.current = false;
      timeouts.forEach(clearTimeout);
      animations.forEach(animation => animation.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enregistrerAnimation = (animation: Animated.CompositeAnimation) => {
    animationsRef.current.push(animation);
    animation.start();
  };

  const animerEntree = () => {
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScaleAnim, { toValue: 1, tension: 48, friction: 6, useNativeDriver: true }),
        Animated.timing(logoOpacityAnim, { toValue: 1, duration: 760, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 48, friction: 8, useNativeDriver: true }),
      ]),
    ]);
    enregistrerAnimation(animation);
  };

  const animerParticules = () => {
    particulesAnim.forEach((particule, index) => {
      const lancer = () => {
        if (!actifRef.current) return;

        const duree = 4200 + Math.random() * 5000;
        particule.x.setValue(Math.random() * width);
        particule.y.setValue(height + 40);
        particule.opacity.setValue(0);
        particule.rotate.setValue(0);
        particule.scale.setValue(Math.random() * 0.7 + 0.25);

        const animation = Animated.parallel([
          Animated.timing(particule.y, { toValue: -70, duration: duree, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(particule.rotate, { toValue: 1, duration: duree, easing: Easing.linear, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(particule.opacity, { toValue: Math.random() * 0.65 + 0.25, duration: 520, useNativeDriver: true }),
            Animated.timing(particule.opacity, { toValue: 0, duration: 660, delay: Math.max(duree - 1200, 0), useNativeDriver: true }),
          ]),
        ]);

        animationsRef.current.push(animation);
        animation.start(() => lancer());
      };

      const timeout = setTimeout(lancer, index * 210);
      timeoutsRef.current.push(timeout);
    });
  };

  const animerPulsation = () => {
    enregistrerAnimation(
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.07, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      )
    );
  };

  const animerRotations = () => {
    enregistrerAnimation(Animated.loop(Animated.timing(rotateAnim, { toValue: 1, duration: 15000, easing: Easing.linear, useNativeDriver: true })));
    enregistrerAnimation(Animated.loop(Animated.timing(rotate2Anim, { toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: true })));
    enregistrerAnimation(Animated.loop(Animated.timing(rotate3Anim, { toValue: 1, duration: 33000, easing: Easing.linear, useNativeDriver: true })));
  };

  const animerScan = () => {
    enregistrerAnimation(
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 1, duration: 2100, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(scanAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
  };

  const animerGlow = () => {
    enregistrerAnimation(
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      )
    );
  };

  const animerTelemetrie = () => {
    enregistrerAnimation(
      Animated.loop(
        Animated.sequence([
          Animated.timing(telemetryAnim, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(telemetryAnim, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      )
    );
  };

  const ouvrirCarte = (carte: CarteDashboard, index: number) => {
    Animated.sequence([
      Animated.timing(cardScales[index], { toValue: 0.96, duration: 70, useNativeDriver: true }),
      Animated.spring(cardScales[index], { toValue: 1, tension: 260, friction: 6, useNativeDriver: true }),
    ]).start(() => router.push(carte.route as any));
  };

  const seDeconnecter = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch {
      Alert.alert('Erreur', 'Impossible de se deconnecter');
    }
  };

  const spin1 = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin2 = rotate2Anim.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const spin3 = rotate3Anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const scanY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 230] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.26, 0.8] });
  const telemetryX = telemetryAnim.interpolate({ inputRange: [0, 1], outputRange: [-130, 280] });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000814', '#001233', '#0A1628', '#001233', '#000814']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.grilleContainer} pointerEvents="none">
        {GRILLE.map(row => (
          <View key={row} style={styles.grilleRow}>
            {GRILLE.map(col => (
              <View key={col} style={styles.grilleCellule} />
            ))}
          </View>
        ))}
      </View>

      <View style={styles.orbitContainer} pointerEvents="none">
        <Animated.View style={[styles.orbite1, { transform: [{ rotate: spin1 }] }]}>
          <View style={styles.orbiteDot} />
        </Animated.View>
        <Animated.View style={[styles.orbite2, { transform: [{ rotate: spin2 }] }]}>
          <View style={[styles.orbiteDot, { backgroundColor: '#4CAF50' }]} />
        </Animated.View>
        <Animated.View style={[styles.orbite3, { transform: [{ rotate: spin3 }] }]}>
          <View style={[styles.orbiteDot, { backgroundColor: '#FFC107' }]} />
        </Animated.View>
      </View>

      <View style={styles.traceContainer} pointerEvents="none">
        <View style={styles.traceLigne} />
        <View style={[styles.traceLigne, styles.traceLigneCourte]} />
        <View style={[styles.traceLigne, styles.traceLigneViolette]} />
      </View>

      {particulesAnim.map((particule, index) => (
        <Animated.Text
          key={index}
          style={[
            styles.particule,
            {
              transform: [
                { translateX: particule.x },
                { translateY: particule.y },
                { scale: particule.scale },
                { rotate: particule.rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
              ],
              opacity: particule.opacity,
              color: COULEURS_PARTICULES[index % COULEURS_PARTICULES.length],
              fontSize: index % 3 === 0 ? 9 : index % 3 === 1 ? 11 : 7,
            },
          ]}
        >
          {FORMES_PARTICULES[index % FORMES_PARTICULES.length]}
        </Animated.Text>
      ))}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.hero,
            {
              opacity: logoOpacityAnim,
              transform: [{ scale: logoScaleAnim }],
            },
          ]}
        >
          <Animated.View style={[styles.logoHalo, { opacity: glowOpacity }]} />
          <Animated.View style={[styles.logoWrapper, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={['#0D47A1', '#1565C0', '#1976D2', '#42A5F5']}
              style={styles.logoGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]} />
              <Text style={styles.logoEmoji}>🎛️</Text>
            </LinearGradient>
          </Animated.View>

          <Text style={styles.titre}>MISSION_CONTROL</Text>
          <Text style={styles.sousTitre}>Bienvenue {nom || 'Etudiant'} • IUT Douala</Text>

          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.statusTexte}>SESSION ACTIVE</Text>
            </View>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: '#FFC107' }]} />
              <Text style={styles.statusTexte}>6 MODULES</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.panelHeader}>
            <View style={styles.panelDot} />
            <View style={[styles.panelDot, { backgroundColor: '#FFC107' }]} />
            <View style={[styles.panelDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.panelHeaderTitre}>ACADEMIAPP_STUDENT_HUB.exe</Text>
          </View>

          <View style={styles.panelBody}>
            <View style={styles.telemetryRail}>
              <Animated.View style={[styles.telemetrySpark, { transform: [{ translateX: telemetryX }] }]} />
            </View>

            <View style={styles.grilleCartes}>
              {cartes.map((carte, index) => (
                <Animated.View
                  key={carte.code}
                  style={[styles.carteAnimated, { transform: [{ scale: cardScales[index] }] }]}
                >
                  <TouchableOpacity activeOpacity={0.86} onPress={() => ouvrirCarte(carte, index)}>
                    <LinearGradient
                      colors={[carte.accent + '38', 'rgba(255,255,255,0.045)', 'rgba(10,25,60,0.76)']}
                      style={[styles.carte, { borderColor: carte.accent + '66' }]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <View style={styles.carteTop}>
                        <View style={[styles.carteIconeBox, { borderColor: carte.accent + '88' }]}>
                          <Text style={styles.icone}>{carte.icone}</Text>
                        </View>
                        <Text style={[styles.carteCode, { color: carte.accent }]}>{carte.code}</Text>
                      </View>
                      <Text style={styles.texteCarte}>{carte.label}</Text>
                      <Text style={styles.descriptionCarte}>{carte.description}</Text>
                      <View style={styles.carteFooter}>
                        <View style={[styles.carteSignal, { backgroundColor: carte.accent }]} />
                        <Text style={styles.carteAction}>OPEN MODULE</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>

            <View style={styles.securiteContainer}>
              <View style={styles.securiteItem}>
                <View style={[styles.securiteDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.securiteTexte}>SSL</Text>
              </View>
              <View style={styles.securiteItem}>
                <View style={[styles.securiteDot, { backgroundColor: '#4A90D9' }]} />
                <Text style={styles.securiteTexte}>FIREBASE AUTH</Text>
              </View>
              <View style={styles.securiteItem}>
                <View style={[styles.securiteDot, { backgroundColor: '#FFC107' }]} />
                <Text style={styles.securiteTexte}>SYNC OK</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.boutonDeconnexion} onPress={seDeconnecter} activeOpacity={0.82}>
              <Text style={styles.texteDeconnexion}>TERMINER LA SESSION</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.panelFooter}>
            <Text style={styles.panelFooterTexte}>🔒 AcademiApp © 2026 • Tableau de bord etudiant • IUT Douala</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.sysStats, { opacity: fadeAnim }]}>
          {[
            { label: 'MODULES', valeur: '6', icone: '📦' },
            { label: 'IA CORE', valeur: 'ON', icone: '🤖' },
            { label: 'ROLE', valeur: 'STD', icone: '🎓' },
          ].map(stat => (
            <View key={stat.label} style={styles.sysStat}>
              <Text style={styles.sysStatIcone}>{stat.icone}</Text>
              <Text style={styles.sysStatValeur}>{stat.valeur}</Text>
              <Text style={styles.sysStatLabel}>{stat.label}</Text>
            </View>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000814' },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 42, paddingBottom: 34 },
  grilleContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04 },
  grilleRow: { flexDirection: 'row', flex: 1 },
  grilleCellule: { flex: 1, borderWidth: 0.5, borderColor: '#4A90D9' },
  orbitContainer: { position: 'absolute', top: '17%', left: '50%', marginLeft: -175 },
  orbite1: { width: 350, height: 350, borderRadius: 175, borderWidth: 1, borderColor: 'rgba(74,144,217,0.17)', position: 'absolute', top: -175, left: -175 },
  orbite2: { width: 260, height: 260, borderRadius: 130, borderWidth: 1, borderColor: 'rgba(76,175,80,0.14)', position: 'absolute', top: -130, left: -130 },
  orbite3: { width: 178, height: 178, borderRadius: 89, borderWidth: 1, borderColor: 'rgba(255,193,7,0.13)', position: 'absolute', top: -89, left: -89 },
  orbiteDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#4A90D9', position: 'absolute', top: -5, left: '50%', marginLeft: -5 },
  traceContainer: { position: 'absolute', top: 96, right: 18, gap: 12, opacity: 0.34 },
  traceLigne: { width: 124, height: 1, backgroundColor: '#4A90D9' },
  traceLigneCourte: { width: 72, backgroundColor: '#4CAF50', marginLeft: 42 },
  traceLigneViolette: { width: 98, backgroundColor: '#AB47BC', marginLeft: 18 },
  particule: { position: 'absolute', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  hero: { alignItems: 'center', marginBottom: 22, gap: 10 },
  logoHalo: { position: 'absolute', width: 174, height: 174, borderRadius: 87, backgroundColor: '#1565C0', top: -38 },
  logoWrapper: { width: 96, height: 96, borderRadius: 24, overflow: 'hidden', shadowColor: '#2196F3', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 32, elevation: 20 },
  logoGradient: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: 'rgba(120,210,255,0.85)', shadowColor: '#64C8FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8 },
  logoEmoji: { fontSize: 46, zIndex: 2 },
  titre: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2.4, textTransform: 'uppercase', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  sousTitre: { fontSize: 12, color: '#8BA4C4', textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  statusRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(74,144,217,0.08)', borderWidth: 1, borderColor: 'rgba(74,144,217,0.18)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTexte: { color: '#8BA4C4', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  panel: { flexGrow: 1, backgroundColor: 'rgba(5,15,35,0.96)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', overflow: 'hidden', shadowColor: '#1565C0', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 22, elevation: 16 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(13,71,161,0.3)', paddingHorizontal: 16, paddingVertical: 10, gap: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(74,144,217,0.2)' },
  panelDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF5252' },
  panelHeaderTitre: { color: '#4A6080', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginLeft: 4 },
  panelBody: { flexGrow: 1, padding: 16, gap: 14 },
  telemetryRail: { height: 3, backgroundColor: 'rgba(74,144,217,0.12)', borderRadius: 999, overflow: 'hidden' },
  telemetrySpark: { width: 130, height: 3, backgroundColor: '#4A90D9', borderRadius: 999 },
  grilleCartes: { flexGrow: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: 12 },
  carteAnimated: { width: '48%', flexGrow: 1 },
  carte: { minHeight: HAUTEUR_CARTE, borderRadius: 15, padding: 13, borderWidth: 1, overflow: 'hidden', gap: 8 },
  carteTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  carteIconeBox: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: 'rgba(0,8,20,0.42)' },
  icone: { fontSize: 24 },
  carteCode: { flex: 1, textAlign: 'right', fontSize: 8, fontWeight: '900', letterSpacing: 0.7, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  texteCarte: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  descriptionCarte: { color: '#8BA4C4', fontSize: 10, lineHeight: 15, minHeight: 31 },
  carteFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 'auto' },
  carteSignal: { width: 6, height: 6, borderRadius: 3 },
  carteAction: { color: '#4A6080', fontSize: 8, letterSpacing: 0.9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  securiteContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(0,255,0,0.03)', borderRadius: 9, padding: 10, borderWidth: 1, borderColor: 'rgba(76,175,80,0.1)' },
  securiteItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  securiteDot: { width: 5, height: 5, borderRadius: 3 },
  securiteTexte: { color: '#2A6A44', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  boutonDeconnexion: { borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,82,82,0.4)', backgroundColor: 'rgba(255,82,82,0.07)' },
  texteDeconnexion: { color: '#FF6B6B', fontWeight: '900', fontSize: 12, letterSpacing: 1.2 },
  panelFooter: { backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(74,144,217,0.1)' },
  panelFooterTexte: { color: '#1E3A5F', fontSize: 10, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  sysStats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, backgroundColor: 'rgba(5,15,35,0.82)', borderRadius: 14, padding: 15, borderWidth: 1, borderColor: 'rgba(74,144,217,0.15)' },
  sysStat: { alignItems: 'center', gap: 4 },
  sysStatIcone: { fontSize: 19 },
  sysStatValeur: { color: '#4A90D9', fontSize: 16, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  sysStatLabel: { color: '#1E3A5F', fontSize: 9, letterSpacing: 1.3, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});
