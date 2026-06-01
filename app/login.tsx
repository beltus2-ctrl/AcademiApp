import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated,
  Dimensions,
  Easing, KeyboardAvoidingView,
  Platform, ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../firebaseConfig';

const { width, height } = Dimensions.get('window');
const PARTICULES = Array.from({ length: 20 }, (_, i) => i);
const GRILLE = Array.from({ length: 8 }, (_, i) => i);

export default function Login() {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);
  const [montrerMotDePasse, setMontrerMotDePasse] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [mdpFocus, setMdpFocus] = useState(false);
  const [musicActive, setMusicActive] = useState(true);
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(80)).current;
  const logoScaleAnim = useRef(new Animated.Value(0)).current;
  const logoOpacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const rotate2Anim = useRef(new Animated.Value(0)).current;
  const boutonAnim = useRef(new Animated.Value(1)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const sonRef = useRef<AudioPlayer | null>(null);

  const particulesAnim = useRef(PARTICULES.map(() => ({
    x: new Animated.Value(Math.random() * width),
    y: new Animated.Value(height + Math.random() * 200),
    opacity: new Animated.Value(0),
    scale: new Animated.Value(Math.random() * 0.6 + 0.2),
    rotate: new Animated.Value(0),
  }))).current;

  useEffect(() => {
    animerEntree();
    animerParticules();
    animerPulsation();
    animerRotations();
    animerScan();
    animerGlow();
    chargerMusique();
    return () => {
      sonRef.current?.pause();
      sonRef.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chargerMusique = async () => {
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
      const sound = createAudioPlayer(
        { uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
        { downloadFirst: true }
      );
      sound.loop = true;
      sound.volume = 0.15;
      sound.play();
      sonRef.current = sound;
    } catch {}
  };

  const toggleMusique = () => {
    const son = sonRef.current;
    if (!son) return;
    if (musicActive) {
      son.pause();
    } else {
      son.play();
    }
    setMusicActive(!musicActive);
  };

  const animerEntree = () => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScaleAnim, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }),
        Animated.timing(logoOpacityAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const animerParticules = () => {
    particulesAnim.forEach((p, i) => {
      const delai = i * 300;
      const duree = 4000 + Math.random() * 5000;
      setTimeout(() => {
        const boucle = () => {
          p.x.setValue(Math.random() * width);
          p.y.setValue(height + 20);
          p.opacity.setValue(0);
          Animated.parallel([
            Animated.timing(p.y, { toValue: -50, duration: duree, easing: Easing.linear, useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(p.opacity, { toValue: Math.random() * 0.7 + 0.3, duration: 500, useNativeDriver: true }),
              Animated.timing(p.opacity, { toValue: 0, duration: 500, delay: duree - 1000, useNativeDriver: true }),
            ]),
            Animated.loop(Animated.timing(p.rotate, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })),
          ]).start(() => boucle());
        };
        boucle();
      }, delai);
    });
  };

  const animerPulsation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  };

  const animerRotations = () => {
    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 15000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.timing(rotate2Anim, { toValue: 1, duration: 25000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  };

  const animerScan = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
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

  const animerBouton = () => {
    Animated.sequence([
      Animated.timing(boutonAnim, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(boutonAnim, { toValue: 1, tension: 300, friction: 5, useNativeDriver: true }),
    ]).start();
  };

  const seConnecter = async () => {
    if (!email || !motDePasse) {
      Alert.alert('⚠️ Champs manquants', 'Remplissez tous les champs pour continuer.');
      return;
    }
    animerBouton();
    setChargement(true);
    try {
      const resultat = await signInWithEmailAndPassword(auth, email, motDePasse);
      const docSnap = await getDoc(doc(db, 'utilisateurs', resultat.user.uid));
      if (docSnap.exists()) {
        const role = docSnap.data().role;
        sonRef.current?.pause();
        if (role === 'etudiant') router.replace('/dashboard/etudiant');
        else if (role === 'professeur') router.replace('/dashboard/professeur');
        else if (role === 'admin') router.replace('/dashboard/admin');
      }
    } catch {
      Alert.alert('🔐 Connexion echouee', 'Email ou mot de passe incorrect.');
    } finally {
      setChargement(false);
    }
  };

  const spin1 = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin2 = rotate2Anim.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const scanY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 200] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* Fond gradient ingénieur */}
      <LinearGradient
        colors={['#000814', '#001233', '#0A1628', '#001233', '#000814']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />

      {/* Grille hexagonale de fond */}
      <View style={styles.grilleContainer} pointerEvents="none">
        {GRILLE.map((row) => (
          <View key={row} style={styles.grilleRow}>
            {GRILLE.map((col) => (
              <View key={col} style={styles.grilleCellule} />
            ))}
          </View>
        ))}
      </View>

      {/* Cercles orbitaux */}
      <View style={styles.orbitContainer} pointerEvents="none">
        <Animated.View style={[styles.orbite1, { transform: [{ rotate: spin1 }] }]}>
          <View style={styles.orbiteDot} />
        </Animated.View>
        <Animated.View style={[styles.orbite2, { transform: [{ rotate: spin2 }] }]}>
          <View style={[styles.orbiteDot, { backgroundColor: '#4CAF50' }]} />
        </Animated.View>
        <Animated.View style={[styles.orbite3, { transform: [{ rotate: spin1 }] }]}>
          <View style={[styles.orbiteDot, { backgroundColor: '#FFC107' }]} />
        </Animated.View>
      </View>

      {/* Particules */}
      {particulesAnim.map((p, i) => {
        const couleurs = ['#4A90D9', '#4CAF50', '#FFC107', '#AB47BC', '#FF7043'];
        const formes = ['●', '◆', '▲', '★', '⬡'];
        return (
          <Animated.Text key={i} style={[styles.particule, {
            transform: [
              { translateX: p.x },
              { translateY: p.y },
              { scale: p.scale },
              { rotate: p.rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }
            ],
            opacity: p.opacity,
            color: couleurs[i % couleurs.length],
            fontSize: i % 3 === 0 ? 8 : i % 3 === 1 ? 10 : 6,
          }]}>{formes[i % formes.length]}</Animated.Text>
        );
      })}

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo section */}
        <Animated.View style={[styles.logoSection, {
          opacity: logoOpacityAnim,
          transform: [{ scale: logoScaleAnim }]
        }]}>
          {/* Halo brillant */}
          <Animated.View style={[styles.logoHalo, { opacity: glowOpacity }]} />

          <Animated.View style={[styles.logoWrapper, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={['#0D47A1', '#1565C0', '#1976D2', '#42A5F5']}
              style={styles.logoGradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              {/* Ligne de scan */}
              <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]} />
              <Text style={styles.logoEmoji}>🎓</Text>
            </LinearGradient>
          </Animated.View>

          <Text style={styles.logoTitre}>ACADEMI<Text style={styles.logoTitreAccent}>APP</Text></Text>
          <Text style={styles.logoVersion}>v2.0 • IUT Douala • Powered by AI</Text>

          <View style={styles.logoStatusBar}>
            <View style={styles.logoStatusItem}>
              <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.statusTexte}>IA Active</Text>
            </View>
            <View style={styles.logoStatusItem}>
              <View style={[styles.statusDot, { backgroundColor: '#4A90D9' }]} />
              <Text style={styles.statusTexte}>Serveur OK</Text>
            </View>
            <View style={styles.logoStatusItem}>
              <View style={[styles.statusDot, { backgroundColor: '#FFC107' }]} />
              <Text style={styles.statusTexte}>Securise</Text>
            </View>
          </View>
        </Animated.View>

        {/* Formulaire */}
        <Animated.View style={[styles.formContainer, {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }]}>

          {/* Barre de titre formulaire */}
          <View style={styles.formHeader}>
            <View style={styles.formHeaderDot} />
            <View style={[styles.formHeaderDot, { backgroundColor: '#FFC107' }]} />
            <View style={[styles.formHeaderDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.formHeaderTitre}>AUTHENTIFICATION_SECURISEE.exe</Text>
          </View>

          <View style={styles.formCorps}>
            <Text style={styles.formTitre}>Bon retour ! 👋</Text>
            <Text style={styles.formSous}>
              Connectez-vous pour reprendre votre parcours academique
            </Text>

            {/* Champ email */}
            <View style={styles.champSection}>
              <Text style={styles.champLabel}>[ EMAIL_IDENTIFIANT ]</Text>
              <View style={[styles.champWrapper, emailFocus && styles.champWrapperFocus]}>
                <LinearGradient
                  colors={emailFocus ? ['rgba(74,144,217,0.2)', 'transparent'] : ['transparent', 'transparent']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                />
                <Text style={styles.champIcone}>📧</Text>
                <TextInput
                  style={styles.champInput}
                  placeholder="user@academie.cm"
                  placeholderTextColor="#1E3A5F"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => setEmailFocus(true)}
                  onBlur={() => setEmailFocus(false)}
                />
                {email.includes('@') && (
                  <View style={styles.champValidBadge}>
                    <Text style={styles.champValidTexte}>✓ OK</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Champ mot de passe */}
            <View style={styles.champSection}>
              <Text style={styles.champLabel}>[ MOT_DE_PASSE_CRYPTE ]</Text>
              <View style={[styles.champWrapper, mdpFocus && styles.champWrapperFocus]}>
                <LinearGradient
                  colors={mdpFocus ? ['rgba(74,144,217,0.2)', 'transparent'] : ['transparent', 'transparent']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                />
                <Text style={styles.champIcone}>🔐</Text>
                <TextInput
                  style={styles.champInput}
                  placeholder="••••••••••••"
                  placeholderTextColor="#1E3A5F"
                  value={motDePasse}
                  onChangeText={setMotDePasse}
                  secureTextEntry={!montrerMotDePasse}
                  onFocus={() => setMdpFocus(true)}
                  onBlur={() => setMdpFocus(false)}
                />
                <TouchableOpacity onPress={() => setMontrerMotDePasse(!montrerMotDePasse)}>
                  <Text style={styles.champOeil}>{montrerMotDePasse ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Indicateurs de sécurité */}
            <View style={styles.securiteContainer}>
              <View style={styles.securiteItem}>
                <View style={[styles.securiteDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.securiteTexte}>Connexion SSL</Text>
              </View>
              <View style={styles.securiteItem}>
                <View style={[styles.securiteDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.securiteTexte}>Firebase Auth</Text>
              </View>
              <View style={styles.securiteItem}>
                <View style={[styles.securiteDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.securiteTexte}>Donnees chiffrees</Text>
              </View>
            </View>

            {/* Bouton connexion */}
            <Animated.View style={{ transform: [{ scale: boutonAnim }] }}>
              <TouchableOpacity onPress={seConnecter} disabled={chargement} activeOpacity={0.9}>
                <LinearGradient
                  colors={chargement
                    ? ['#0D2137', '#0D2137']
                    : ['#0D47A1', '#1565C0', '#1976D2', '#2196F3']}
                  style={styles.boutonGradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <View style={styles.boutonContenu}>
                    {chargement ? (
                      <>
                        <Text style={styles.boutonIcone}>⏳</Text>
                        <Text style={styles.boutonTexte}>AUTHENTIFICATION EN COURS...</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.boutonIcone}>🚀</Text>
                        <Text style={styles.boutonTexte}>{"LANCER L'APPLICATION"}</Text>
                      </>
                    )}
                  </View>
                  {/* Effet brillant */}
                  <Animated.View style={[styles.boutonBrillant, { opacity: glowOpacity }]} />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Séparateur tech */}
            <View style={styles.separateur}>
              <View style={styles.separateurLigne} />
              <View style={styles.separateurCentre}>
                <Text style={styles.separateurTexte}>◆ OR ◆</Text>
              </View>
              <View style={styles.separateurLigne} />
            </View>

            {/* Bouton inscription */}
            <TouchableOpacity
              style={styles.boutonSecondaire}
              onPress={() => router.replace('/inscription')}
              activeOpacity={0.8}
            >
              <Text style={styles.boutonSecondaireTexte}>
                ✨ CREER UN NOUVEAU COMPTE
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer formulaire */}
          <View style={styles.formFooter}>
            <Text style={styles.formFooterTexte}>
              🔒 Vos donnees sont protegees • AcademiApp © 2026
            </Text>
          </View>
        </Animated.View>

        {/* Stats système */}
        <Animated.View style={[styles.sysStats, { opacity: fadeAnim }]}>
          {[
            { label: 'MODULES', valeur: '7', icone: '📦' },
            { label: 'IA ENGINE', valeur: 'ON', icone: '🤖' },
            { label: 'UPTIME', valeur: '99%', icone: '⚡' },
          ].map((stat, i) => (
            <View key={i} style={styles.sysStat}>
              <Text style={styles.sysStatIcone}>{stat.icone}</Text>
              <Text style={styles.sysStatValeur}>{stat.valeur}</Text>
              <Text style={styles.sysStatLabel}>{stat.label}</Text>
            </View>
          ))}
        </Animated.View>

      </ScrollView>
      {/* Bouton musique flottant */}
<TouchableOpacity
  style={styles.boutonMusique}
  onPress={toggleMusique}
  activeOpacity={0.8}
>
  <Text style={styles.boutonMusiqueTexte}>
    {musicActive ? '🔊' : '🔇'}
  </Text>
</TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  boutonMusique: {
  position: 'absolute',
  top: 50,
  right: 24,
  width: 42,
  height: 42,
  borderRadius: 21,
  backgroundColor: 'rgba(255,255,255,0.08)',
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.15)',
  zIndex: 100,
},
boutonMusiqueTexte: { fontSize: 20 },
  container: { flex: 1, backgroundColor: '#000814' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 40, justifyContent: 'center' },
  grilleContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04 },
  grilleRow: { flexDirection: 'row', flex: 1 },
  grilleCellule: { flex: 1, borderWidth: 0.5, borderColor: '#4A90D9' },
  orbitContainer: { position: 'absolute', top: '20%', left: '50%', marginLeft: -150 },
  orbite1: { width: 300, height: 300, borderRadius: 150, borderWidth: 1, borderColor: 'rgba(74,144,217,0.15)', position: 'absolute', top: -150, left: -150 },
  orbite2: { width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: 'rgba(76,175,80,0.12)', position: 'absolute', top: -110, left: -110 },
  orbite3: { width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: 'rgba(255,193,7,0.1)', position: 'absolute', top: -80, left: -80 },
  orbiteDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4A90D9', position: 'absolute', top: -4, left: '50%', marginLeft: -4 },
  particule: { position: 'absolute' },
  logoSection: { alignItems: 'center', marginBottom: 32, gap: 10 },
  logoHalo: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#1565C0', top: -35 },
  logoWrapper: { width: 90, height: 90, borderRadius: 22, overflow: 'hidden', shadowColor: '#2196F3', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 30, elevation: 20 },
  logoGradient: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: 'rgba(100,200,255,0.8)', shadowColor: '#64C8FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 6 },
  logoEmoji: { fontSize: 44, zIndex: 2 },
  logoTitre: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: 3, textTransform: 'uppercase' },
  logoTitreAccent: { color: '#42A5F5' },
  logoVersion: { fontSize: 11, color: '#1E3A5F', letterSpacing: 1.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  logoStatusBar: { flexDirection: 'row', gap: 16, marginTop: 4 },
  logoStatusItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTexte: { color: '#4A6080', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  formContainer: { backgroundColor: 'rgba(5,15,35,0.95)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', overflow: 'hidden', shadowColor: '#1565C0', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 15 },
  formHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(13,71,161,0.3)', paddingHorizontal: 16, paddingVertical: 10, gap: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(74,144,217,0.2)' },
  formHeaderDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF5252' },
  formHeaderTitre: { color: '#1E3A5F', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginLeft: 4 },
  formCorps: { padding: 24, gap: 16 },
  formTitre: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  formSous: { fontSize: 13, color: '#4A6080', textAlign: 'center' },
  champSection: { gap: 6 },
  champLabel: { color: '#1E4A7F', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 1 },
  champWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(10,25,60,0.8)', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(74,144,217,0.2)', overflow: 'hidden', gap: 10 },
  champWrapperFocus: { borderColor: '#4A90D9', borderWidth: 1.5 },
  champIcone: { fontSize: 18 },
  champInput: { flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 14, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  champValidBadge: { backgroundColor: 'rgba(76,175,80,0.2)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#4CAF5055' },
  champValidTexte: { color: '#4CAF50', fontSize: 10, fontWeight: '700' },
  champOeil: { fontSize: 18, padding: 4 },
  securiteContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(0,255,0,0.03)', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: 'rgba(76,175,80,0.1)' },
  securiteItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  securiteDot: { width: 5, height: 5, borderRadius: 3 },
  securiteTexte: { color: '#1A4A2E', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  boutonGradient: { borderRadius: 12, overflow: 'hidden' },
  boutonContenu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 20, gap: 10 },
  boutonIcone: { fontSize: 20 },
  boutonTexte: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, letterSpacing: 1.5 },
  boutonFleche: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginLeft: 4 },
  boutonBrillant: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  separateur: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  separateurLigne: { flex: 1, height: 1, backgroundColor: 'rgba(74,144,217,0.15)' },
  separateurCentre: { paddingHorizontal: 8 },
  separateurTexte: { color: '#1E3A5F', fontSize: 11, letterSpacing: 2 },
  boutonSecondaire: { borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(74,144,217,0.35)', backgroundColor: 'rgba(74,144,217,0.06)' },
  boutonSecondaireTexte: { color: '#4A90D9', fontWeight: '700', fontSize: 13, letterSpacing: 1 },
  formFooter: { backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 24, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(74,144,217,0.1)' },
  formFooterTexte: { color: '#1E3A5F', fontSize: 10, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  sysStats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 24, backgroundColor: 'rgba(5,15,35,0.8)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(74,144,217,0.15)' },
  sysStat: { alignItems: 'center', gap: 4 },
  sysStatIcone: { fontSize: 20 },
  sysStatValeur: { color: '#4A90D9', fontSize: 16, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  sysStatLabel: { color: '#1E3A5F', fontSize: 9, letterSpacing: 1.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});
