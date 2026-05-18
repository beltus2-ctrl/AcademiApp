import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, Animated,
    KeyboardAvoidingView, Platform,
    ScrollView,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { API_URL } from '../../utils/config';
import { verifierEtDecrementerQuota } from '../../utils/quota';

type Etape = 'saisie' | 'examen' | 'correction' | 'chargement';

const DUREES = [
  { label: '30 min', valeur: 30, emoji: '⚡' },
  { label: '1 heure', valeur: 60, emoji: '⏱️' },
  { label: '2 heures', valeur: 120, emoji: '📚' },
  { label: '3 heures', valeur: 180, emoji: '🎓' },
];

const MESSAGES_CHRONO = [
  'Reste concentre ! 🎯',
  'Tu geres ! 💪',
  'Chaque minute compte ! ⚡',
  'Garde ton calme ! 😌',
];

export default function Simulation() {
  const router = useRouter();
  const [etape, setEtape] = useState<Etape>('saisie');
  const [matiere, setMatiere] = useState('');
  const [contenuCours, setContenuCours] = useState('');
  const [duree, setDuree] = useState(60);
  const [sujet, setSujet] = useState('');
  const [reponseEtudiant, setReponseEtudiant] = useState('');
  const [correction, setCorrection] = useState('');
  const [tempsRestant, setTempsRestant] = useState(0);
  const [tempsEcoule, setTempsEcoule] = useState(0);
  const [messageMotivation, setMessageMotivation] = useState(MESSAGES_CHRONO[0]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const chronoAnim = useRef(new Animated.Value(1)).current;
  const urgenceAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const motivationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    animerEntree();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (motivationRef.current) clearInterval(motivationRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (etape === 'examen') {
      demarrerChrono();
      demarrerMotivation();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (motivationRef.current) clearInterval(motivationRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etape]);

  const animerEntree = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  };

  const demarrerChrono = () => {
    setTempsRestant(duree * 60);
    setTempsEcoule(0);
    intervalRef.current = setInterval(() => {
      setTempsRestant(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          Alert.alert(
            '⏰ Temps ecoule !',
            'Le temps est termine ! Remettez votre copie pour la correction.',
            [{ text: 'Corriger maintenant', onPress: () => lancerCorrection() }]
          );
          return 0;
        }
        const nouveau = prev - 1;
        if (nouveau === 300) {
          Animated.loop(
            Animated.sequence([
              Animated.timing(urgenceAnim, { toValue: 1.1, duration: 300, useNativeDriver: true }),
              Animated.timing(urgenceAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            ])
          ).start();
          Alert.alert('⚠️ Attention !', 'Il ne reste que 5 minutes ! Finalisez vos reponses !');
        }
        return nouveau;
      });
      setTempsEcoule(prev => prev + 1);
    }, 1000);
  };

  const demarrerMotivation = () => {
    let index = 0;
    motivationRef.current = setInterval(() => {
      index = (index + 1) % MESSAGES_CHRONO.length;
      setMessageMotivation(MESSAGES_CHRONO[index]);
      Animated.sequence([
        Animated.timing(chronoAnim, { toValue: 0.8, duration: 200, useNativeDriver: true }),
        Animated.spring(chronoAnim, { toValue: 1, tension: 100, friction: 5, useNativeDriver: true }),
      ]).start();
    }, 30000);
  };

  const formaterTemps = (secondes: number) => {
    const h = Math.floor(secondes / 3600);
    const m = Math.floor((secondes % 3600) / 60);
    const s = secondes % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getPourcentageTemps = () => {
    return ((duree * 60 - tempsRestant) / (duree * 60)) * 100;
  };

  const getCouleurChrono = () => {
    const pct = tempsRestant / (duree * 60);
    if (pct > 0.5) return '#4CAF50';
    if (pct > 0.25) return '#FFC107';
    return '#FF5252';
  };

  const genererSujet = async () => {
    if (!matiere.trim()) {
      Alert.alert('Matiere manquante', 'Entrez la matiere de l examen.');
      return;
    }
    const quota = await verifierEtDecrementerQuota();
    if (!quota.autorise) {
      Alert.alert('⚠️ Quota atteint', quota.message || 'Reessayez demain.');
      return;
    }
    setEtape('chargement');
    try {
      const response = await fetch(`${API_URL}/generer-sujet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matiere, contenuCours, duree })
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert('Erreur', data.erreur || 'Impossible de generer le sujet.');
        setEtape('saisie');
        return;
      }
      setSujet(data.sujet);
      setEtape('examen');
    } catch {
      Alert.alert('🔌 Connexion impossible', 'Verifiez que le backend est lance.');
      setEtape('saisie');
    }
  };

  const lancerCorrection = async () => {
    if (!reponseEtudiant.trim()) {
      Alert.alert('Copie vide', 'Ecrivez quelque chose avant de soumettre ! 😊');
      return;
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (motivationRef.current) clearInterval(motivationRef.current);
    const quota = await verifierEtDecrementerQuota();
    if (!quota.autorise) {
      Alert.alert('⚠️ Quota atteint', quota.message || 'Reessayez demain.');
      return;
    }
    setEtape('chargement');
    try {
      const response = await fetch(`${API_URL}/corriger-examen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sujet,
          reponse: reponseEtudiant,
          matiere,
          tempsUtilise: formaterTemps(tempsEcoule)
        })
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert('Erreur', data.erreur || 'Impossible de corriger.');
        setEtape('examen');
        return;
      }
      setCorrection(data.correction);
      setEtape('correction');
    } catch {
      Alert.alert('🔌 Connexion impossible', 'Verifiez que le backend est lance.');
      setEtape('examen');
    }
  };

  // ─── ÉCRAN CHARGEMENT ─────────────────────────────────────────
  if (etape === 'chargement') {
    return (
      <View style={styles.chargementContainer}>
        <Text style={styles.chargementEmoji}>
          {sujet ? '🤖' : '📝'}
        </Text>
        <ActivityIndicator size="large" color="#4A90D9" style={{ marginVertical: 16 }} />
        <Text style={styles.chargementTitre}>
          {sujet ? 'AcademiAI corrige votre copie...' : 'Generation du sujet en cours...'}
        </Text>
        <Text style={styles.chargementSous}>
          {sujet ? 'Analyse detaillee de vos reponses' : 'Preparation d un examen de niveau IUT'}
        </Text>
      </View>
    );
  }

  // ─── ÉCRAN SAISIE ─────────────────────────────────────────────
  if (etape === 'saisie') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#0F2044' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
              <Text style={styles.retourTexte}>← Retour</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitre}>Simulation</Text>
            <View style={{ width: 70 }} />
          </Animated.View>

          <Animated.View style={[styles.banniere, { opacity: fadeAnim }]}>
            <Animated.Text style={[styles.banniereEmoji, { transform: [{ scale: pulseAnim }] }]}>📝</Animated.Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.banniereTitre}>Simulation d examen</Text>
              <Text style={styles.banniereTexte}>Conditions reelles • Correction IA • Progresse vite !</Text>
            </View>
          </Animated.View>

          <View style={styles.infoConditions}>
            <Text style={styles.infoConditionsTitre}>📋 Conditions de l examen</Text>
            <View style={styles.conditionItem}>
              <Text style={styles.conditionEmoji}>⏱️</Text>
              <Text style={styles.conditionTexte}>Chronometre en temps reel — comme le vrai examen</Text>
            </View>
            <View style={styles.conditionItem}>
              <Text style={styles.conditionEmoji}>📵</Text>
              <Text style={styles.conditionTexte}>Fermez vos autres applications pendant l examen</Text>
            </View>
            <View style={styles.conditionItem}>
              <Text style={styles.conditionEmoji}>🤖</Text>
              <Text style={styles.conditionTexte}>Correction detaillee par AcademiAI apres la remise</Text>
            </View>
            <View style={styles.conditionItem}>
              <Text style={styles.conditionEmoji}>🎯</Text>
              <Text style={styles.conditionTexte}>Criteres de correction selon le systeme camerounais IUT</Text>
            </View>
          </View>

          <Text style={styles.label}>📚 Matiere *</Text>
          <TextInput
            style={styles.champ}
            placeholder="Ex: Electronique, Algorithmique, Gestion..."
            placeholderTextColor="#4A6080"
            value={matiere}
            onChangeText={setMatiere}
          />

          <Text style={styles.label}>📖 Contenu du cours (optionnel)</Text>
          <TextInput
            style={[styles.champ, styles.champMultiline]}
            placeholder="Collez vos notes ou le programme pour un sujet plus cible..."
            placeholderTextColor="#4A6080"
            value={contenuCours}
            onChangeText={setContenuCours}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <Text style={styles.label}>⏱️ Duree de l examen</Text>
          <View style={styles.dureeContainer}>
            {DUREES.map((d) => (
              <TouchableOpacity
                key={d.valeur}
                style={[styles.dureeBtn, duree === d.valeur && styles.dureeBtnActif]}
                onPress={() => setDuree(d.valeur)}
                activeOpacity={0.7}
              >
                <Text style={styles.dureeEmoji}>{d.emoji}</Text>
                <Text style={[styles.dureeTexte, duree === d.valeur && styles.dureeTexteActif]}>
                  {d.label}
                </Text>
                {duree === d.valeur && <View style={styles.dureeBadge} />}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.bouton, !matiere.trim() && styles.boutonDesactive]}
            onPress={genererSujet}
            disabled={!matiere.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.texteBouton}>📝 Demarrer l examen</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── ÉCRAN EXAMEN ─────────────────────────────────────────────
  if (etape === 'examen') {
    const couleurChrono = getCouleurChrono();
    const pctTemps = getPourcentageTemps();

    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#0F2044' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Barre chrono fixe en haut */}
        <View style={styles.chronoHeader}>
          <View style={styles.chronoGauche}>
            <Animated.Text style={[styles.chronoTemps, { color: couleurChrono, transform: [{ scale: tempsRestant <= 300 ? urgenceAnim : chronoAnim }] }]}>
              {formaterTemps(tempsRestant)}
            </Animated.Text>
            <Text style={[styles.chronoLabel, { color: couleurChrono }]}>
              {tempsRestant <= 300 ? '⚠️ URGENT' : '⏱️ Restant'}
            </Text>
          </View>
          <View style={styles.chronoCentre}>
            <Text style={styles.chronoMatiere}>{matiere}</Text>
            <Animated.Text style={[styles.chronoMotivation, { transform: [{ scale: chronoAnim }] }]}>
              {messageMotivation}
            </Animated.Text>
          </View>
          <View style={styles.chronoDroit}>
            <Text style={styles.chronoEcoule}>{formaterTemps(tempsEcoule)}</Text>
            <Text style={styles.chronoEcouleLabel}>Ecoule</Text>
          </View>
        </View>

        {/* Barre de progression du temps */}
        <View style={styles.chronoBarreContainer}>
          <View style={[styles.chronoBarre, { width: `${pctTemps}%` as any, backgroundColor: couleurChrono }]} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollExamen} keyboardShouldPersistTaps="handled">

          {/* Sujet */}
          <View style={styles.sujetContainer}>
            <Text style={styles.sujetTitre}>📋 SUJET D EXAMEN</Text>
            <Text style={styles.sujetTexte}>{sujet}</Text>
          </View>

          {/* Zone de réponse */}
          <Text style={styles.label}>✏️ Votre reponse</Text>
          <TextInput
            style={[styles.champ, styles.champReponse]}
            placeholder="Redigez votre reponse ici... Soyez precis et structure !"
            placeholderTextColor="#4A6080"
            value={reponseEtudiant}
            onChangeText={setReponseEtudiant}
            multiline
            textAlignVertical="top"
          />

          <View style={styles.compteurMots}>
            <Text style={styles.compteurMotsTexte}>
              📝 {reponseEtudiant.trim().split(/\s+/).filter(Boolean).length} mots
            </Text>
          </View>

          {/* Boutons */}
          <TouchableOpacity
            style={[styles.bouton, !reponseEtudiant.trim() && styles.boutonDesactive]}
            onPress={() => {
              Alert.alert(
                '📤 Remettre la copie ?',
                `Temps utilise : ${formaterTemps(tempsEcoule)}\nMots ecrits : ${reponseEtudiant.trim().split(/\s+/).filter(Boolean).length}\n\nEtes-vous sur de vouloir soumettre ?`,
                [
                  { text: 'Continuer l examen', style: 'cancel' },
                  { text: 'Soumettre', onPress: lancerCorrection }
                ]
              );
            }}
            disabled={!reponseEtudiant.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.texteBouton}>📤 Remettre la copie</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.boutonAbandon}
            onPress={() => {
              Alert.alert(
                '🚪 Abandonner ?',
                'Votre progression sera perdue.',
                [
                  { text: 'Continuer', style: 'cancel' },
                  { text: 'Abandonner', style: 'destructive', onPress: () => router.back() }
                ]
              );
            }}
          >
            <Text style={styles.boutonAbandonTexte}>Abandonner l examen</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── ÉCRAN CORRECTION ─────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
          <Text style={styles.retourTexte}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitre}>Correction</Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={styles.correctionBanniere}>
        <Text style={styles.correctionBanniereEmoji}>🎓</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.correctionBanniereTitre}>Correction AcademiAI</Text>
          <Text style={styles.correctionBanniereTexte}>
            Temps utilise : {formaterTemps(tempsEcoule)} • {reponseEtudiant.trim().split(/\s+/).filter(Boolean).length} mots
          </Text>
        </View>
      </View>

      <View style={styles.maCopiContainer}>
        <Text style={styles.maCopiTitre}>✏️ Votre copie</Text>
        <Text style={styles.maCopiTexte}>{reponseEtudiant}</Text>
      </View>

      <View style={styles.correctionContainer}>
        <Text style={styles.correctionTitre}>🤖 Correction detaillee</Text>
        <View style={styles.correctionDivider} />
        <ScrollView style={styles.correctionScroll} nestedScrollEnabled showsVerticalScrollIndicator>
          <Text style={styles.correctionTexte}>{correction}</Text>
        </ScrollView>
      </View>

      <TouchableOpacity
        style={styles.bouton}
        onPress={() => {
          setEtape('saisie');
          setSujet('');
          setReponseEtudiant('');
          setCorrection('');
          setTempsEcoule(0);
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.texteBouton}>🔄 Nouvelle simulation</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.boutonRetour}
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <Text style={styles.boutonRetourTexte}>🏠 Retour aux examens</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 60, paddingHorizontal: 24 },
  scrollExamen: { flexGrow: 1, paddingBottom: 40, paddingHorizontal: 24, paddingTop: 16 },
  chargementContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32, backgroundColor: '#0F2044' },
  chargementEmoji: { fontSize: 60 },
  chargementTitre: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  chargementSous: { color: '#8BA4C4', fontSize: 14, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 20 },
  retourBtn: { width: 70 },
  retourTexte: { color: '#4A90D9', fontSize: 14, fontWeight: '600' },
  headerTitre: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  banniere: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74,144,217,0.12)', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', gap: 12 },
  banniereEmoji: { fontSize: 36 },
  banniereTitre: { fontSize: 16, fontWeight: 'bold', color: '#4A90D9', marginBottom: 2 },
  banniereTexte: { fontSize: 12, color: '#8BA4C4' },
  infoConditions: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 10 },
  infoConditionsTitre: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  conditionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  conditionEmoji: { fontSize: 16 },
  conditionTexte: { color: '#A8C0DC', fontSize: 13, flex: 1, lineHeight: 20 },
  label: { color: '#8BA4C4', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  champ: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, color: '#FFFFFF', fontSize: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  champMultiline: { height: 120, textAlignVertical: 'top' },
  champReponse: { minHeight: 300, textAlignVertical: 'top' },
  dureeContainer: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  dureeBtn: { flex: 1, minWidth: '22%', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', gap: 4, position: 'relative', overflow: 'hidden' },
  dureeBtnActif: { backgroundColor: 'rgba(74,144,217,0.2)', borderColor: '#4A90D9' },
  dureeEmoji: { fontSize: 20 },
  dureeTexte: { color: '#8BA4C4', fontWeight: '600', fontSize: 12, textAlign: 'center' },
  dureeTexteActif: { color: '#4A90D9' },
  dureeBadge: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 3, backgroundColor: '#4A90D9', borderRadius: 3 },
  bouton: { backgroundColor: '#4A90D9', borderRadius: 12, padding: 16, alignItems: 'center', elevation: 4, marginBottom: 12 },
  boutonDesactive: { backgroundColor: 'rgba(74,144,217,0.3)', elevation: 0 },
  texteBouton: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  boutonAbandon: { padding: 12, alignItems: 'center' },
  boutonAbandonTexte: { color: '#FF5252', fontSize: 13, fontWeight: '600' },
  boutonRetour: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  boutonRetourTexte: { color: '#C8D8EE', fontWeight: '600', fontSize: 14 },
  chronoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 24, paddingBottom: 10, backgroundColor: '#0A1628', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  chronoGauche: { alignItems: 'flex-start' },
  chronoTemps: { fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },
  chronoLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  chronoCentre: { alignItems: 'center', flex: 1 },
  chronoMatiere: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  chronoMotivation: { color: '#8BA4C4', fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginTop: 2 },
  chronoDroit: { alignItems: 'flex-end' },
  chronoEcoule: { color: '#8BA4C4', fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  chronoEcouleLabel: { color: '#4A6080', fontSize: 10, textTransform: 'uppercase' },
  chronoBarreContainer: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', width: '100%' },
  chronoBarre: { height: '100%', borderRadius: 2 },
  sujetContainer: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(74,144,217,0.2)', gap: 10 },
  sujetTitre: { color: '#4A90D9', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  sujetTexte: { color: '#FFFFFF', fontSize: 14, lineHeight: 24 },
  compteurMots: { alignItems: 'flex-end', marginBottom: 16, marginTop: -8 },
  compteurMotsTexte: { color: '#4A6080', fontSize: 12 },
  correctionBanniere: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(76,175,80,0.12)', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(76,175,80,0.3)', gap: 12 },
  correctionBanniereEmoji: { fontSize: 32 },
  correctionBanniereTitre: { color: '#4CAF50', fontSize: 15, fontWeight: '800', marginBottom: 2 },
  correctionBanniereTexte: { color: '#8BA4C4', fontSize: 12 },
  maCopiContainer: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 8 },
  maCopiTitre: { color: '#8BA4C4', fontSize: 12, fontWeight: '700' },
  maCopiTexte: { color: '#C8D8EE', fontSize: 13, lineHeight: 22 },
  correctionContainer: { backgroundColor: 'rgba(74,144,217,0.08)', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', gap: 10 },
  correctionTitre: { color: '#4A90D9', fontSize: 15, fontWeight: '800' },
  correctionDivider: { height: 1, backgroundColor: 'rgba(74,144,217,0.2)' },
  correctionScroll: { maxHeight: 400 },
  correctionTexte: { color: '#C8D8EE', fontSize: 14, lineHeight: 24 },
});
