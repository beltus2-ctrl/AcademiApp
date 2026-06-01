import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    addDoc,
    arrayRemove,
    collection,
    doc, getDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert,
    Animated,
    FlatList, KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';

interface Message {
  id: string;
  texte: string;
  auteur: string;
  auteurId: string;
  role: string;
  timestamp: any;
  type: string;
  supprime?: boolean;
}

interface Participant {
  id: string;
  nom: string;
  role: string;
}

export default function ProfChatRoom() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomSafePadding = Math.max(insets.bottom + 8, 24);
  const params = useLocalSearchParams();
  const chatId = params.chatId as string;
  const titre = params.titre as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [nouveauMessage, setNouveauMessage] = useState('');
  const [profil, setProfil] = useState<any>(null);
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [estProf, setEstProf] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const envoyerAnim = useRef(new Animated.Value(1)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    chargerProfil();
    chargerChatInfo();
    const unsub = ecouterMessages();
    animerEntree();
    return unsub;
  }, []);

  const animerEntree = () => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  const ouvrirModal = () => {
    setShowOptions(true);
    Animated.spring(modalAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  };

  const fermerModal = () => {
    Animated.timing(modalAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowOptions(false);
    });
  };

  const chargerProfil = async () => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    try {
      const docSnap = await getDoc(doc(db, 'utilisateurs', utilisateur.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfil(data);
        setEstProf(data.role === 'professeur' || data.role === 'admin');
      }
    } catch (e) {}
  };

  const chargerChatInfo = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'profChats', chatId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChatInfo(data);
        const participantsData: Participant[] = (data.participantsNoms || []).map(
          (nom: string, i: number) => ({
            id: data.participants?.[i] || '',
            nom,
            role: i === 0 ? 'professeur' : 'etudiant'
          })
        );
        setParticipants(participantsData);
      }
    } catch (e) {}
  };

  const ecouterMessages = () => {
    const q = query(
      collection(db, `profChats/${chatId}/messages`),
      orderBy('timestamp', 'asc')
    );
    return onSnapshot(
      q,
      snap => {
        const msgs: Message[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
        setMessages(msgs);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      },
      () => {}
    );
  };

  const envoyerMessage = async () => {
    if (!nouveauMessage.trim() || !profil || envoi) return;
    const texte = nouveauMessage.trim();
    setNouveauMessage('');
    setEnvoi(true);

    Animated.sequence([
      Animated.timing(envoyerAnim, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(envoyerAnim, { toValue: 1, tension: 200, friction: 5, useNativeDriver: true }),
    ]).start();

    try {
      await addDoc(collection(db, `profChats/${chatId}/messages`), {
        texte,
        auteur: profil.nom,
        auteurId: auth.currentUser?.uid,
        role: profil.role,
        timestamp: serverTimestamp(),
        type: 'texte',
        supprime: false,
      });

      await updateDoc(doc(db, 'profChats', chatId), {
        dernierMessage: texte,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d envoyer le message.');
      setNouveauMessage(texte);
    } finally {
      setEnvoi(false);
    }
  };

  const supprimerMessage = async (message: Message) => {
    if (!estProf) return;
    Alert.alert(
      '🗑️ Supprimer ce message ?',
      'Ce message sera marque comme supprime.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, `profChats/${chatId}/messages`, message.id), {
                texte: '[Message supprime par le professeur]',
                supprime: true,
              });
            } catch (e) {}
          }
        }
      ]
    );
  };

  const exclureParticipant = async (participant: Participant) => {
    if (!estProf || participant.role === 'professeur') return;
    Alert.alert(
      '🚫 Exclure ce participant ?',
      `Exclure ${participant.nom} de ce chat ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Exclure',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'profChats', chatId), {
                participants: arrayRemove(participant.id),
                participantsNoms: arrayRemove(participant.nom),
              });

              await addDoc(collection(db, `profChats/${chatId}/messages`), {
                texte: `⚠️ ${participant.nom} a ete exclu de ce chat par le professeur.`,
                auteur: 'Systeme',
                auteurId: 'systeme',
                role: 'systeme',
                timestamp: serverTimestamp(),
                type: 'systeme',
                supprime: false,
              });

              await chargerChatInfo();
              setShowParticipants(false);
              fermerModal();
            } catch (e) {
              Alert.alert('Erreur', 'Impossible d exclure ce participant.');
            }
          }
        }
      ]
    );
  };

  const fermerChat = async () => {
    if (!estProf) return;
    Alert.alert(
      '🔒 Fermer ce chat ?',
      'Personne ne pourra plus envoyer de messages dans ce chat.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Fermer le chat',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'profChats', chatId), { ferme: true });
              await addDoc(collection(db, `profChats/${chatId}/messages`), {
                texte: '🔒 Ce chat a ete ferme par le professeur. Merci pour cette session d apprentissage !',
                auteur: 'Systeme',
                auteurId: 'systeme',
                role: 'systeme',
                timestamp: serverTimestamp(),
                type: 'systeme',
                supprime: false,
              });
              fermerModal();
              router.back();
            } catch (e) {
              Alert.alert('Erreur', 'Impossible de fermer le chat.');
            }
          }
        }
      ]
    );
  };

  const modifierTitreChat = () => {
    fermerModal();
    Alert.prompt(
      '✏️ Modifier le titre',
      'Entrez le nouveau titre du groupe',
      async (nouveauTitre) => {
        if (!nouveauTitre?.trim()) return;
        try {
          await updateDoc(doc(db, 'profChats', chatId), { titre: nouveauTitre.trim() });
          await addDoc(collection(db, `profChats/${chatId}/messages`), {
            texte: `✏️ Le titre du groupe a ete change en "${nouveauTitre.trim()}"`,
            auteur: 'Systeme',
            auteurId: 'systeme',
            role: 'systeme',
            timestamp: serverTimestamp(),
            type: 'systeme',
            supprime: false,
          });
          await chargerChatInfo();
        } catch (e) {}
      },
      'plain-text',
      chatInfo?.titre || titre
    );
  };

  const formaterHeure = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const estMoi = item.auteurId === auth.currentUser?.uid;
    const estSysteme = item.type === 'systeme';
    const messagePrec = messages[index - 1];
    const memeAuteur = messagePrec?.auteurId === item.auteurId;

    if (estSysteme) {
      return (
        <View style={styles.messageSysteme}>
          <Text style={styles.messageSystemeTexte}>{item.texte}</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        onLongPress={() => {
          if (estProf && !estMoi) {
            Alert.alert(
              '⚙️ Options',
              `Message de ${item.auteur}`,
              [
                { text: 'Supprimer', style: 'destructive', onPress: () => supprimerMessage(item) },
                { text: 'Annuler', style: 'cancel' }
              ]
            );
          }
        }}
        activeOpacity={0.8}
      >
        <View style={[
          styles.messageWrapper,
          estMoi ? styles.messageWrapperDroite : styles.messageWrapperGauche,
          memeAuteur && { marginTop: 2 }
        ]}>
          {!estMoi && !memeAuteur && (
            <View style={[
              styles.avatar,
              item.role === 'professeur' && styles.avatarProf
            ]}>
              <Text style={styles.avatarTexte}>
                {item.auteur?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          {!estMoi && memeAuteur && <View style={styles.avatarEspaceur} />}

          <View style={styles.messageBulle}>
            {!estMoi && !memeAuteur && (
              <View style={styles.messageAuteurRow}>
                <Text style={[
                  styles.messageAuteur,
                  item.role === 'professeur' && { color: '#FFC107' }
                ]}>
                  {item.auteur}
                </Text>
                {item.role === 'professeur' && (
                  <View style={styles.profBadge}>
                    <Text style={styles.profBadgeTexte}>👨‍🏫 Prof</Text>
                  </View>
                )}
              </View>
            )}
            <View style={[
              styles.messageBulleInterne,
              estMoi ? styles.messageBulleMoi
                : item.role === 'professeur' ? styles.messageBulleProf
                : styles.messageBulleAutre,
              item.supprime && styles.messageBulleSupprime
            ]}>
              <Text style={[
                styles.messageTexte,
                estMoi ? { color: '#FFFFFF' } : { color: '#E8F0FE' },
                item.supprime && { color: '#4A6080', fontStyle: 'italic' }
              ]}>
                {item.texte}
              </Text>
            </View>
            <Text style={[styles.messageHeure, estMoi && { textAlign: 'right' }]}>
              {formaterHeure(item.timestamp)}
              {estMoi && <Text style={{ color: '#4A90D9' }}> ✓✓</Text>}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const chatFerme = chatInfo?.ferme;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
          <Text style={styles.retourTexte}>← Retour</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerCentre}
          onPress={() => setShowParticipants(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.headerAvatar, {
            backgroundColor: chatInfo?.type === 'groupe'
              ? 'rgba(171,71,188,0.2)' : 'rgba(74,144,217,0.2)'
          }]}>
            <Text style={styles.headerAvatarTexte}>
              {chatInfo?.type === 'groupe' ? '👥' : '👤'}
            </Text>
          </View>
          <View>
            <Text style={styles.headerTitre} numberOfLines={1}>
              {chatInfo?.titre || titre}
            </Text>
            <Text style={styles.headerSous}>
              {participants.length} participant(s) • Appuyez pour voir
            </Text>
          </View>
        </TouchableOpacity>

        {estProf && (
          <TouchableOpacity style={styles.optionsBtn} onPress={ouvrirModal}>
            <Text style={styles.optionsBtnTexte}>⚙️</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Bannière chat fermé */}
      {chatFerme && (
        <View style={styles.chatFermeBanniere}>
          <Text style={styles.chatFermeTexte}>🔒 Ce chat est ferme</Text>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listeMessages}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.videContainer}>
            <Text style={styles.videEmoji}>💬</Text>
            <Text style={styles.videTitre}>Demarrez la conversation !</Text>
          </View>
        }
      />

      {/* Zone saisie */}
      {!chatFerme && (
        <View style={[styles.saisieContainer, { paddingBottom: bottomSafePadding }]}>
          <TextInput
            style={styles.champSaisie}
            placeholder={estProf ? 'Ecrivez votre reponse...' : 'Posez votre question...'}
            placeholderTextColor="#4A6080"
            value={nouveauMessage}
            onChangeText={setNouveauMessage}
            multiline
            maxLength={500}
          />
          <Animated.View style={{ transform: [{ scale: envoyerAnim }] }}>
            <TouchableOpacity
              style={[styles.boutonEnvoyer, (!nouveauMessage.trim() || envoi) && styles.boutonEnvoyerDesactive]}
              onPress={envoyerMessage}
              disabled={!nouveauMessage.trim() || envoi}
              activeOpacity={0.8}
            >
              {envoi ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.boutonEnvoyerIcone}>➤</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* Modal options professeur */}
      <Modal visible={showOptions} transparent animationType="none">
        <TouchableOpacity style={styles.modalOverlay} onPress={fermerModal} activeOpacity={1}>
          <Animated.View style={[styles.modalContainer, {
            opacity: modalAnim,
            transform: [{ scale: modalAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }]
          }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitre}>⚙️ Options du chat</Text>
              <Text style={styles.modalSous}>Pouvoirs du professeur</Text>
            </View>

            {chatInfo?.type === 'groupe' && (
              <TouchableOpacity style={styles.modalOption} onPress={modifierTitreChat}>
                <Text style={styles.modalOptionEmoji}>✏️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalOptionTitre}>Modifier le titre</Text>
                  <Text style={styles.modalOptionSous}>Changer le nom de ce groupe</Text>
                </View>
                <Text style={styles.modalOptionFleche}>→</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                fermerModal();
                setShowParticipants(true);
              }}
            >
              <Text style={styles.modalOptionEmoji}>👥</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalOptionTitre}>Gerer les participants</Text>
                <Text style={styles.modalOptionSous}>Voir et exclure des participants</Text>
              </View>
              <Text style={styles.modalOptionFleche}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.modalOption, styles.modalOptionDanger]} onPress={fermerChat}>
              <Text style={styles.modalOptionEmoji}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalOptionTitre, { color: '#FF5252' }]}>Fermer le chat</Text>
                <Text style={styles.modalOptionSous}>Aucun message ne pourra plus etre envoye</Text>
              </View>
              <Text style={[styles.modalOptionFleche, { color: '#FF5252' }]}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalAnnuler} onPress={fermerModal}>
              <Text style={styles.modalAnnulerTexte}>Annuler</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Modal participants */}
      <Modal visible={showParticipants} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.participantsContainer}>
            <View style={styles.participantsHeader}>
              <Text style={styles.participantsTitre}>
                👥 Participants ({participants.length})
              </Text>
              <TouchableOpacity onPress={() => setShowParticipants(false)}>
                <Text style={styles.participantsFermer}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {participants.map((participant, i) => (
                <View key={i} style={styles.participantItem}>
                  <View style={[styles.participantAvatar, {
                    backgroundColor: participant.role === 'professeur'
                      ? 'rgba(255,193,7,0.2)' : 'rgba(74,144,217,0.2)'
                  }]}>
                    <Text style={[styles.participantAvatarTexte, {
                      color: participant.role === 'professeur' ? '#FFC107' : '#4A90D9'
                    }]}>
                      {participant.nom?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.participantNom}>{participant.nom}</Text>
                    <Text style={[styles.participantRole, {
                      color: participant.role === 'professeur' ? '#FFC107' : '#4A90D9'
                    }]}>
                      {participant.role === 'professeur' ? '👨‍🏫 Professeur' : '📚 Etudiant'}
                    </Text>
                  </View>
                  {estProf && participant.role !== 'professeur' && (
                    <TouchableOpacity
                      style={styles.boutonExclure}
                      onPress={() => exclureParticipant(participant)}
                    >
                      <Text style={styles.boutonExclureTexte}>🚫 Exclure</Text>
                    </TouchableOpacity>
                  )}
                  {participant.role === 'professeur' && (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeTexte}>👑 Admin</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2044' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#0A1628', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  retourBtn: { width: 60 },
  retourTexte: { color: '#4A90D9', fontSize: 13, fontWeight: '600' },
  headerCentre: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerAvatarTexte: { fontSize: 18 },
  headerTitre: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', maxWidth: 160 },
  headerSous: { color: '#4CAF50', fontSize: 10, marginTop: 1 },
  optionsBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  optionsBtnTexte: { fontSize: 18 },
  chatFermeBanniere: { backgroundColor: 'rgba(255,82,82,0.15)', paddingHorizontal: 24, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,82,82,0.2)' },
  chatFermeTexte: { color: '#FF5252', fontSize: 12, textAlign: 'center', fontWeight: '600' },
  listeMessages: { paddingHorizontal: 16, paddingVertical: 16, gap: 2 },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6, gap: 8 },
  messageWrapperDroite: { flexDirection: 'row-reverse' },
  messageWrapperGauche: { flexDirection: 'row' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(74,144,217,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(74,144,217,0.4)', flexShrink: 0 },
  avatarProf: { backgroundColor: 'rgba(255,193,7,0.2)', borderColor: 'rgba(255,193,7,0.4)' },
  avatarTexte: { color: '#4A90D9', fontSize: 10, fontWeight: '800' },
  avatarEspaceur: { width: 30 },
  messageBulle: { maxWidth: '75%', gap: 2 },
  messageAuteurRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginBottom: 2 },
  messageAuteur: { color: '#4A90D9', fontSize: 11, fontWeight: '700' },
  profBadge: { backgroundColor: 'rgba(255,193,7,0.2)', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: 'rgba(255,193,7,0.4)' },
  profBadgeTexte: { color: '#FFC107', fontSize: 9, fontWeight: '700' },
  messageBulleInterne: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  messageBulleMoi: { backgroundColor: '#4A90D9', borderBottomRightRadius: 4 },
  messageBulleProf: { backgroundColor: 'rgba(255,193,7,0.12)', borderWidth: 1, borderColor: 'rgba(255,193,7,0.3)', borderBottomLeftRadius: 4 },
  messageBulleAutre: { backgroundColor: 'rgba(255,255,255,0.08)', borderBottomLeftRadius: 4 },
  messageBulleSupprime: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed' },
  messageTexte: { fontSize: 14, lineHeight: 21 },
  messageHeure: { fontSize: 10, color: '#4A6080', paddingHorizontal: 4 },
  messageSysteme: { alignItems: 'center', marginVertical: 8 },
  messageSystemeTexte: { color: '#4A6080', fontSize: 11, backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, textAlign: 'center' },
  videContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  videEmoji: { fontSize: 48 },
  videTitre: { color: '#8BA4C4', fontSize: 15 },
  saisieContainer: { backgroundColor: '#0A1628', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  champSaisie: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, color: '#FFFFFF', fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  boutonEnvoyer: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4A90D9', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  boutonEnvoyerDesactive: { backgroundColor: 'rgba(74,144,217,0.3)', elevation: 0 },
  boutonEnvoyerIcone: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#0A1628', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 4 },
  modalHeader: { marginBottom: 16 },
  modalTitre: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  modalSous: { color: '#8BA4C4', fontSize: 12, marginTop: 2 },
  modalOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12 },
  modalOptionDanger: { backgroundColor: 'rgba(255,82,82,0.08)', borderColor: 'rgba(255,82,82,0.25)' },
  modalOptionEmoji: { fontSize: 24 },
  modalOptionTitre: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  modalOptionSous: { color: '#8BA4C4', fontSize: 12 },
  modalOptionFleche: { color: '#4A90D9', fontSize: 18, fontWeight: 'bold' },
  modalAnnuler: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 4 },
  modalAnnulerTexte: { color: '#C8D8EE', fontWeight: '600', fontSize: 14 },
  participantsContainer: { backgroundColor: '#0A1628', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '70%', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  participantsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  participantsTitre: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  participantsFermer: { color: '#FF5252', fontSize: 20, fontWeight: 'bold' },
  participantItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12 },
  participantAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  participantAvatarTexte: { fontSize: 13, fontWeight: '800' },
  participantNom: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  participantRole: { fontSize: 11, fontWeight: '600' },
  boutonExclure: { backgroundColor: 'rgba(255,82,82,0.15)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,82,82,0.35)' },
  boutonExclureTexte: { color: '#FF5252', fontSize: 11, fontWeight: '700' },
  adminBadge: { backgroundColor: 'rgba(255,193,7,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,193,7,0.35)' },
  adminBadgeTexte: { color: '#FFC107', fontSize: 10, fontWeight: '700' },
});
