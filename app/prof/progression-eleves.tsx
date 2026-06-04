import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated, Easing,
    ScrollView,
    StyleSheet,
    Text, TouchableOpacity,
    View
} from 'react-native';
import { db } from '../../firebaseConfig';
import { API_URL } from '../../utils/config';
import { verifierEtDecrementerQuota } from '../../utils/quota';

interface EtudiantStat {
  id: string;
  nom: string;
  email: string;
  xpTotal: number;
  scoreMoyen: number;
  niveauxDebloques: number;
  derniereActivite: string;
}

const COULEURS_SCORE = (score: number) => {
  if (score >= 80) return '#4CAF50';
  if (score >= 60) return '#FFC107';
  if (score >= 40) return '#FF7043';
  return '#FF5252';
};

export default function ProgressionEleves() {
  const router = useRouter();
  const [onglet, setOnglet] = useState<'classe' | 'fichier'>('classe');
  const [etudiants, setEtudiants] = useState<EtudiantStat[]>([]);
  const [chargement, setChargement] = useState(false);
  const [analyseIA, setAnalyseIA] = useState('');
  const [fichierNom, setFichierNom] = useState('');
  const [fichierContenu, setFichierContenu] = useState('');
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [filtreMinScore, setFiltreMinScore] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const analyseAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef([0,1,2,3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    animerEntree();
    animerPulsation();
    chargerEtudiants();
  }, []);

  const animerEntree = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
    ]).start(() => {
      Animated.stagger(120, cardsAnim.map(a =>
        Animated.spring(a, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true })
      )).start();
    });
  };

  const animerPulsation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  };

  const chargerEtudiants = async () => {
    setChargement(true);
    try {
      const etudiantsSnap = await getDocs(
        query(collection(db, 'utilisateurs'), where('role', '==', 'etudiant'))
      );

      const liste: EtudiantStat[] = [];
      for (const docEtudiant of etudiantsSnap.docs) {
        const data = docEtudiant.data();
        const { getDoc, doc } = await import('firebase/firestore');
        const progSnap = await getDoc(doc(db, 'progression', docEtudiant.id));
        const prog = progSnap.exists() ? progSnap.data() : {};

        const xpTotal = Object.values(prog?.xp || {})
          .reduce((a: any, b: any) => a + (b || 0), 0) as number;
        const scores = Object.values(prog?.scores || {}) as number[];
        const scoreMoyen = scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;

        liste.push({
          id: docEtudiant.id,
          nom: data.nom || 'Inconnu',
          email: data.email || '',
          xpTotal,
          scoreMoyen,
          niveauxDebloques: prog?.niveauxDebloques?.length || 1,
          derniereActivite: prog?.derniereActivite || '',
        });
      }

      liste.sort((a, b) => b.xpTotal - a.xpTotal);
      setEtudiants(liste);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de charger les statistiques.');
    } finally {
      setChargement(false);
    }
  };

  const importerFichier = async () => {
    try {
      const resultat = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv'],
        copyToCacheDirectory: true,
      });

      if (resultat.canceled) return;
      const fichier = resultat.assets[0];
      setFichierNom(fichier.name);

      const response = await fetch(fichier.uri);
      const texte = await response.text();
      setFichierContenu(texte.slice(0, 5000));

      Alert.alert(
        '✅ Fichier importe !',
        `"${fichier.name}" est pret pour l analyse.\n\nAppuyez sur "Analyser avec AcademiAI" pour obtenir les statistiques et recommandations.`
      );
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d importer le fichier.');
    }
  };

  const analyserAvecIA = async (donnees: string, typeDonnees: string) => {
    const quota = await verifierEtDecrementerQuota();
    if (!quota.autorise) {
      Alert.alert('⚠️ Quota atteint', quota.message || 'Reessayez demain.');
      return;
    }

    setAnalyseEnCours(true);
    setAnalyseIA('');
    analyseAnim.setValue(0);

    try {
      const response = await fetch(`${API_URL}/analyser-progression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donnees, typeDonnees })
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert('Erreur', data.erreur || 'Impossible d analyser.');
        return;
      }
      setAnalyseIA(data.analyse);
      Animated.spring(analyseAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    } catch (e) {
      Alert.alert('🔌 Connexion impossible', 'Verifiez que le backend est lance.');
    } finally {
      setAnalyseEnCours(false);
    }
  };

  const analyserClasseEntiere = () => {
    if (etudiants.length === 0) {
      Alert.alert('Aucun etudiant', 'Aucun etudiant inscrit pour le moment.');
      return;
    }
    const donnees = etudiants.map(e =>
      `${e.nom} | Score moyen: ${e.scoreMoyen}% | XP: ${e.xpTotal} | Niveaux: ${e.niveauxDebloques}/4`
    ).join('\n');
    analyserAvecIA(donnees, 'classe_entiere');
  };

  const analyserFichier = () => {
    if (!fichierContenu) {
      Alert.alert('Fichier manquant', 'Importez d abord un fichier a analyser.');
      return;
    }
    analyserAvecIA(fichierContenu, 'fichier_externe');
  };

  const getStatsGlobales = () => {
    if (etudiants.length === 0) return { moyenneClasse: 0, meilleurEleve: '', xpTotal: 0, enDifficulte: 0 };
    const moyenneClasse = Math.round(etudiants.reduce((a, b) => a + b.scoreMoyen, 0) / etudiants.length);
    const meilleurEleve = etudiants[0]?.nom || '';
    const xpTotal = etudiants.reduce((a, b) => a + b.xpTotal, 0);
    const enDifficulte = etudiants.filter(e => e.scoreMoyen < 50).length;
    return { moyenneClasse, meilleurEleve, xpTotal, enDifficulte };
  };

  const statsGlobales = getStatsGlobales();
  const etudiantsFiltres = etudiants.filter(e => e.scoreMoyen >= filtreMinScore);

  const cardStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{
      translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] })
    }]
  });

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
          <Text style={styles.retourTexte}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitre}>Progression</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeTexte}>👥 {etudiants.length}</Text>
        </View>
      </Animated.View>

      {/* Bannière */}
      <Animated.View style={[styles.banniere, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.banniereIcone, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.banniereIconeTexte}>📊</Text>
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={styles.banniereTitre}>Suivi de Classe</Text>
          <Text style={styles.banniereTexte}>
            Analysez la progression de vos etudiants et obtenez des recommandations IA !
          </Text>
        </View>
      </Animated.View>

      {/* Stats globales */}
      {!chargement && etudiants.length > 0 && (
        <Animated.View style={[cardStyle(cardsAnim[0]), styles.statsGlobalesContainer]}>
          {[
            { valeur: `${statsGlobales.moyenneClasse}%`, label: 'Moyenne classe', emoji: '📊', couleur: COULEURS_SCORE(statsGlobales.moyenneClasse) },
            { valeur: etudiants.length.toString(), label: 'Etudiants', emoji: '👥', couleur: '#4A90D9' },
            { valeur: statsGlobales.enDifficulte.toString(), label: 'En difficulte', emoji: '⚠️', couleur: '#FF5252' },
            { valeur: statsGlobales.xpTotal.toString(), label: 'XP classe', emoji: '⚡', couleur: '#FFC107' },
          ].map((stat, i) => (
            <View key={i} style={[styles.statGlobaleCard, { borderColor: stat.couleur + '44' }]}>
              <Text style={styles.statGlobaleEmoji}>{stat.emoji}</Text>
              <Text style={[styles.statGlobaleValeur, { color: stat.couleur }]}>{stat.valeur}</Text>
              <Text style={styles.statGlobaleLabel}>{stat.label}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* Onglets */}
      <View style={styles.onglets}>
        <TouchableOpacity
          style={[styles.onglet, onglet === 'classe' && styles.ongletActif]}
          onPress={() => setOnglet('classe')}
          activeOpacity={0.75}
        >
          <Text style={[styles.ongletTexte, onglet === 'classe' && styles.ongletTexteActif]}>
            👥 Ma classe
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.onglet, onglet === 'fichier' && styles.ongletActif]}
          onPress={() => setOnglet('fichier')}
          activeOpacity={0.75}
        >
          <Text style={[styles.ongletTexte, onglet === 'fichier' && styles.ongletTexteActif]}>
            📎 Fichier externe
          </Text>
        </TouchableOpacity>
      </View>

      {/* Onglet Classe */}
      {onglet === 'classe' && (
        <>
          {chargement ? (
            <View style={styles.chargementContainer}>
              <ActivityIndicator color="#4A90D9" size="large" />
              <Text style={styles.chargementTexte}>Chargement des statistiques...</Text>
            </View>
          ) : (
            <>
              {/* Filtres */}
              <View style={styles.filtresContainer}>
                <Text style={styles.filtresLabel}>Filtre score minimum :</Text>
                <View style={styles.filtresBtns}>
                  {[0, 50, 70, 90].map(seuil => (
                    <TouchableOpacity
                      key={seuil}
                      style={[styles.filtreBtn, filtreMinScore === seuil && styles.filtreBtnActif]}
                      onPress={() => setFiltreMinScore(seuil)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.filtreBtnTexte, filtreMinScore === seuil && styles.filtreBtnTexteActif]}>
                        {seuil === 0 ? 'Tous' : `≥${seuil}%`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Liste étudiants */}
              {etudiantsFiltres.map((etudiant, index) => (
                <Animated.View key={etudiant.id} style={cardStyle(cardsAnim[Math.min(index, 3)])}>
                  <View style={[styles.etudiantCard, { borderColor: COULEURS_SCORE(etudiant.scoreMoyen) + '44' }]}>
                    <View style={styles.etudiantRank}>
                      <Text style={styles.etudiantRankTexte}>#{index + 1}</Text>
                    </View>
                    <View style={[styles.etudiantAvatar, { backgroundColor: COULEURS_SCORE(etudiant.scoreMoyen) + '22' }]}>
                      <Text style={[styles.etudiantAvatarTexte, { color: COULEURS_SCORE(etudiant.scoreMoyen) }]}>
                        {etudiant.nom.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.etudiantInfo}>
                      <Text style={styles.etudiantNom}>{etudiant.nom}</Text>
                      <View style={styles.etudiantStats}>
                        <Text style={styles.etudiantStatItem}>
                          📊 <Text style={{ color: COULEURS_SCORE(etudiant.scoreMoyen) }}>{etudiant.scoreMoyen}%</Text>
                        </Text>
                        <Text style={styles.etudiantStatItem}>
                          ⚡ <Text style={{ color: '#FFC107' }}>{etudiant.xpTotal} XP</Text>
                        </Text>
                        <Text style={styles.etudiantStatItem}>
                          🔓 <Text style={{ color: '#4A90D9' }}>{etudiant.niveauxDebloques}/4</Text>
                        </Text>
                      </View>
                      <View style={styles.etudiantBarre}>
                        <View style={[styles.etudiantBarreRemplissage, {
                          width: `${etudiant.scoreMoyen}%` as any,
                          backgroundColor: COULEURS_SCORE(etudiant.scoreMoyen)
                        }]} />
                      </View>
                    </View>
                    {etudiant.scoreMoyen < 50 && (
                      <View style={styles.alerteBadge}>
                        <Text style={styles.alerteBadgeTexte}>⚠️</Text>
                      </View>
                    )}
                  </View>
                </Animated.View>
              ))}

              {etudiantsFiltres.length === 0 && !chargement && (
                <View style={styles.videContainer}>
                  <Text style={styles.videEmoji}>📭</Text>
                  <Text style={styles.videTexte}>Aucun etudiant avec ce filtre</Text>
                </View>
              )}

              {/* Bouton analyser classe */}
              <TouchableOpacity
                style={[styles.boutonAnalyser, analyseEnCours && styles.boutonDesactive]}
                onPress={analyserClasseEntiere}
                disabled={analyseEnCours}
                activeOpacity={0.8}
              >
                {analyseEnCours ? (
                  <View style={styles.boutonContenu}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.boutonTexte}>AcademiAI analyse...</Text>
                  </View>
                ) : (
                  <View style={styles.boutonContenu}>
                    <Text style={styles.boutonIcone}>🤖</Text>
                    <Text style={styles.boutonTexte}>Analyser la classe avec AcademiAI</Text>
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      {/* Onglet Fichier */}
      {onglet === 'fichier' && (
        <>
          <View style={styles.fichierInfo}>
            <Text style={styles.fichierInfoTitre}>📎 Formats acceptes</Text>
            <Text style={styles.fichierInfoTexte}>
              PDF, Word (.docx), Excel (.xlsx), CSV, Texte (.txt){'\n'}
              Importez vos fichiers de notes, listes d etudiants ou resultats d examens.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.boutonImporter}
            onPress={importerFichier}
            activeOpacity={0.8}
          >
            <Text style={styles.boutonImporterIcone}>📎</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.boutonImporterTexte}>
                {fichierNom || 'Importer un fichier'}
              </Text>
              <Text style={styles.boutonImporterSous}>
                {fichierNom ? '✅ Fichier pret pour analyse' : 'Appuyez pour choisir'}
              </Text>
            </View>
            {fichierNom && <Text style={styles.boutonImporterCheck}>✓</Text>}
          </TouchableOpacity>

          {fichierNom && (
            <TouchableOpacity
              style={[styles.boutonAnalyser, { backgroundColor: '#AB47BC' }, analyseEnCours && styles.boutonDesactive]}
              onPress={analyserFichier}
              disabled={analyseEnCours}
              activeOpacity={0.8}
            >
              {analyseEnCours ? (
                <View style={styles.boutonContenu}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.boutonTexte}>Analyse en cours...</Text>
                </View>
              ) : (
                <View style={styles.boutonContenu}>
                  <Text style={styles.boutonIcone}>🤖</Text>
                  <Text style={styles.boutonTexte}>Analyser "{fichierNom}"</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Résultat analyse IA */}
      {analyseIA !== '' && (
        <Animated.View style={[styles.analyseContainer, {
          opacity: analyseAnim,
          transform: [{ scale: analyseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }]
        }]}>
          <View style={styles.analyseTitreRow}>
            <Animated.Text style={[styles.analyseIcone, { transform: [{ scale: pulseAnim }] }]}>
              🤖
            </Animated.Text>
            <View>
              <Text style={styles.analyseTitre}>Analyse AcademiAI</Text>
              <Text style={styles.analyseSous}>Recommandations personnalisees</Text>
            </View>
          </View>
          <View style={styles.analyseDivider} />
          <ScrollView style={styles.analyseScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <Text style={styles.analyseTexte}>{analyseIA}</Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.analyseRelancer}
            onPress={() => onglet === 'classe' ? analyserClasseEntiere() : analyserFichier()}
            activeOpacity={0.8}
          >
            <Text style={styles.analyseRelancerTexte}>🔄 Relancer l analyse</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 60, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 20 },
  retourBtn: { width: 70 },
  retourTexte: { color: '#4A90D9', fontSize: 14, fontWeight: '600' },
  headerTitre: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  headerBadge: { backgroundColor: 'rgba(74,144,217,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(74,144,217,0.4)' },
  headerBadgeTexte: { color: '#4A90D9', fontSize: 13, fontWeight: '700' },
  banniere: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74,144,217,0.1)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', gap: 12 },
  banniereIcone: { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(74,144,217,0.2)', alignItems: 'center', justifyContent: 'center' },
  banniereIconeTexte: { fontSize: 26 },
  banniereTitre: { color: '#4A90D9', fontSize: 15, fontWeight: '800', marginBottom: 3 },
  banniereTexte: { color: '#A8C0DC', fontSize: 12, lineHeight: 18 },
  statsGlobalesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statGlobaleCard: { flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, gap: 4 },
  statGlobaleEmoji: { fontSize: 20 },
  statGlobaleValeur: { fontSize: 18, fontWeight: '900' },
  statGlobaleLabel: { color: '#8BA4C4', fontSize: 10, textAlign: 'center' },
  onglets: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, marginBottom: 16, gap: 4 },
  onglet: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  ongletActif: { backgroundColor: 'rgba(74,144,217,0.2)', borderWidth: 1, borderColor: 'rgba(74,144,217,0.4)' },
  ongletTexte: { color: '#4A6080', fontSize: 13, fontWeight: '600' },
  ongletTexteActif: { color: '#4A90D9' },
  chargementContainer: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  chargementTexte: { color: '#8BA4C4', fontSize: 14 },
  filtresContainer: { marginBottom: 14, gap: 8 },
  filtresLabel: { color: '#8BA4C4', fontSize: 12, fontWeight: '600' },
  filtresBtns: { flexDirection: 'row', gap: 8 },
  filtreBtn: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filtreBtnActif: { backgroundColor: 'rgba(74,144,217,0.2)', borderColor: '#4A90D9' },
  filtreBtnTexte: { color: '#4A6080', fontSize: 12, fontWeight: '600' },
  filtreBtnTexteActif: { color: '#4A90D9' },
  etudiantCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, gap: 10 },
  etudiantRank: { width: 24, alignItems: 'center' },
  etudiantRankTexte: { color: '#4A6080', fontSize: 11, fontWeight: '700' },
  etudiantAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  etudiantAvatarTexte: { fontSize: 13, fontWeight: '800' },
  etudiantInfo: { flex: 1, gap: 6 },
  etudiantNom: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  etudiantStats: { flexDirection: 'row', gap: 12 },
  etudiantStatItem: { color: '#8BA4C4', fontSize: 11 },
  etudiantBarre: { height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  etudiantBarreRemplissage: { height: '100%', borderRadius: 3 },
  alerteBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,82,82,0.2)', alignItems: 'center', justifyContent: 'center' },
  alerteBadgeTexte: { fontSize: 14 },
  videContainer: { alignItems: 'center', paddingVertical: 30, gap: 10 },
  videEmoji: { fontSize: 40 },
  videTexte: { color: '#8BA4C4', fontSize: 14 },
  boutonAnalyser: { backgroundColor: '#4A90D9', borderRadius: 14, padding: 16, marginVertical: 16, elevation: 4 },
  boutonDesactive: { backgroundColor: 'rgba(74,144,217,0.3)', elevation: 0 },
  boutonContenu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  boutonIcone: { fontSize: 22 },
  boutonTexte: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  fichierInfo: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 6 },
  fichierInfoTitre: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  fichierInfoTexte: { color: '#A8C0DC', fontSize: 13, lineHeight: 20 },
  boutonImporter: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74,144,217,0.1)', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: 'rgba(74,144,217,0.35)', gap: 14 },
  boutonImporterIcone: { fontSize: 28 },
  boutonImporterTexte: { color: '#4A90D9', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  boutonImporterSous: { color: '#8BA4C4', fontSize: 12 },
  boutonImporterCheck: { color: '#4CAF50', fontSize: 22, fontWeight: 'bold' },
  analyseContainer: { backgroundColor: 'rgba(74,144,217,0.08)', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: 'rgba(74,144,217,0.3)', gap: 12 },
  analyseTitreRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  analyseIcone: { fontSize: 32 },
  analyseTitre: { color: '#4A90D9', fontSize: 16, fontWeight: '800' },
  analyseSous: { color: '#8BA4C4', fontSize: 11 },
  analyseDivider: { height: 1, backgroundColor: 'rgba(74,144,217,0.2)' },
  analyseScroll: { maxHeight: 400 },
  analyseTexte: { color: '#C8D8EE', fontSize: 14, lineHeight: 24 },
  analyseRelancer: { backgroundColor: 'rgba(74,144,217,0.15)', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(74,144,217,0.3)' },
  analyseRelancerTexte: { color: '#4A90D9', fontSize: 13, fontWeight: '700' },
});