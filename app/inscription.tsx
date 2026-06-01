import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from '../firebaseConfig';

type RoleUtilisateur = 'etudiant' | 'professeur';

type ParticuleAnim = {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  rotate: Animated.Value;
};

type RoleOption = {
  id: RoleUtilisateur;
  titre: string;
  sousTitre: string;
  icone: string;
  accent: string;
};

const { width, height } = Dimensions.get('window');
const PARTICULES = Array.from({ length: 20 }, (_, i) => i);
const GRILLE = Array.from({ length: 8 }, (_, i) => i);
const FORMES_PARTICULES = ['●', '◆', '▲', '★', '⬡'];
const COULEURS_PARTICULES = ['#4A90D9', '#4CAF50', '#FFC107', '#AB47BC', '#FF7043'];
const URL_MUSIQUE = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

const ROLES: RoleOption[] = [
  {
    id: 'etudiant',
    titre: 'ETUDIANT',
    sousTitre: 'Acces cours, quiz et revisions IA',
    icone: '📚',
    accent: '#4A90D9',
  },
  {
    id: 'professeur',
    titre: 'PROFESSEUR',
    sousTitre: 'Accompagnement et suivi academique',
    icone: '🎓',
    accent: '#FFC107',
  },
];

const getCodeErreur = (erreur: unknown): string => {
  if (erreur && typeof erreur === 'object' && 'code' in erreur) {
    return String((erreur as { code?: unknown }).code);
  }

  return '';
};

const getMessageErreurInscription = (erreur: unknown): string => {
  const code = getCodeErreur(erreur);

  if (code === 'auth/email-already-in-use') {
    return 'Cet email possede deja un compte. Connectez-vous directement.';
  }

  if (code === 'auth/invalid-email') {
    return 'Email invalide. Verifiez l adresse saisie.';
  }

  if (code === 'auth/weak-password') {
    return 'Le mot de passe doit contenir au moins 6 caracteres.';
  }

  if (code === 'auth/network-request-failed' || code === 'unavailable') {
    return 'Connexion internet impossible. Verifiez votre reseau puis reessayez.';
  }

  if (code === 'permission-denied') {
    return 'Compte cree, mais le profil utilisateur est bloque par Firestore.';
  }

  return 'Inscription impossible. Reessayez dans quelques secondes.';
};

export default function Inscription() {
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [role, setRole] = useState<RoleUtilisateur>('etudiant');
  const [chargement, setChargement] = useState(false);
  const [montrerMotDePasse, setMontrerMotDePasse] = useState(false);
  const [nomFocus, setNomFocus] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [mdpFocus, setMdpFocus] = useState(false);
  const [musicActive, setMusicActive] = useState(true);
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(90)).current;
  const logoScaleAnim = useRef(new Animated.Value(0)).current;
  const logoOpacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const rotate2Anim = useRef(new Animated.Value(0)).current;
  const rotate3Anim = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const boutonAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const sonRef = useRef<AudioPlayer | null>(null);
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
    const timeouts = timeoutsRef.current;
    const animations = animationsRef.current;
    actifRef.current = true;
    animerEntree();
    animerParticules();
    animerPulsation();
    animerRotations();
    animerScan();
    animerGlow();
    animerProgression();
    chargerMusique();

    return () => {
      actifRef.current = false;
      timeouts.forEach(clearTimeout);
      animations.forEach(animation => animation.stop());
      sonRef.current?.pause();
      sonRef.current?.remove();
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
        Animated.timing(logoOpacityAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
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

        const duree = 4500 + Math.random() * 4800;
        particule.x.setValue(Math.random() * width);
        particule.y.setValue(height + 40);
        particule.opacity.setValue(0);
        particule.rotate.setValue(0);
        particule.scale.setValue(Math.random() * 0.7 + 0.25);

        const animation = Animated.parallel([
          Animated.timing(particule.y, { toValue: -70, duration: duree, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(particule.rotate, { toValue: 1, duration: duree, easing: Easing.linear, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(particule.opacity, { toValue: Math.random() * 0.7 + 0.25, duration: 550, useNativeDriver: true }),
            Animated.timing(particule.opacity, { toValue: 0, duration: 650, delay: Math.max(duree - 1200, 0), useNativeDriver: true }),
          ]),
        ]);

        animationsRef.current.push(animation);
        animation.start(() => lancer());
      };

      const timeout = setTimeout(lancer, index * 220);
      timeoutsRef.current.push(timeout);
    });
  };

  const animerPulsation = () => {
    enregistrerAnimation(
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      )
    );
  };

  const animerRotations = () => {
    enregistrerAnimation(Animated.loop(Animated.timing(rotateAnim, { toValue: 1, duration: 15000, easing: Easing.linear, useNativeDriver: true })));
    enregistrerAnimation(Animated.loop(Animated.timing(rotate2Anim, { toValue: 1, duration: 23000, easing: Easing.linear, useNativeDriver: true })));
    enregistrerAnimation(Animated.loop(Animated.timing(rotate3Anim, { toValue: 1, duration: 31000, easing: Easing.linear, useNativeDriver: true })));
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

  const animerProgression = () => {
    enregistrerAnimation(
      Animated.loop(
        Animated.sequence([
          Animated.timing(progressAnim, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(progressAnim, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      )
    );
  };

  const chargerMusique = async () => {
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
      const sound = createAudioPlayer({ uri: URL_MUSIQUE }, { downloadFirst: true });
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

  const animerBouton = () => {
    const animation = Animated.sequence([
      Animated.timing(boutonAnim, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.spring(boutonAnim, { toValue: 1, tension: 300, friction: 5, useNativeDriver: true }),
    ]);
    animation.start();
  };

  const sInscrire = async () => {
    const nomNettoye = nom.trim();
    const emailNettoye = email.trim().toLowerCase();

    if (!nomNettoye || !emailNettoye || !motDePasse) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    if (motDePasse.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caracteres');
      return;
    }
    animerBouton();
    setChargement(true);
    try {
      const resultat = await createUserWithEmailAndPassword(auth, emailNettoye, motDePasse);
      await setDoc(doc(db, 'utilisateurs', resultat.user.uid), {
        nom: nomNettoye,
        email: emailNettoye,
        role: role,
        dateInscription: new Date().toISOString(),
        requetesRestantes: 20,
        derniereReinitialisation: new Date().toDateString(),
      });
      sonRef.current?.pause();
      Alert.alert('Succes', 'Compte cree avec succes !');
      router.replace('/login');
    } catch (erreur) {
      console.log('Erreur inscription:', erreur);
      Alert.alert('Erreur', getMessageErreurInscription(erreur));
    } finally {
      setChargement(false);
    }
  };

  const spin1 = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin2 = rotate2Anim.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const spin3 = rotate3Anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const scanY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 230] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.82] });
  const progressX = progressAnim.interpolate({ inputRange: [0, 1], outputRange: [-120, 260] });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.logoSection,
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
              <Text style={styles.logoEmoji}>🧬</Text>
            </LinearGradient>
          </Animated.View>

          <Text style={styles.logoTitre}>
            CREATE<Text style={styles.logoTitreAccent}>_PROFILE</Text>
          </Text>
          <Text style={styles.logoVersion}>IUT DOUALA • SECURE ENROLLMENT NODE • AI READY</Text>

          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.badgeTexte}>AUTH ONLINE</Text>
            </View>
            <View style={styles.badge}>
              <View style={[styles.statusDot, { backgroundColor: '#FFC107' }]} />
              <Text style={styles.badgeTexte}>PROFILE SEED</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.formContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.formHeader}>
            <View style={styles.formHeaderDot} />
            <View style={[styles.formHeaderDot, { backgroundColor: '#FFC107' }]} />
            <View style={[styles.formHeaderDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.formHeaderTitre}>STUDENT_REGISTRY_BOOT.exe</Text>
          </View>

          <View style={styles.formCorps}>
            <View style={styles.formTitleRow}>
              <View>
                <Text style={styles.formTitre}>Nouveau profil</Text>
                <Text style={styles.formSous}>Provisionnement academique securise</Text>
              </View>
              <View style={styles.signalBadge}>
                <Text style={styles.signalBadgeTexte}>LIVE</Text>
              </View>
            </View>

            <View style={styles.progressRail}>
              <Animated.View style={[styles.progressSpark, { transform: [{ translateX: progressX }] }]} />
            </View>

            <View style={styles.champSection}>
              <Text style={styles.champLabel}>[ NOM_COMPLET ]</Text>
              <LinearGradient
                colors={nomFocus ? ['rgba(74,144,217,0.55)', 'rgba(171,71,188,0.3)'] : ['rgba(74,144,217,0.18)', 'rgba(255,255,255,0.06)']}
                style={styles.champGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.champWrapper}>
                  <Text style={styles.champIcone}>👤</Text>
                  <TextInput
                    style={styles.champInput}
                    placeholder="ex: Ali Nono"
                    placeholderTextColor="#1E3A5F"
                    value={nom}
                    onChangeText={setNom}
                    onFocus={() => setNomFocus(true)}
                    onBlur={() => setNomFocus(false)}
                  />
                  {nom.trim().length > 2 && <Text style={styles.champOk}>OK</Text>}
                </View>
              </LinearGradient>
            </View>

            <View style={styles.champSection}>
              <Text style={styles.champLabel}>[ EMAIL_IDENTIFIANT ]</Text>
              <LinearGradient
                colors={emailFocus ? ['rgba(74,144,217,0.55)', 'rgba(76,175,80,0.28)'] : ['rgba(74,144,217,0.18)', 'rgba(255,255,255,0.06)']}
                style={styles.champGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.champWrapper}>
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
                  {email.includes('@') && <Text style={styles.champOk}>OK</Text>}
                </View>
              </LinearGradient>
            </View>

            <View style={styles.champSection}>
              <Text style={styles.champLabel}>[ MOT_DE_PASSE_CRYPTE ]</Text>
              <LinearGradient
                colors={mdpFocus ? ['rgba(74,144,217,0.55)', 'rgba(255,112,67,0.26)'] : ['rgba(74,144,217,0.18)', 'rgba(255,255,255,0.06)']}
                style={styles.champGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.champWrapper}>
                  <Text style={styles.champIcone}>🔐</Text>
                  <TextInput
                    style={styles.champInput}
                    placeholder="minimum 6 caracteres"
                    placeholderTextColor="#1E3A5F"
                    value={motDePasse}
                    onChangeText={setMotDePasse}
                    secureTextEntry={!montrerMotDePasse}
                    onFocus={() => setMdpFocus(true)}
                    onBlur={() => setMdpFocus(false)}
                  />
                  <TouchableOpacity onPress={() => setMontrerMotDePasse(!montrerMotDePasse)} activeOpacity={0.7}>
                    <Text style={styles.champOeil}>{montrerMotDePasse ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>

            <View style={styles.roleSection}>
              <Text style={styles.champLabel}>[ ROLE_ACADEMIQUE ]</Text>
              <View style={styles.rolesContainer}>
                {ROLES.map(option => {
                  const actif = role === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.roleBtn, actif && { borderColor: option.accent }]}
                      onPress={() => setRole(option.id)}
                      activeOpacity={0.82}
                    >
                      <LinearGradient
                        colors={actif ? [option.accent + '55', 'rgba(74,144,217,0.14)'] : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                        style={styles.roleGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Text style={styles.roleIcone}>{option.icone}</Text>
                        <Text style={[styles.roleTitre, actif && { color: option.accent }]}>{option.titre}</Text>
                        <Text style={styles.roleSousTitre}>{option.sousTitre}</Text>
                        <View style={[styles.roleCheck, actif && { backgroundColor: option.accent }]}>
                          <Text style={styles.roleCheckTexte}>{actif ? '✓' : ''}</Text>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
                <Text style={styles.securiteTexte}>SECURISE</Text>
              </View>
            </View>

            <Animated.View style={{ transform: [{ scale: boutonAnim }] }}>
              <TouchableOpacity onPress={sInscrire} disabled={chargement} activeOpacity={0.9}>
                <LinearGradient
                  colors={chargement ? ['#0D2137', '#0D2137'] : ['#0D47A1', '#1565C0', '#1976D2', '#2196F3']}
                  style={styles.boutonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <View style={styles.boutonContenu}>
                    <Text style={styles.boutonIcone}>{chargement ? '⏳' : '🚀'}</Text>
                    <Text style={styles.boutonTexte}>
                      {chargement ? 'CREATION DU PROFIL...' : 'INITIALISER LE COMPTE'}
                    </Text>
                    {!chargement && <Text style={styles.boutonFleche}></Text>}
                  </View>
                  <Animated.View style={[styles.boutonBrillant, { opacity: glowOpacity }]} />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.separateur}>
              <View style={styles.separateurLigne} />
              <View style={styles.separateurCentre}>
                <Text style={styles.separateurTexte}>◆ ACCESS SWITCH ◆</Text>
              </View>
              <View style={styles.separateurLigne} />
            </View>

            <TouchableOpacity style={styles.boutonSecondaire} onPress={() => router.replace('/login')} activeOpacity={0.8}>
              <Text style={styles.boutonSecondaireTexte}>DEJA UN COMPTE ? SE CONNECTER</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formFooter}>
            <Text style={styles.formFooterTexte}>🔒 Donnees protegees • AcademiApp © 2026 • IUT Douala</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.sysStats, { opacity: fadeAnim }]}>
          {[
            { label: 'PROFILE', valeur: 'NEW', icone: '🧾' },
            { label: 'ROLE', valeur: role === 'etudiant' ? 'STD' : 'PROF', icone: '🎛️' },
            { label: 'AUTH', valeur: 'ON', icone: '⚡' },
          ].map(stat => (
            <View key={stat.label} style={styles.sysStat}>
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
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingVertical: 34, justifyContent: 'center' },
  grilleContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04 },
  grilleRow: { flexDirection: 'row', flex: 1 },
  grilleCellule: { flex: 1, borderWidth: 0.5, borderColor: '#4A90D9' },
  orbitContainer: { position: 'absolute', top: '18%', left: '50%', marginLeft: -170 },
  orbite1: { width: 340, height: 340, borderRadius: 170, borderWidth: 1, borderColor: 'rgba(74,144,217,0.17)', position: 'absolute', top: -170, left: -170 },
  orbite2: { width: 250, height: 250, borderRadius: 125, borderWidth: 1, borderColor: 'rgba(76,175,80,0.14)', position: 'absolute', top: -125, left: -125 },
  orbite3: { width: 170, height: 170, borderRadius: 85, borderWidth: 1, borderColor: 'rgba(255,193,7,0.13)', position: 'absolute', top: -85, left: -85 },
  orbiteDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#4A90D9', position: 'absolute', top: -5, left: '50%', marginLeft: -5 },
  traceContainer: { position: 'absolute', top: 96, right: 18, gap: 12, opacity: 0.35 },
  traceLigne: { width: 120, height: 1, backgroundColor: '#4A90D9' },
  traceLigneCourte: { width: 70, backgroundColor: '#4CAF50', marginLeft: 40 },
  traceLigneViolette: { width: 96, backgroundColor: '#AB47BC', marginLeft: 18 },
  particule: { position: 'absolute', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  logoSection: { alignItems: 'center', marginBottom: 26, gap: 10 },
  logoHalo: { position: 'absolute', width: 176, height: 176, borderRadius: 88, backgroundColor: '#1565C0', top: -40 },
  logoWrapper: { width: 96, height: 96, borderRadius: 24, overflow: 'hidden', shadowColor: '#2196F3', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 32, elevation: 20 },
  logoGradient: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: 'rgba(120,210,255,0.85)', shadowColor: '#64C8FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8 },
  logoEmoji: { fontSize: 46, zIndex: 2 },
  logoTitre: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2.5, textTransform: 'uppercase', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  logoTitreAccent: { color: '#42A5F5' },
  logoVersion: { fontSize: 10, color: '#4A6080', letterSpacing: 1.2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', textAlign: 'center' },
  badgeRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(74,144,217,0.08)', borderWidth: 1, borderColor: 'rgba(74,144,217,0.18)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  badgeTexte: { color: '#8BA4C4', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  formContainer: { backgroundColor: 'rgba(5,15,35,0.96)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', overflow: 'hidden', shadowColor: '#1565C0', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 22, elevation: 16 },
  formHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(13,71,161,0.3)', paddingHorizontal: 16, paddingVertical: 10, gap: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(74,144,217,0.2)' },
  formHeaderDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF5252' },
  formHeaderTitre: { color: '#4A6080', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginLeft: 4 },
  formCorps: { padding: 20, gap: 15 },
  formTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  formTitre: { fontSize: 21, fontWeight: '900', color: '#FFFFFF' },
  formSous: { fontSize: 12, color: '#4A6080', marginTop: 3, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  signalBadge: { backgroundColor: 'rgba(76,175,80,0.14)', borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  signalBadgeTexte: { color: '#4CAF50', fontSize: 10, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  progressRail: { height: 3, backgroundColor: 'rgba(74,144,217,0.12)', borderRadius: 999, overflow: 'hidden' },
  progressSpark: { width: 120, height: 3, backgroundColor: '#4A90D9', borderRadius: 999 },
  champSection: { gap: 6 },
  champLabel: { color: '#1E4A7F', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 1 },
  champGradient: { borderRadius: 13, padding: 1 },
  champWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(10,25,60,0.92)', borderRadius: 12, paddingHorizontal: 14, gap: 10, overflow: 'hidden' },
  champIcone: { fontSize: 18 },
  champInput: { flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 14, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  champOk: { color: '#4CAF50', fontSize: 10, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  champOeil: { fontSize: 18, padding: 4 },
  roleSection: { gap: 8 },
  rolesContainer: { flexDirection: 'row', gap: 10 },
  roleBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  roleGradient: { minHeight: 128, padding: 12, gap: 6 },
  roleIcone: { fontSize: 24 },
  roleTitre: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  roleSousTitre: { color: '#8BA4C4', fontSize: 10, lineHeight: 15 },
  roleCheck: { position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', alignItems: 'center', justifyContent: 'center' },
  roleCheckTexte: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  securiteContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(0,255,0,0.03)', borderRadius: 9, padding: 10, borderWidth: 1, borderColor: 'rgba(76,175,80,0.1)' },
  securiteItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  securiteDot: { width: 5, height: 5, borderRadius: 3 },
  securiteTexte: { color: '#2A6A44', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  boutonGradient: { borderRadius: 13, overflow: 'hidden' },
  boutonContenu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 16, gap: 9 },
  boutonIcone: { fontSize: 20 },
  boutonTexte: { color: '#FFFFFF', fontWeight: '900', fontSize: 13, letterSpacing: 1.3 },
  boutonFleche: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  boutonBrillant: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.45)' },
  separateur: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  separateurLigne: { flex: 1, height: 1, backgroundColor: 'rgba(74,144,217,0.15)' },
  separateurCentre: { paddingHorizontal: 6 },
  separateurTexte: { color: '#1E3A5F', fontSize: 10, letterSpacing: 1.4, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  boutonSecondaire: { borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(74,144,217,0.35)', backgroundColor: 'rgba(74,144,217,0.06)' },
  boutonSecondaireTexte: { color: '#4A90D9', fontWeight: '800', fontSize: 12, letterSpacing: 0.8 },
  formFooter: { backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(74,144,217,0.1)' },
  formFooterTexte: { color: '#1E3A5F', fontSize: 10, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  sysStats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, backgroundColor: 'rgba(5,15,35,0.82)', borderRadius: 14, padding: 15, borderWidth: 1, borderColor: 'rgba(74,144,217,0.15)' },
  sysStat: { alignItems: 'center', gap: 4 },
  sysStatIcone: { fontSize: 19 },
  sysStatValeur: { color: '#4A90D9', fontSize: 16, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  sysStatLabel: { color: '#1E3A5F', fontSize: 9, letterSpacing: 1.3, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});
