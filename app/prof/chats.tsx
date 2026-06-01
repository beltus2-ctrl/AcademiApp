import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, addDoc, serverTimestamp,
  getDocs, getDoc
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

interface Appel {
  id: string;
  etudiantNom: string;
  etudiantId: string;
  timestamp: any;
  statut: string;
  type: string;
}

interface ChatActif {
  id: string;
  type: 'prive' | 'groupe';
  titre: string;
  participants: string[];
  participantsNoms: string[];
  dernierMessage: string;
  timestamp: any;
  ferme: boolean;
}

export default function ProfChats() {
  const router = useRouter();
  const [appels, setAppels] = useState<Appel[]>([]);
  const [chats, setChats] = useState<ChatActif[]>([]);
  const [chargement, setChargement] = useState(true);
  const [profil, setProfil] = useState<any>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const appulAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    chargerProfil();
    animerEntree();
    animerPulsation();
  }, []);

  useEffect(() => {
    if (profil) {
      const unsubAppels = ecouterAppels();
      const unsubChats = ecouterChats();
      return () => {
        unsubAppels();
        unsubChats();
      };
    }
  }, [profil]);

  useEffect(() => {
    if (appels.length > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(appulAnim, { toValue: 1.12, duration: 300, useNativeDriver: true }),
          Animated.timing(appulAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(appulAnim, { toValue: 1.12, duration: 300, useNativeDriver: true }),
          Animated.timing(appulAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [appels]);

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

  const chargerProfil = async () => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    try {
      const docSnap = await getDoc(doc(db, 'utilisateurs', utilisateur.uid));
      if (docSnap.exists()) setProfil(docSnap.data());
    } catch (e) {}
  };

  const ecouterAppels = () => {
    const q = query(
      collection(db, 'appels'),
      where('statut', '==', 'en_attente')
    );
    return onSnapshot(
      q,
      snap => {
        const liste: Appel[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appel));
        setAppels(liste);
        setChargement(false);
      },
      () => {
        setChargement(false);
      }
    );
  };

  const ecouterChats = () => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return () => {};
    const q = query(
      collection(db, 'profChats'),
      where('profId', '==', utilisateur.uid),
      where('ferme', '==', false)
    );
    return onSnapshot(
      q,
      snap => {
        const liste: ChatActif[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatActif));
        setChats(liste.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
      },
      () => {}
    );
  };

  const accepterAppelPrive = async (appel: Appel) => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    try {
      await updateDoc(doc(db, 'appels', appel.id), { statut: 'accepte' });

      const chatExistant = chats.find(c =>
        c.type === 'prive' && c.participants.includes(appel.etudiantId)
      );

      if (chatExistant) {
        router.push({
          pathname: '/prof/chat-room' as any,
          params: { chatId: chatExistant.id, titre: chatExistant.titre }
        });
        return;
      }

      const nouveauChat = await addDoc(collection(db, 'profChats'), {
        profId: utilisateur.uid,
        profNom: profil?.nom || 'Professeur',
        type: 'prive',
        titre: `Chat avec ${appel.etudiantNom}`,
        participants: [utilisateur.uid, appel.etudiantId],
        participantsNoms: [profil?.nom || 'Professeur', appel.etudiantNom],
        dernierMessage: 'Chat ouvert',
        ferme: false,
        timestamp: serverTimestamp(),
      });

      await addDoc(collection(db, `profChats/${nouveauChat.id}/messages`), {
        texte: `Bonjour ${appel.etudiantNom} ! Je suis disponible pour vous aider. Comment puis-je vous assister ? 😊`,
        auteur: profil?.nom || 'Professeur',
        auteurId: utilisateur.uid,
        role: 'professeur',
        timestamp: serverTimestamp(),
        type: 'texte',
      });

      router.push({
        pathname: '/prof/chat-room' as any,
        params: { chatId: nouveauChat.id, titre: `Chat avec ${appel.etudiantNom}` }
      });
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d ouvrir le chat.');
    }
  };

  const verifierGroupePossible = async (appel: Appel) => {
    const appelsEnAttente = appels.filter(a => a.id !== appel.id);
    if (appelsEnAttente.length > 0) {
      Alert.alert(
        '👥 Creer un groupe ?',
        `Il y a ${appelsEnAttente.length + 1} etudiant(s) qui vous sollicitent.\n\nVoulez-vous les reunir dans un groupe d apprentissage ?`,
        [
          { text: 'Chat prive', onPress: () => accepterAppelPrive(appel) },
          { text: 'Creer un groupe', onPress: () => creerGroupe(appel, appelsEnAttente) },
        ]
      );
    } else {
      accepterAppelPrive(appel);
    }
  };

  const creerGroupe = async (appelPrincipal: Appel, autresAppels: Appel[]) => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    try {
      const tousAppels = [appelPrincipal, ...autresAppels];
      const participantsIds = [utilisateur.uid, ...tousAppels.map(a => a.etudiantId)];
      const participantsNoms = [profil?.nom || 'Professeur', ...tousAppels.map(a => a.etudiantNom)];

      for (const appel of tousAppels) {
        await updateDoc(doc(db, 'appels', appel.id), { statut: 'accepte' });
      }

      const nouveauGroupe = await addDoc(collection(db, 'profChats'), {
        profId: utilisateur.uid,
        profNom: profil?.nom || 'Professeur',
        type: 'groupe',
        titre: `Groupe - ${profil?.nom || 'Professeur'}`,
        participants: participantsIds,
        participantsNoms,
        dernierMessage: 'Groupe cree',
        ferme: false,
        timestamp: serverTimestamp(),
      });

      await addDoc(collection(db, `profChats/${nouveauGroupe.id}/messages`), {
        texte: `👋 Bienvenue dans ce groupe d apprentissage ! Je suis votre professeur et je suis disponible pour repondre a vos questions. N hesitez pas ! 🎓`,
        auteur: profil?.nom || 'Professeur',
        auteurId: utilisateur.uid,
        role: 'professeur',
        timestamp: serverTimestamp(),
        type: 'systeme',
      });

      router.push({
        pathname: '/prof/chat-room' as any,
        params: { chatId: nouveauGroupe.id, titre: `Groupe d apprentissage` }
      });
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de creer le groupe.');
    }
  };

  const refuserAppel = async (appel: Appel) => {
    Alert.alert(
      'Refuser l appel ?',
      `Refuser la demande de ${appel.etudiantNom} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            await updateDoc(doc(db, 'appels', appel.id), { statut: 'refuse' });
          }
        }
      ]
    );
  };

  const formaterHeure = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
          <Text style={styles.retourTexte}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitre}>Mes Chats</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeTexte}>{chats.length + appels.length}</Text>
        </View>
      </Animated.View>

      {/* Appels en attente */}
      {appels.length > 0 && (
        <Animated.View style={[styles.appelsSection, { opacity: fadeAnim }]}>
          <View style={styles.appelsSectionHeader}>
            <Animated.View style={[styles.appelsIcone, { transform: [{ scale: appulAnim }] }]}>
              <Text style={styles.appelsIconeTexte}>📞</Text>
            </Animated.View>
            <Text style={styles.appelsSectionTitre}>
              {appels.length} appel(s) en attente !
            </Text>
          </View>

          {appels.map(appel => (
            <View key={appel.id} style={styles.appelCard}>
              <View style={styles.appelAvatar}>
                <Text style={styles.appelAvatarTexte}>
                  {appel.etudiantNom?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'ET'}
                </Text>
              </View>
              <View style={styles.appelInfo}>
                <Text style={styles.appelNom}>{appel.etudiantNom}</Text>
                <Text style={styles.appelTemps}>Demande d aide • {formaterHeure(appel.timestamp)}</Text>
              </View>
              <View style={styles.appelActions}>
                <TouchableOpacity
                  style={styles.boutonAccepter}
                  onPress={() => verifierGroupePossible(appel)}
                >
                  <Text style={styles.boutonAccepterTexte}>✓ Repondre</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.boutonRefuser}
                  onPress={() => refuserAppel(appel)}
                >
                  <Text style={styles.boutonRefuserTexte}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </Animated.View>
      )}

      {/* Chats actifs */}
      <Text style={styles.sectionTitre}>
        💬 Chats actifs ({chats.length})
      </Text>

      {chargement ? (
        <ActivityIndicator color="#4A90D9" style={{ marginTop: 20 }} />
      ) : chats.length === 0 ? (
        <View style={styles.videContainer}>
          <Text style={styles.videEmoji}>💬</Text>
          <Text style={styles.videTitre}>Aucun chat actif</Text>
          <Text style={styles.videTexte}>
            Acceptez un appel d etudiant pour demarrer un chat !
          </Text>
        </View>
      ) : (
        chats.map(chat => (
          <TouchableOpacity
            key={chat.id}
            style={styles.chatCard}
            onPress={() => router.push({
              pathname: '/prof/chat-room' as any,
              params: { chatId: chat.id, titre: chat.titre }
            })}
            activeOpacity={0.75}
          >
            <View style={[styles.chatAvatar, {
              backgroundColor: chat.type === 'groupe' ? 'rgba(171,71,188,0.2)' : 'rgba(74,144,217,0.2)'
            }]}>
              <Text style={styles.chatAvatarTexte}>
                {chat.type === 'groupe' ? '👥' : '👤'}
              </Text>
            </View>
            <View style={styles.chatInfo}>
              <View style={styles.chatTitreRow}>
                <Text style={styles.chatTitre}>{chat.titre}</Text>
                <View style={[styles.chatTypeBadge, {
                  backgroundColor: chat.type === 'groupe' ? 'rgba(171,71,188,0.2)' : 'rgba(74,144,217,0.2)',
                  borderColor: chat.type === 'groupe' ? '#AB47BC55' : '#4A90D955'
                }]}>
                  <Text style={[styles.chatTypeBadgeTexte, {
                    color: chat.type === 'groupe' ? '#AB47BC' : '#4A90D9'
                  }]}>
                    {chat.type === 'groupe' ? '👥 Groupe' : '👤 Prive'}
                  </Text>
                </View>
              </View>
              <Text style={styles.chatParticipants}>
                {chat.participantsNoms.filter(n => n !== profil?.nom).join(', ')}
              </Text>
              <Text style={styles.chatDernierMessage} numberOfLines={1}>
                {chat.dernierMessage}
              </Text>
            </View>
            <Text style={styles.chatFleche}>→</Text>
          </TouchableOpacity>
        ))
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
  headerBadge: { backgroundColor: 'rgba(74,144,217,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(74,144,217,0.4)', minWidth: 30, alignItems: 'center' },
  headerBadgeTexte: { color: '#4A90D9', fontSize: 13, fontWeight: '700' },
  appelsSection: { backgroundColor: 'rgba(255,82,82,0.08)', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1.5, borderColor: 'rgba(255,82,82,0.35)', gap: 10 },
  appelsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appelsIcone: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,82,82,0.2)', alignItems: 'center', justifyContent: 'center' },
  appelsIconeTexte: { fontSize: 20 },
  appelsSectionTitre: { color: '#FF5252', fontSize: 15, fontWeight: '800' },
  appelCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 12, gap: 10 },
  appelAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(74,144,217,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  appelAvatarTexte: { color: '#4A90D9', fontSize: 12, fontWeight: '800' },
  appelInfo: { flex: 1 },
  appelNom: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  appelTemps: { color: '#8BA4C4', fontSize: 11 },
  appelActions: { flexDirection: 'row', gap: 8 },
  boutonAccepter: { backgroundColor: 'rgba(76,175,80,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)' },
  boutonAccepterTexte: { color: '#4CAF50', fontSize: 11, fontWeight: '700' },
  boutonRefuser: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,82,82,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,82,82,0.4)' },
  boutonRefuserTexte: { color: '#FF5252', fontSize: 14, fontWeight: '800' },
  sectionTitre: { color: '#8BA4C4', fontSize: 12, fontWeight: '700', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1.5 },
  videContainer: { alignItems: 'center', paddingTop: 40, gap: 12 },
  videEmoji: { fontSize: 56 },
  videTitre: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  videTexte: { color: '#8BA4C4', fontSize: 13, textAlign: 'center' },
  chatCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12 },
  chatAvatar: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chatAvatarTexte: { fontSize: 22 },
  chatInfo: { flex: 1, gap: 4 },
  chatTitreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chatTitre: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  chatTypeBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  chatTypeBadgeTexte: { fontSize: 10, fontWeight: '700' },
  chatParticipants: { color: '#8BA4C4', fontSize: 12 },
  chatDernierMessage: { color: '#4A6080', fontSize: 11 },
  chatFleche: { color: '#4A90D9', fontSize: 18, fontWeight: 'bold' },
});
