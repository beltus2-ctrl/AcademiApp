import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

type OngletAdmin = 'stats' | 'etudiants' | 'professeurs';

type Utilisateur = {
  id: string;
  nom?: string;
  email?: string;
  role?: string;
  disponible?: boolean;
  dateInscription?: string;
};

type StatAdmin = {
  label: string;
  valeur: string;
  icone: string;
  couleur: string;
};

type CarteAdmin = {
  icone: string;
  label: string;
  code: string;
  description: string;
  accent: string;
  indicateur: string;
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
const URL_MUSIQUE = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
const HAUTEUR_CARTE = Math.max(168, Math.min(210, Math.round(height * 0.2)));
const cartes: CarteAdmin[] = [
  {
    icone: '👥',
    label: 'Utilisateurs',
    code: 'USER_CONTROL',
    description: 'Comptes, roles et acces AcademiApp',
    accent: '#4A90D9',
    indicateur: 'AUTH',
  },
  {
    icone: '📚',
    label: 'Contenu',
    code: 'CONTENT_CORE',
    description: 'Cours, modules et ressources academiques',
    accent: '#4CAF50',
    indicateur: 'SYNC',
  },
  {
    icone: '🧠',
    label: 'Reponses IA',
    code: 'AI_SUPERVISOR',
    description: 'Supervision des generations AcademiAI',
    accent: '#AB47BC',
    indicateur: 'AI ON',
  },
  {
    icone: '📊',
    label: 'Statistiques',
    code: 'DATA_RADAR',
    description: 'Activite, progression et signaux systeme',
    accent: '#FFC107',
    indicateur: 'LIVE',
  },
];

export default function TableauAdmin() {
  const router = useRouter();
  const [nom, setNom] = useState('');
  const [profil, setProfil] = useState<Utilisateur | null>(null);
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [stats, setStats] = useState<StatAdmin[]>([]);
  const [chargementDonnees, setChargementDonnees] = useState(true);
  const [erreurDonnees, setErreurDonnees] = useState('');
  const [ongletActif, setOngletActif] = useState<OngletAdmin>('stats');
  const [operationEnCours, setOperationEnCours] = useState('');

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
    chargerProfil();
    const unsubscribe = ecouterUtilisateurs();
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const appliquerUtilisateurs = (liste: Utilisateur[]) => {
    const etudiantsCount = liste.filter(utilisateur => utilisateur.role === 'etudiant').length;
    const professeursCount = liste.filter(utilisateur => utilisateur.role === 'professeur').length;
    const professeursDisponibles = liste.filter(utilisateur => utilisateur.role === 'professeur' && utilisateur.disponible).length;

    setUtilisateurs(liste);
    setStats([
      { label: 'Etudiants', valeur: String(etudiantsCount), icone: 'STD', couleur: '#4A90D9' },
      { label: 'Professeurs', valeur: String(professeursCount), icone: 'PROF', couleur: '#FFC107' },
      { label: 'Profs dispo', valeur: String(professeursDisponibles), icone: 'ON', couleur: '#4CAF50' },
      { label: 'Total users', valeur: String(liste.length), icone: 'ALL', couleur: '#AB47BC' },
    ]);
  };

  const chargerProfil = async () => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;

    try {
      const docSnap = await getDoc(doc(db, 'utilisateurs', utilisateur.uid));
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Utilisateur;
        setProfil(data);
        setNom(data.nom || '');
      }
    } catch {}
  };

  const chargerDonnees = async () => {
    setChargementDonnees(true);
    setErreurDonnees('');

    try {
      await chargerProfil();
      const snap = await getDocs(collection(db, 'utilisateurs'));
      const liste = snap.docs.map(d => ({ id: d.id, ...d.data() } as Utilisateur));
      appliquerUtilisateurs(liste);
    } catch {
      setErreurDonnees('Donnees admin indisponibles pour le moment.');
    } finally {
      setChargementDonnees(false);
    }
  };

  const ecouterUtilisateurs = () => {
    setChargementDonnees(true);

    return onSnapshot(
      collection(db, 'utilisateurs'),
      snap => {
        const liste = snap.docs.map(d => ({ id: d.id, ...d.data() } as Utilisateur));
        appliquerUtilisateurs(liste);
        setErreurDonnees('');
        setChargementDonnees(false);
      },
      () => {
        setErreurDonnees('Synchronisation temps reel indisponible.');
        setChargementDonnees(false);
      }
    );
  };

  const obtenirInitiales = (valeur?: string) => {
    const initiales = (valeur || 'Utilisateur')
      .trim()
      .split(/\s+/)
      .map(partie => partie[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return initiales || 'US';
  };

  const formaterDate = (dateInscription?: string) => {
    if (!dateInscription) return 'Inscription inconnue';
    const date = new Date(dateInscription);
    if (Number.isNaN(date.getTime())) return 'Inscription inconnue';
    return 'Inscrit le ' + date.toLocaleDateString('fr-FR');
  };

  const changerRole = (utilisateur: Utilisateur, nouveauRole: 'etudiant' | 'professeur') => {
    if (!utilisateur.id || operationEnCours) return;

    Alert.alert(
      'Changer le role',
      'Changer le role de ' + (utilisateur.nom || utilisateur.email || 'cet utilisateur') + ' en "' + nouveauRole + '" ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setOperationEnCours(utilisateur.id + ':role');
            try {
              await updateDoc(doc(db, 'utilisateurs', utilisateur.id), { role: nouveauRole });
              Alert.alert('Role modifie', (utilisateur.nom || 'Utilisateur') + ' est maintenant ' + nouveauRole + '.');
            } catch {
              Alert.alert('Erreur', 'Impossible de modifier le role.');
            } finally {
              setOperationEnCours('');
            }
          },
        },
      ]
    );
  };

  const supprimerUtilisateur = (utilisateur: Utilisateur) => {
    if (!utilisateur.id || operationEnCours) return;

    Alert.alert(
      'Supprimer',
      'Supprimer le profil de ' + (utilisateur.nom || utilisateur.email || 'cet utilisateur') + ' ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setOperationEnCours(utilisateur.id + ':delete');
            try {
              await deleteDoc(doc(db, 'utilisateurs', utilisateur.id));
              Alert.alert('Profil supprime', 'Le profil a ete retire de Firestore.');
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer ce profil.');
            } finally {
              setOperationEnCours('');
            }
          },
        },
      ]
    );
  };

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

  const presserCarte = (index: number) => {
    Animated.sequence([
      Animated.timing(cardScales[index], { toValue: 0.96, duration: 70, useNativeDriver: true }),
      Animated.spring(cardScales[index], { toValue: 1, tension: 260, friction: 6, useNativeDriver: true }),
    ]).start();
  };

  const seDeconnecter = async () => {
    Alert.alert('Deconnexion', 'Voulez-vous vous deconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Deconnecter',
        style: 'destructive',
        onPress: async () => {
          try {
            sonRef.current?.pause();
            await signOut(auth);
            router.replace('/login');
          } catch {
            Alert.alert('Erreur', 'Impossible de se deconnecter');
          }
        },
      },
    ]);
  };

  const ouvrirCarte = (index: number) => {
    presserCarte(index);
    const carte = cartes[index];
    if (!carte) return;

    if (carte.code === 'USER_CONTROL') {
      setOngletActif('etudiants');
    } else if (carte.code === 'CONTENT_CORE') {
      router.push('/cours' as any);
    } else if (carte.code === 'AI_SUPERVISOR') {
      router.push('/chat' as any);
    } else if (carte.code === 'DATA_RADAR') {
      setOngletActif('stats');
    }
  };

  const etudiants = utilisateurs.filter(utilisateur => utilisateur.role === 'etudiant');
  const professeurs = utilisateurs.filter(utilisateur => utilisateur.role === 'professeur');
  const administrateurs = utilisateurs.filter(utilisateur => utilisateur.role === 'admin');
  const totalUtilisateurs = Math.max(utilisateurs.length, 1);

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
              <Text style={styles.logoEmoji}>👑</Text>
            </LinearGradient>
          </Animated.View>

          <Text style={styles.titre}>ADMIN_NEXUS</Text>
          <Text style={styles.sousTitre}>Bienvenue {nom || profil?.email || 'Admin'} • Controle AcademiApp</Text>

          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.statusTexte}>ROOT ACCESS</Text>
            </View>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: '#FFC107' }]} />
              <Text style={styles.statusTexte}>SYSTEM LIVE</Text>
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
            <Text style={styles.panelHeaderTitre}>ACADEMIAPP_ADMIN_CONTROL.exe</Text>
          </View>

          <View style={styles.panelBody}>
            <View style={styles.telemetryRail}>
              <Animated.View style={[styles.telemetrySpark, { transform: [{ translateX: telemetryX }] }]} />
            </View>

            <View style={styles.commandBand}>
              <Text style={styles.commandTitre}>[ PANNEAU_DE_CONTROLE ]</Text>
              <Text style={styles.commandTexte}>Gestion utilisateurs, contenu, IA et statistiques systeme.</Text>
            </View>

            {erreurDonnees ? (
              <View style={styles.erreurBox}>
                <Text style={styles.erreurTexte}>{erreurDonnees}</Text>
              </View>
            ) : null}

            {chargementDonnees && utilisateurs.length === 0 ? (
              <View style={styles.chargementBox}>
                <ActivityIndicator color="#4A90D9" />
                <Text style={styles.chargementTexte}>Chargement de la console...</Text>
              </View>
            ) : (
              <View style={styles.statsGrille}>
                {stats.map(stat => (
                  <View key={stat.label} style={[styles.statCard, { borderColor: stat.couleur + '66' }]}>
                    <Text style={[styles.statIcone, { color: stat.couleur }]}>{stat.icone}</Text>
                    <Text style={[styles.statValeur, { color: stat.couleur }]}>{stat.valeur}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.actionsRapides}>
              {[
                { label: 'Stats', accent: '#4A90D9', action: () => setOngletActif('stats') },
                { label: 'Chat global', accent: '#4CAF50', action: () => router.push('/chat' as any) },
                { label: 'Examens', accent: '#FFC107', action: () => router.push('/examens' as any) },
                { label: 'Actualiser', accent: '#AB47BC', action: () => { void chargerDonnees(); } },
              ].map(action => (
                <TouchableOpacity
                  key={action.label}
                  style={[styles.actionRapide, { borderColor: action.accent + '66' }]}
                  onPress={action.action}
                  activeOpacity={0.82}
                >
                  <Text style={[styles.actionRapideTexte, { color: action.accent }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.grilleCartes}>
              {cartes.map((carte, index) => (
                <Animated.View
                  key={carte.code}
                  style={[styles.carteAnimated, { transform: [{ scale: cardScales[index] }] }]}
                >
                  <TouchableOpacity activeOpacity={0.86} onPress={() => ouvrirCarte(index)}>
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
                        <Text style={styles.carteAction}>{carte.indicateur}</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>

            <View style={styles.onglets}>
              {[
                { id: 'stats' as const, label: 'Stats', count: null },
                { id: 'etudiants' as const, label: 'Etudiants', count: etudiants.length },
                { id: 'professeurs' as const, label: 'Profs', count: professeurs.length },
              ].map(onglet => (
                <TouchableOpacity
                  key={onglet.id}
                  style={[styles.onglet, ongletActif === onglet.id && styles.ongletActif]}
                  onPress={() => setOngletActif(onglet.id)}
                  activeOpacity={0.82}
                >
                  <Text style={[styles.ongletTexte, ongletActif === onglet.id && styles.ongletTexteActif]}>
                    {onglet.label}
                  </Text>
                  {onglet.count !== null ? (
                    <View style={[styles.ongletBadge, ongletActif === onglet.id && styles.ongletBadgeActif]}>
                      <Text style={styles.ongletBadgeTexte}>{onglet.count}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>

            {ongletActif === 'stats' ? (
              <View style={styles.sectionSurface}>
                <Text style={styles.sectionTitre}>Vue d ensemble</Text>
                {[
                  { label: 'Total utilisateurs', valeur: utilisateurs.length, couleur: '#4A90D9', barre: utilisateurs.length / totalUtilisateurs },
                  { label: 'Etudiants actifs', valeur: etudiants.length, couleur: '#4CAF50', barre: etudiants.length / totalUtilisateurs },
                  { label: 'Corps enseignant', valeur: professeurs.length, couleur: '#FFC107', barre: professeurs.length / totalUtilisateurs },
                  { label: 'Administrateurs', valeur: administrateurs.length, couleur: '#FF5252', barre: administrateurs.length / totalUtilisateurs },
                ].map(item => (
                  <View key={item.label} style={styles.statsDetailItem}>
                    <View style={styles.statsDetailHeader}>
                      <Text style={styles.statsDetailLabel}>{item.label}</Text>
                      <Text style={[styles.statsDetailValeur, { color: item.couleur }]}>{item.valeur}</Text>
                    </View>
                    <View style={styles.statsDetailBarre}>
                      <View
                        style={[
                          styles.statsDetailBarreRemplissage,
                          {
                            width: (Math.min(1, item.barre) * 100 + '%') as any,
                            backgroundColor: item.couleur,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {ongletActif === 'etudiants' ? (
              <View style={styles.sectionSurface}>
                <Text style={styles.sectionTitre}>{etudiants.length} etudiant(s) inscrit(s)</Text>
                {etudiants.map(etudiant => (
                  <View key={etudiant.id} style={styles.utilisateurCard}>
                    <View style={[styles.utilisateurAvatar, { borderColor: '#4A90D966' }]}>
                      <Text style={[styles.utilisateurAvatarTexte, { color: '#4A90D9' }]}>
                        {obtenirInitiales(etudiant.nom)}
                      </Text>
                    </View>
                    <View style={styles.utilisateurInfo}>
                      <Text style={styles.utilisateurNom}>{etudiant.nom || 'Etudiant'}</Text>
                      <Text style={styles.utilisateurEmail} numberOfLines={1}>{etudiant.email || 'Email indisponible'}</Text>
                      <Text style={styles.utilisateurMeta}>{formaterDate(etudiant.dateInscription)}</Text>
                    </View>
                    <View style={styles.utilisateurActions}>
                      <TouchableOpacity
                        style={[styles.boutonRole, Boolean(operationEnCours) && styles.boutonDesactive]}
                        onPress={() => changerRole(etudiant, 'professeur')}
                        disabled={Boolean(operationEnCours)}
                      >
                        <Text style={styles.boutonRoleTexte}>Vers prof</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.boutonSupprimer, Boolean(operationEnCours) && styles.boutonDesactive]}
                        onPress={() => supprimerUtilisateur(etudiant)}
                        disabled={Boolean(operationEnCours)}
                      >
                        <Text style={styles.boutonSupprimerTexte}>Suppr.</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {etudiants.length === 0 ? <Text style={styles.videTexte}>Aucun etudiant inscrit.</Text> : null}
              </View>
            ) : null}

            {ongletActif === 'professeurs' ? (
              <View style={styles.sectionSurface}>
                <Text style={styles.sectionTitre}>{professeurs.length} professeur(s) inscrit(s)</Text>
                {professeurs.map(prof => (
                  <View key={prof.id} style={styles.utilisateurCard}>
                    <View style={[styles.utilisateurAvatar, { borderColor: '#FFC10766' }]}>
                      <Text style={[styles.utilisateurAvatarTexte, { color: '#FFC107' }]}>
                        {obtenirInitiales(prof.nom)}
                      </Text>
                    </View>
                    <View style={styles.utilisateurInfo}>
                      <Text style={styles.utilisateurNom}>{prof.nom || 'Professeur'}</Text>
                      <Text style={styles.utilisateurEmail} numberOfLines={1}>{prof.email || 'Email indisponible'}</Text>
                      <View
                        style={[
                          styles.dispoBadge,
                          {
                            borderColor: prof.disponible ? '#4CAF5066' : '#FF525266',
                            backgroundColor: prof.disponible ? 'rgba(76,175,80,0.12)' : 'rgba(255,82,82,0.1)',
                          },
                        ]}
                      >
                        <Text style={[styles.dispoTexte, { color: prof.disponible ? '#4CAF50' : '#FF5252' }]}>
                          {prof.disponible ? 'Disponible' : 'Indisponible'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.utilisateurActions}>
                      <TouchableOpacity
                        style={[styles.boutonRole, Boolean(operationEnCours) && styles.boutonDesactive]}
                        onPress={() => changerRole(prof, 'etudiant')}
                        disabled={Boolean(operationEnCours)}
                      >
                        <Text style={styles.boutonRoleTexte}>Vers etud.</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.boutonSupprimer, Boolean(operationEnCours) && styles.boutonDesactive]}
                        onPress={() => supprimerUtilisateur(prof)}
                        disabled={Boolean(operationEnCours)}
                      >
                        <Text style={styles.boutonSupprimerTexte}>Suppr.</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {professeurs.length === 0 ? (
                  <View style={styles.videContainer}>
                    <Text style={styles.videTitre}>Aucun professeur inscrit.</Text>
                    <Text style={styles.videTexte}>Les professeurs apparaitront ici apres inscription.</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

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
                <Text style={styles.securiteTexte}>ADMIN SECURE</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.boutonDeconnexion} onPress={seDeconnecter} activeOpacity={0.82}>
              <Text style={styles.texteDeconnexion}>TERMINER LA SESSION</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.panelFooter}>
            <Text style={styles.panelFooterTexte}>🔒 AcademiApp © 2026 • Console administrateur • IUT Douala</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.sysStats, { opacity: fadeAnim }]}>
          {[
            { label: 'MODULES', valeur: '4', icone: '📦' },
            { label: 'IA', valeur: 'ON', icone: '🤖' },
            { label: 'ROLE', valeur: 'ADMIN', icone: '👑' },
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
  commandBand: { backgroundColor: 'rgba(74,144,217,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(74,144,217,0.18)', padding: 12, gap: 4 },
  commandTitre: { color: '#4A90D9', fontSize: 10, fontWeight: '900', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  commandTexte: { color: '#8BA4C4', fontSize: 11, lineHeight: 16 },
  erreurBox: { backgroundColor: 'rgba(255,82,82,0.09)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,82,82,0.24)', padding: 10 },
  erreurTexte: { color: '#FF8A8A', fontSize: 11, lineHeight: 16 },
  chargementBox: { minHeight: 88, alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: 'rgba(255,255,255,0.035)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  chargementTexte: { color: '#8BA4C4', fontSize: 11 },
  statsGrille: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flexGrow: 1, flexBasis: '45%', minHeight: 94, backgroundColor: 'rgba(255,255,255,0.045)', borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center', justifyContent: 'center', gap: 4 },
  statIcone: { fontSize: 10, fontWeight: '900', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  statValeur: { fontSize: 24, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  statLabel: { color: '#8BA4C4', fontSize: 10, textAlign: 'center' },
  actionsRapides: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionRapide: { flexGrow: 1, flexBasis: '45%', minHeight: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.035)', borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  actionRapideTexte: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  grilleCartes: { flexGrow: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: 12 },
  carteAnimated: { width: '48%', flexGrow: 1 },
  carte: { minHeight: HAUTEUR_CARTE, borderRadius: 15, padding: 13, borderWidth: 1, overflow: 'hidden', gap: 8 },
  carteTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  carteIconeBox: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: 'rgba(0,8,20,0.42)' },
  icone: { fontSize: 24 },
  carteCode: { flex: 1, textAlign: 'right', fontSize: 8, fontWeight: '900', letterSpacing: 0.7, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  texteCarte: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  descriptionCarte: { color: '#8BA4C4', fontSize: 10, lineHeight: 15, minHeight: 45 },
  carteFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 'auto' },
  carteSignal: { width: 6, height: 6, borderRadius: 3 },
  carteAction: { color: '#4A6080', fontSize: 8, letterSpacing: 0.9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  onglets: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.035)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 4, gap: 4 },
  onglet: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 9, gap: 5, paddingHorizontal: 4 },
  ongletActif: { backgroundColor: 'rgba(74,144,217,0.16)', borderWidth: 1, borderColor: 'rgba(74,144,217,0.38)' },
  ongletTexte: { color: '#4A6080', fontSize: 10, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  ongletTexteActif: { color: '#4A90D9' },
  ongletBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 5 },
  ongletBadgeActif: { backgroundColor: 'rgba(74,144,217,0.28)' },
  ongletBadgeTexte: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  sectionSurface: { backgroundColor: 'rgba(255,255,255,0.035)', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 13, gap: 11 },
  sectionTitre: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.6, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  statsDetailItem: { gap: 6 },
  statsDetailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  statsDetailLabel: { color: '#8BA4C4', fontSize: 11 },
  statsDetailValeur: { fontSize: 12, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  statsDetailBarre: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' },
  statsDetailBarreRemplissage: { height: '100%', borderRadius: 999 },
  utilisateurCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,8,20,0.32)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 10, gap: 10 },
  utilisateurAvatar: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  utilisateurAvatarTexte: { fontSize: 13, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  utilisateurInfo: { flex: 1, minWidth: 0, gap: 3 },
  utilisateurNom: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  utilisateurEmail: { color: '#4A6080', fontSize: 10 },
  utilisateurMeta: { color: '#2A6A8A', fontSize: 9 },
  utilisateurActions: { width: 74, gap: 6 },
  boutonRole: { minHeight: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(74,144,217,0.13)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(74,144,217,0.34)', paddingHorizontal: 5 },
  boutonRoleTexte: { color: '#4A90D9', fontSize: 9, fontWeight: '900' },
  boutonSupprimer: { minHeight: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,82,82,0.12)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,82,82,0.32)', paddingHorizontal: 5 },
  boutonSupprimerTexte: { color: '#FF6B6B', fontSize: 9, fontWeight: '900' },
  boutonDesactive: { opacity: 0.45 },
  dispoBadge: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  dispoTexte: { fontSize: 9, fontWeight: '800' },
  videContainer: { alignItems: 'center', paddingVertical: 14, gap: 5 },
  videTitre: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  videTexte: { color: '#8BA4C4', fontSize: 11, lineHeight: 16, textAlign: 'center' },
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
