import Constants from 'expo-constants';
import type * as NotificationsModule from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert, Animated,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

interface ExamenPlanifie {
  id: string;
  matiere: string;
  date: string;
  heure: string;
  programme: string;
  notifId?: string;
}

const MOIS = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];

type NotificationsApi = typeof NotificationsModule;

let notificationsModule: NotificationsApi | null = null;
const notificationsIndisponiblesDansExpoGo = (Constants as { appOwnership?: string }).appOwnership === 'expo';

const getNotifications = async (): Promise<NotificationsApi | null> => {
  if (notificationsIndisponiblesDansExpoGo) return null;
  if (!notificationsModule) {
    notificationsModule = await import('expo-notifications');
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
  return notificationsModule;
};

export default function PlanningExamens() {
  const router = useRouter();
  const [examens, setExamens] = useState<ExamenPlanifie[]>([]);
  const [matiere, setMatiere] = useState('');
  const [date, setDate] = useState('');
  const [heure, setHeure] = useState('08:00');
  const [programme, setProgramme] = useState('');
  const [chargement, setChargement] = useState(false);
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [quizVeilleMatiere, setQuizVeilleMatiere] = useState('');
  const [quizVeilleProgramme, setQuizVeilleProgramme] = useState('');
  const [afficherQuizVeille, setAfficherQuizVeille] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    chargerExamens();
    demanderPermissions();
    animerEntree();
    animerPulsation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  };

  const afficherOuMasquerFormulaire = () => {
    if (afficherFormulaire) {
      Animated.timing(formAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setAfficherFormulaire(false);
      });
    } else {
      setAfficherFormulaire(true);
      Animated.spring(formAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    }
  };

  const demanderPermissions = async () => {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        '🔔 Notifications desactivees',
        'Activez les notifications pour recevoir vos rappels d examens !'
      );
    }
  };

  const chargerExamens = async () => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    try {
      const snap = await getDocs(collection(db, `examens/${utilisateur.uid}/liste`));
      const liste: ExamenPlanifie[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamenPlanifie));
      const aujourd = new Date();
      const futurs = liste
        .filter(e => new Date(e.date) >= aujourd)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setExamens(futurs);
    } catch {}
  };

  const planifierNotification = async (matiere: string, date: string, heure: string) => {
    try {
      const Notifications = await getNotifications();
      if (!Notifications) return null;
      const dateExamen = new Date(date);
      const veille = new Date(dateExamen);
      veille.setDate(veille.getDate() - 1);
      veille.setHours(18, 0, 0, 0);

      if (veille > new Date()) {
        const notifId = await Notifications.scheduleNotificationAsync({
          content: {
            title: '👋 Hey... Demain c est le jour-J !',
            body: `Envoie ton programme de ${matiere} pour qu on se prepare ensemble. 🎓`,
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: veille,
          },
        });
        return notifId;
      }
    } catch {}
    return null;
  };

  const ajouterExamen = async () => {
    if (!matiere.trim() || !date.trim()) {
      Alert.alert('Champs manquants', 'Entrez la matiere et la date.');
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      Alert.alert('Format invalide', 'La date doit etre au format AAAA-MM-JJ\nEx: 2026-06-15');
      return;
    }

    const dateExamen = new Date(date);
    if (dateExamen < new Date()) {
      Alert.alert('Date passee', 'Entrez une date future.');
      return;
    }

    setChargement(true);
    try {
      const utilisateur = auth.currentUser;
      if (!utilisateur) return;

      const notifId = await planifierNotification(matiere, date, heure);

      await addDoc(collection(db, `examens/${utilisateur.uid}/liste`), {
        matiere: matiere.trim(),
        date,
        heure,
        programme: programme.trim(),
        notifId: notifId || '',
        timestamp: serverTimestamp(),
      });

      await chargerExamens();
      setMatiere('');
      setDate('');
      setHeure('08:00');
      setProgramme('');
      afficherOuMasquerFormulaire();

      Alert.alert(
        '✅ Examen planifie !',
        `${matiere} ajouté avec succes !\n\n🔔 Vous recevrez un rappel la veille a 18h00 !`
      );
    } catch {
      Alert.alert('Erreur', 'Impossible d ajouter l examen.');
    } finally {
      setChargement(false);
    }
  };

  const supprimerExamen = async (examen: ExamenPlanifie) => {
    Alert.alert(
      '🗑️ Supprimer ?',
      `Supprimer l examen de ${examen.matiere} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const utilisateur = auth.currentUser;
              if (!utilisateur) return;
              if (examen.notifId) {
                const Notifications = await getNotifications();
                if (Notifications) await Notifications.cancelScheduledNotificationAsync(examen.notifId);
              }
              await deleteDoc(doc(db, `examens/${utilisateur.uid}/liste`, examen.id));
              await chargerExamens();
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer.');
            }
          }
        }
      ]
    );
  };

  const getJoursRestants = (dateStr: string) => {
    const diff = Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getCouleurJours = (jours: number) => {
    if (jours <= 1) return '#FF5252';
    if (jours <= 3) return '#FF7043';
    if (jours <= 7) return '#FFC107';
    return '#4CAF50';
  };

  const lancerQuizVeille = () => {
    if (!quizVeilleMatiere.trim() || !quizVeilleProgramme.trim()) {
      Alert.alert('Informations manquantes', 'Entrez la matiere et votre programme.');
      return;
    }
    router.push({
      pathname: '/quizz' as any,
      params: { coursPrecharge: quizVeilleProgramme, matierePrecharge: quizVeilleMatiere }
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
          <Text style={styles.retourTexte}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitre}>Planning</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeTexte}>📅 {examens.length}</Text>
        </View>
      </Animated.View>

      {/* Bannière */}
      <Animated.View style={[styles.banniere, { opacity: fadeAnim }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.banniereTitre}>Planning des examens 📅</Text>
          <Text style={styles.banniereTexte}>
            Planifiez vos examens et recevez un rappel la veille a 18h00 !
          </Text>
        </View>
        <Animated.Text style={[{ fontSize: 40 }, { transform: [{ scale: pulseAnim }] }]}>
          🔔
        </Animated.Text>
      </Animated.View>

      {/* Info notifications */}
      <View style={styles.infoNotif}>
        <Text style={styles.infoNotifEmoji}>💡</Text>
        <Text style={styles.infoNotifTexte}>
          La veille de chaque examen a <Text style={styles.infoNotifGras}>18h00</Text>, vous recevrez :
          {'\n'}👋 &quot;Hey... Demain c est le jour-J. Envoie ton programme !&quot;
        </Text>
      </View>

      {/* Bouton ajouter */}
      <TouchableOpacity
        style={[styles.boutonAjouter, afficherFormulaire && styles.boutonAjouterActif]}
        onPress={afficherOuMasquerFormulaire}
        activeOpacity={0.8}
      >
        <Text style={styles.boutonAjouterIcone}>{afficherFormulaire ? '✕' : '+'}</Text>
        <Text style={styles.boutonAjouterTexte}>
          {afficherFormulaire ? 'Annuler' : 'Ajouter un examen'}
        </Text>
      </TouchableOpacity>

      {/* Formulaire */}
      {afficherFormulaire && (
        <Animated.View style={[styles.formulaire, {
          opacity: formAnim,
          transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }]
        }]}>
          <Text style={styles.label}>📚 Matiere *</Text>
          <TextInput
            style={styles.champ}
            placeholder="Ex: Electronique, Maths, Gestion..."
            placeholderTextColor="#4A6080"
            value={matiere}
            onChangeText={setMatiere}
          />

          <Text style={styles.label}>📅 Date * (format AAAA-MM-JJ)</Text>
          <TextInput
            style={styles.champ}
            placeholder="Ex: 2026-06-15"
            placeholderTextColor="#4A6080"
            value={date}
            onChangeText={setDate}
            keyboardType="numeric"
          />

          <Text style={styles.label}>🕐 Heure</Text>
          <TextInput
            style={styles.champ}
            placeholder="Ex: 08:00"
            placeholderTextColor="#4A6080"
            value={heure}
            onChangeText={setHeure}
          />

          <Text style={styles.label}>📖 Programme (optionnel)</Text>
          <TextInput
            style={[styles.champ, styles.champMultiline]}
            placeholder="Chapitres a reviser pour le quiz de veille..."
            placeholderTextColor="#4A6080"
            value={programme}
            onChangeText={setProgramme}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.bouton, (!matiere.trim() || !date.trim() || chargement) && styles.boutonDesactive]}
            onPress={ajouterExamen}
            disabled={!matiere.trim() || !date.trim() || chargement}
            activeOpacity={0.8}
          >
            {chargement ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.texteBouton}>✅ Planifier cet examen</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Liste des examens */}
      {examens.length > 0 ? (
        <>
          <Text style={styles.sectionTitre}>📋 Vos examens a venir</Text>
          {examens.map((examen, index) => {
            const jours = getJoursRestants(examen.date);
            const couleur = getCouleurJours(jours);
            const dateObj = new Date(examen.date);
            return (
              <Animated.View
                key={examen.id}
                style={[styles.examenCard, { borderColor: couleur + '55' }]}
              >
                <View style={styles.examenGauche}>
                  <View style={[styles.dateBox, { backgroundColor: couleur + '22', borderColor: couleur + '55' }]}>
                    <Text style={[styles.dateBoxJour, { color: couleur }]}>
                      {dateObj.getDate().toString().padStart(2, '0')}
                    </Text>
                    <Text style={[styles.dateBoxMois, { color: couleur }]}>
                      {MOIS[dateObj.getMonth()]}
                    </Text>
                  </View>
                </View>
                <View style={styles.examenInfo}>
                  <Text style={styles.examenMatiere}>{examen.matiere}</Text>
                  <Text style={styles.examenDate}>
                    {dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} a {examen.heure}
                  </Text>
                  {examen.programme ? (
                    <Text style={styles.examenProgramme} numberOfLines={1}>
                      📖 {examen.programme}
                    </Text>
                  ) : null}
                  <View style={[styles.joursRestantsBadge, { backgroundColor: couleur + '22', borderColor: couleur + '55' }]}>
                    <Text style={[styles.joursRestantsTexte, { color: couleur }]}>
                      {jours <= 0 ? '🔥 AUJOURD HUI !'
                        : jours === 1 ? '⚡ DEMAIN !'
                        : `⏰ J-${jours}`}
                    </Text>
                  </View>
                </View>
                <View style={styles.examenActions}>
                  <TouchableOpacity
                    style={styles.boutonQuizVeille}
                    onPress={() => {
                      setQuizVeilleMatiere(examen.matiere);
                      setQuizVeilleProgramme(examen.programme || '');
                      setAfficherQuizVeille(true);
                    }}
                  >
                    <Text style={styles.boutonQuizVeilleTexte}>🧠</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.boutonSupprimer}
                    onPress={() => supprimerExamen(examen)}
                  >
                    <Text style={styles.boutonSupprimerTexte}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            );
          })}
        </>
      ) : (
        <View style={styles.videContainer}>
          <Text style={styles.videEmoji}>📭</Text>
          <Text style={styles.videTitre}>Aucun examen planifie</Text>
          <Text style={styles.videTexte}>
            Ajoutez vos examens pour ne jamais etre pris de court ! 🎯
          </Text>
        </View>
      )}

      {/* Quiz de veille */}
      {afficherQuizVeille && (
        <View style={styles.quizVeilleContainer}>
          <Text style={styles.quizVeilleTitre}>🧠 Quiz de veille</Text>
          <Text style={styles.quizVeilleTexte}>
            Generez jusqu a 50 questions ciblees sur votre programme !
          </Text>

          <Text style={styles.label}>📚 Matiere</Text>
          <TextInput
            style={styles.champ}
            value={quizVeilleMatiere}
            onChangeText={setQuizVeilleMatiere}
            placeholderTextColor="#4A6080"
          />

          <Text style={styles.label}>📖 Programme a reviser</Text>
          <TextInput
            style={[styles.champ, styles.champMultiline]}
            placeholder="Entrez les chapitres et notions a reviser..."
            placeholderTextColor="#4A6080"
            value={quizVeilleProgramme}
            onChangeText={setQuizVeilleProgramme}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.bouton, { backgroundColor: '#AB47BC' }]}
            onPress={lancerQuizVeille}
            activeOpacity={0.8}
          >
            <Text style={styles.texteBouton}>⚡ Lancer le quiz de veille</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.boutonFermer}
            onPress={() => setAfficherQuizVeille(false)}
          >
            <Text style={styles.boutonFermerTexte}>Fermer</Text>
          </TouchableOpacity>
        </View>
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
  headerBadge: { backgroundColor: 'rgba(255,193,7,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,193,7,0.4)' },
  headerBadgeTexte: { color: '#FFC107', fontSize: 13, fontWeight: '700' },
  banniere: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,193,7,0.08)', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,193,7,0.25)', gap: 12 },
  banniereTitre: { fontSize: 15, fontWeight: 'bold', color: '#FFC107', marginBottom: 4 },
  banniereTexte: { fontSize: 12, color: '#A8C0DC' },
  infoNotif: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(74,144,217,0.08)', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(74,144,217,0.2)', gap: 10 },
  infoNotifEmoji: { fontSize: 18 },
  infoNotifTexte: { flex: 1, color: '#A8C0DC', fontSize: 12, lineHeight: 20 },
  infoNotifGras: { color: '#4A90D9', fontWeight: 'bold' },
  boutonAjouter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(74,144,217,0.15)', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: 'rgba(74,144,217,0.4)', gap: 8 },
  boutonAjouterActif: { backgroundColor: 'rgba(255,82,82,0.12)', borderColor: 'rgba(255,82,82,0.4)' },
  boutonAjouterIcone: { color: '#4A90D9', fontSize: 20, fontWeight: '900' },
  boutonAjouterTexte: { color: '#4A90D9', fontSize: 15, fontWeight: '700' },
  formulaire: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 4 },
  label: { color: '#8BA4C4', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  champ: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, color: '#FFFFFF', fontSize: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  champMultiline: { height: 100, textAlignVertical: 'top' },
  bouton: { backgroundColor: '#4A90D9', borderRadius: 12, padding: 16, alignItems: 'center', elevation: 4 },
  boutonDesactive: { backgroundColor: 'rgba(74,144,217,0.3)', elevation: 0 },
  texteBouton: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  sectionTitre: { color: '#8BA4C4', fontSize: 12, fontWeight: '700', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1.5 },
  examenCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, gap: 12 },
  examenGauche: { flexShrink: 0 },
  dateBox: { alignItems: 'center', borderRadius: 12, padding: 10, borderWidth: 1, minWidth: 50 },
  dateBoxJour: { fontSize: 22, fontWeight: '900' },
  dateBoxMois: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  examenInfo: { flex: 1, gap: 4 },
  examenMatiere: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  examenDate: { color: '#8BA4C4', fontSize: 11 },
  examenProgramme: { color: '#4A6080', fontSize: 11 },
  joursRestantsBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, marginTop: 4 },
  joursRestantsTexte: { fontSize: 11, fontWeight: '700' },
  examenActions: { gap: 8 },
  boutonQuizVeille: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(171,71,188,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(171,71,188,0.4)' },
  boutonQuizVeilleTexte: { fontSize: 18 },
  boutonSupprimer: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,82,82,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,82,82,0.3)' },
  boutonSupprimerTexte: { fontSize: 16 },
  videContainer: { alignItems: 'center', paddingTop: 40, gap: 12 },
  videEmoji: { fontSize: 56 },
  videTitre: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  videTexte: { color: '#8BA4C4', fontSize: 13, textAlign: 'center' },
  quizVeilleContainer: { backgroundColor: 'rgba(171,71,188,0.08)', borderRadius: 16, padding: 18, marginTop: 20, borderWidth: 1, borderColor: 'rgba(171,71,188,0.3)', gap: 8 },
  quizVeilleTitre: { color: '#AB47BC', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  quizVeilleTexte: { color: '#A8C0DC', fontSize: 13, marginBottom: 8 },
  boutonFermer: { alignItems: 'center', padding: 10 },
  boutonFermerTexte: { color: '#4A6080', fontSize: 13 },
});
 
