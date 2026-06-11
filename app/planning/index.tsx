import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, Animated,
    ScrollView,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { API_URL } from '../../utils/config';
import { verifierEtDecrementerQuota } from '../../utils/quota';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const CRENEAUX = ['06h-08h', '08h-10h', '10h-12h', '12h-14h', '14h-16h', '16h-18h', '18h-20h', '20h-22h'];

const CONSEILS_PLANNING = [
  '⚡ Reviser 30 min par jour vaut mieux que 3h le weekend',
  '🧠 Les meilleures heures de revision : 9h-11h et 16h-18h',
  '😴 Ne planifiez rien apres 22h, votre cerveau a besoin de repos',
  '🎯 Alternez les matieres difficiles et faciles',
];

export default function Planning() {
  const router = useRouter();
  const [disponibilites, setDisponibilites] = useState<Record<string, string[]>>({});
  const [matieres, setMatieres] = useState('');
  const [objectifs, setObjectifs] = useState('');
  const [planning, setPlanning] = useState('');
  const [chargement, setChargement] = useState(false);
  const [etape, setEtape] = useState<'saisie' | 'resultat'>('saisie');
  const [conseilIndex, setConseilIndex] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const conseilAnim = useRef(new Animated.Value(1)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const conseilIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    chargerDisponibilitesExistantes();
    animerEntree();
    animerPulsation();
    rotationConseils();
    return () => {
      if (conseilIntervalRef.current) clearInterval(conseilIntervalRef.current);
    };
  }, []);

  const animerEntree = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const animerPulsation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  };

  const rotationConseils = () => {
    conseilIntervalRef.current = setInterval(() => {
      Animated.timing(conseilAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setConseilIndex(prev => (prev + 1) % CONSEILS_PLANNING.length);
        Animated.timing(conseilAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 4000);
  };

  const chargerDisponibilitesExistantes = async () => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    try {
      const docSnap = await getDoc(doc(db, 'utilisateurs', utilisateur.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        const planningSauvegarde = data.planning || {};
        setDisponibilites(planningSauvegarde.disponibilites || {});
        setMatieres(planningSauvegarde.matieres || '');
        setObjectifs(planningSauvegarde.objectifs || '');
        if (planningSauvegarde.texte) {
          setPlanning(planningSauvegarde.texte);
          setEtape('resultat');
          Animated.spring(resultAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
        }
      }
    } catch (e) {}
  };

  const toggleCreneau = (jour: string, creneau: string) => {
    setDisponibilites(prev => {
      const joursDispos = prev[jour] || [];
      if (joursDispos.includes(creneau)) {
        return { ...prev, [jour]: joursDispos.filter(c => c !== creneau) };
      } else {
        return { ...prev, [jour]: [...joursDispos, creneau] };
      }
    });
  };

  const getTotalCreneaux = () => {
    return Object.values(disponibilites).reduce((acc, creneaux) => acc + creneaux.length, 0);
  };

  const getTotalHeures = () => {
    return getTotalCreneaux() * 2;
  };

  const afficherErreurPlanning = (message: string) => {
    setPlanning("Erreur exacte :\n" + message);
    setEtape('resultat');
    Animated.spring(resultAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  };

  const genererPlanning = async () => {
    if (getTotalCreneaux() === 0) {
      Alert.alert('Disponibilites manquantes', 'Selectionnez au moins un creneau disponible ! 😊');
      return;
    }
    if (!matieres.trim()) {
      Alert.alert('Matieres manquantes', 'Entrez les matieres a reviser.');
      return;
    }

    const quota = await verifierEtDecrementerQuota();
    if (!quota.autorise) {
      Alert.alert('⚠️ Quota atteint', quota.message || 'Reessayez demain.');
      return;
    }

    setChargement(true);
    try {
      const utilisateur = auth.currentUser;
      if (utilisateur) {
        try {
          await setDoc(doc(db, 'utilisateurs', utilisateur.uid), {
            planning: {
              disponibilites,
              matieres,
              objectifs,
              derniereGeneration: new Date().toISOString(),
            },
          }, { merge: true });
        } catch {}
      }

      const dispoTexte = Object.entries(disponibilites)
        .filter(([_, creneaux]) => creneaux.length > 0)
        .map(([jour, creneaux]) => `${jour}: ${creneaux.join(', ')}`)
        .join('\n');

      const response = await fetch(`${API_URL}/generer-planning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disponibilites: dispoTexte, matieres, objectifs })
      });
      const data = await response.json();
      if (!response.ok) {
        afficherErreurPlanning(data.erreur || 'Impossible de generer le planning.');
        return;
      }
      setPlanning(data.planning);
      if (utilisateur) {
        try {
          await setDoc(doc(db, 'utilisateurs', utilisateur.uid), {
            planning: {
              disponibilites,
              matieres,
              objectifs,
              texte: data.planning,
              derniereGeneration: new Date().toISOString(),
            },
          }, { merge: true });
        } catch {}
      }
      setEtape('resultat');
      Animated.spring(resultAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      afficherErreurPlanning(message);
    } finally {
      setChargement(false);
    }
  };

  if (etape === 'resultat') {
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => setEtape('saisie')} style={styles.retourBtn}>
            <Text style={styles.retourTexte}>← Modifier</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitre}>Mon Planning</Text>
          <View style={{ width: 70 }} />
        </View>

        <Animated.View style={[styles.resultBanniere, {
          opacity: resultAnim,
          transform: [{ scale: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }]
        }]}>
          <Text style={styles.resultBanniereEmoji}>🎉</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.resultBanniereTitre}>Planning genere !</Text>
            <Text style={styles.resultBanniereTexte}>
              {getTotalHeures()}h de revision planifiees • {matieres.split(',').length} matiere(s)
            </Text>
          </View>
        </Animated.View>

        <View style={styles.planningContainer}>
          <View style={styles.planningHeader}>
            <Text style={styles.planningTitre}>🗓️ Votre emploi du temps</Text>
            <Text style={styles.planningSous}>Genere par AcademiAI</Text>
          </View>
          <View style={styles.planningDivider} />
          <ScrollView style={styles.planningScroll} nestedScrollEnabled showsVerticalScrollIndicator>
            {planning.split('\n').filter(l => l.trim()).map((ligne, i) => {
              const isHeader = ligne.startsWith('##') || ligne.startsWith('#');
              const isDay = ligne.toLowerCase().includes('lundi') || ligne.toLowerCase().includes('mardi') || ligne.toLowerCase().includes('mercredi') || ligne.toLowerCase().includes('jeudi') || ligne.toLowerCase().includes('vendredi') || ligne.toLowerCase().includes('samedi') || ligne.toLowerCase().includes('dimanche');
              const isBullet = ligne.trim().startsWith('-') || ligne.trim().startsWith('•');
              return (
                <View key={i} style={{
                  backgroundColor: isHeader ? 'rgba(74,144,217,0.15)' : isDay ? 'rgba(76,175,80,0.08)' : isBullet ? 'rgba(255,255,255,0.03)' : 'transparent',
                  borderLeftWidth: isDay ? 3 : isHeader ? 3 : 0,
                  borderLeftColor: isDay ? '#4CAF50' : '#4A90D9',
                  borderRadius: 6, padding: isHeader || isDay ? 10 : 6,
                  marginBottom: isHeader ? 8 : 3
                }}>
                  <Text style={{
                    color: isHeader ? '#4A90D9' : isDay ? '#4CAF50' : '#C8D8EE',
                    fontSize: isHeader ? 15 : 13,
                    fontWeight: isHeader || isDay ? '700' : '400',
                    lineHeight: 20
                  }}>
                    {ligne.replace(/^#+\s*/, '').replace(/^\*\*|\*\*$/g, '')}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.conseilFinal}>
          <Text style={styles.conseilFinalTitre}>💡 Conseil pour reussir</Text>
          <Text style={styles.conseilFinalTexte}>
            Respectez ce planning pendant <Text style={{ color: '#4A90D9', fontWeight: 'bold' }}>21 jours</Text> — 
            c est le temps qu il faut pour creer une nouvelle habitude. 
            Apres ca, la revision deviendra naturelle ! 🧠
          </Text>
        </View>

        <TouchableOpacity
          style={styles.bouton}
          onPress={genererPlanning}
          activeOpacity={0.8}
        >
          <Text style={styles.texteBouton}>🔄 Regenerer le planning</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.boutonRetour}
          onPress={() => router.back()}
        >
          <Text style={styles.boutonRetourTexte}>← Retour aux examens</Text>
        </TouchableOpacity>

      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
          <Text style={styles.retourTexte}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitre}>Planning</Text>
        <View style={{ width: 70 }} />
      </Animated.View>

      {/* Bannière */}
      <Animated.View style={[styles.banniere, { opacity: fadeAnim }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.banniereTitre}>Emploi du temps IA 🗓️</Text>
          <Text style={styles.banniereTexte}>
            Selectionnez vos creneaux libres — AcademiAI optimise votre planning !
          </Text>
        </View>
        <Animated.Text style={[{ fontSize: 40 }, { transform: [{ scale: pulseAnim }] }]}>
          🤖
        </Animated.Text>
      </Animated.View>

      {/* Conseil rotatif */}
      <Animated.View style={[styles.conseilContainer, { opacity: conseilAnim }]}>
        <Text style={styles.conseilTexte}>{CONSEILS_PLANNING[conseilIndex]}</Text>
      </Animated.View>

      {/* Stats disponibilités */}
      {getTotalCreneaux() > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statChiffre}>{getTotalCreneaux()}</Text>
            <Text style={styles.statLabel}>creneaux</Text>
          </View>
          <View style={styles.statSeparateur} />
          <View style={styles.statItem}>
            <Text style={styles.statChiffre}>{getTotalHeures()}h</Text>
            <Text style={styles.statLabel}>de revision</Text>
          </View>
          <View style={styles.statSeparateur} />
          <View style={styles.statItem}>
            <Text style={styles.statChiffre}>
              {Object.values(disponibilites).filter(c => c.length > 0).length}
            </Text>
            <Text style={styles.statLabel}>jours actifs</Text>
          </View>
        </View>
      )}

      {/* Grille des disponibilités */}
      <Text style={styles.sectionTitre}>📅 Vos creneaux disponibles</Text>
      <Text style={styles.sectionSous}>Appuyez sur les creneaux ou vous etes libres</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.grilleScroll}>
        <View style={styles.grille}>
          {/* En-tête jours */}
          <View style={styles.grilleHeaderRow}>
            <View style={styles.grilleCelluleVide} />
            {JOURS.map(jour => (
              <View key={jour} style={styles.grilleHeaderCell}>
                <Text style={styles.grilleHeaderTexte}>{jour}</Text>
              </View>
            ))}
          </View>

          {/* Créneaux */}
          {CRENEAUX.map(creneau => (
            <View key={creneau} style={styles.grilleRow}>
              <View style={styles.grilleCreneau}>
                <Text style={styles.grilleCreneauTexte}>{creneau}</Text>
              </View>
              {JOURS.map(jour => {
                const estSelectionne = disponibilites[jour]?.includes(creneau);
                return (
                  <TouchableOpacity
                    key={`${jour}-${creneau}`}
                    style={[styles.grilleCellule, estSelectionne && styles.grilleCelluleActive]}
                    onPress={() => toggleCreneau(jour, creneau)}
                    activeOpacity={0.7}
                  >
                    {estSelectionne && <Text style={styles.grilleCelluleCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Matieres */}
      <Text style={styles.label}>📚 Matieres a reviser *</Text>
      <TextInput
        style={styles.champ}
        placeholder="Ex: Maths, Electronique, Gestion (separees par virgule)"
        placeholderTextColor="#4A6080"
        value={matieres}
        onChangeText={setMatieres}
      />

      {/* Objectifs */}
      <Text style={styles.label}>🎯 Objectifs (optionnel)</Text>
      <TextInput
        style={[styles.champ, styles.champMultiline]}
        placeholder="Ex: Preparer l examen de juin, renforcer les maths..."
        placeholderTextColor="#4A6080"
        value={objectifs}
        onChangeText={setObjectifs}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* Bouton générer */}
      <TouchableOpacity
        style={[styles.bouton, (chargement || getTotalCreneaux() === 0 || !matieres.trim()) && styles.boutonDesactive]}
        onPress={genererPlanning}
        disabled={chargement || getTotalCreneaux() === 0 || !matieres.trim()}
        activeOpacity={0.8}
      >
        {chargement ? (
          <View style={styles.chargementBouton}>
            <ActivityIndicator color="#FFFFFF" size="small" />
            <Text style={styles.texteBouton}>Generation en cours...</Text>
          </View>
        ) : (
          <Text style={styles.texteBouton}>
            🗓️ Generer mon emploi du temps
          </Text>
        )}
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 60, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 20 },
  retourBtn: { width: 70 },
  retourTexte: { color: '#4A90D9', fontSize: 14, fontWeight: '600' },
  headerTitre: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  banniere: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(76,175,80,0.1)', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(76,175,80,0.2)' },
  banniereTitre: { fontSize: 15, fontWeight: 'bold', color: '#4CAF50', marginBottom: 3 },
  banniereTexte: { fontSize: 12, color: '#A8C0DC' },
  conseilContainer: { backgroundColor: 'rgba(255,193,7,0.08)', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,193,7,0.2)' },
  conseilTexte: { color: '#A8C0DC', fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
  statsContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74,144,217,0.1)', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(74,144,217,0.2)' },
  statItem: { flex: 1, alignItems: 'center' },
  statChiffre: { color: '#4A90D9', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#8BA4C4', fontSize: 11 },
  statSeparateur: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
  sectionTitre: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  sectionSous: { color: '#8BA4C4', fontSize: 12, marginBottom: 14 },
  grilleScroll: { marginBottom: 20 },
  grille: { gap: 4 },
  grilleHeaderRow: { flexDirection: 'row', gap: 4, marginBottom: 2 },
  grilleCelluleVide: { width: 60 },
  grilleHeaderCell: { width: 42, alignItems: 'center' },
  grilleHeaderTexte: { color: '#8BA4C4', fontSize: 11, fontWeight: '700' },
  grilleRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  grilleCreneau: { width: 60 },
  grilleCreneauTexte: { color: '#4A6080', fontSize: 10 },
  grilleCellule: { width: 42, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  grilleCelluleActive: { backgroundColor: 'rgba(74,144,217,0.3)', borderColor: '#4A90D9' },
  grilleCelluleCheck: { color: '#4A90D9', fontSize: 14, fontWeight: '800' },
  label: { color: '#8BA4C4', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  champ: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, color: '#FFFFFF', fontSize: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  champMultiline: { height: 90, textAlignVertical: 'top' },
  bouton: { backgroundColor: '#4CAF50', borderRadius: 12, padding: 16, alignItems: 'center', elevation: 4, marginBottom: 12 },
  boutonDesactive: { backgroundColor: 'rgba(76,175,80,0.3)', elevation: 0 },
  texteBouton: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  chargementBouton: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boutonRetour: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  boutonRetourTexte: { color: '#C8D8EE', fontWeight: '600', fontSize: 14 },
  resultBanniere: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(76,175,80,0.12)', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(76,175,80,0.3)' },
  resultBanniereEmoji: { fontSize: 36 },
  resultBanniereTitre: { color: '#4CAF50', fontSize: 16, fontWeight: '800', marginBottom: 3 },
  resultBanniereTexte: { color: '#8BA4C4', fontSize: 12 },
  planningContainer: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 10 },
  planningHeader: { gap: 2 },
  planningTitre: { color: '#4CAF50', fontSize: 15, fontWeight: '800' },
  planningSous: { color: '#8BA4C4', fontSize: 11 },
  planningDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  planningScroll: { maxHeight: 400 },
  planningTexte: { color: '#C8D8EE', fontSize: 14, lineHeight: 24 },
  conseilFinal: { backgroundColor: 'rgba(74,144,217,0.08)', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(74,144,217,0.2)', gap: 6 },
  conseilFinalTitre: { color: '#4A90D9', fontSize: 13, fontWeight: '700' },
  conseilFinalTexte: { color: '#8BA4C4', fontSize: 13, lineHeight: 21 },
});
