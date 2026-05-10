import { useRouter } from 'expo-router';
import {
    addDoc,
    collection,
    doc, getDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert,
    Animated,
    FlatList, KeyboardAvoidingView, Platform,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

interface Message {
  id: string;
  texte: string;
  auteur: string;
  auteurId: string;
  role: string;
  timestamp: any;
  type: 'texte' | 'fichier' | 'systeme';
}

const MESSAGES_BIENVENUE = [
  'Bienvenue dans votre espace communautaire ! 🎉',
  'Partagez, apprenez, progressez ensemble ! 💪',
  'Votre communaute vous attend ! 🚀',
];

export default function ChatCommunautaire() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [nouveauMessage, setNouveauMessage] = useState('');
  const [profil, setProfil] = useState<any>(null);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [messageBienvenue] = useState(
    MESSAGES_BIENVENUE[Math.floor(Math.random() * MESSAGES_BIENVENUE.length)]
  );

  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const envoyerAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    chargerProfil();
    const unsub = ecouterMessages();
    animerEntree();
    return unsub;
  }, []);

  const animerEntree = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const animerBoutonEnvoi = () => {
    Animated.sequence([
      Animated.timing(envoyerAnim, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(envoyerAnim, { toValue: 1, tension: 100, friction: 5, useNativeDriver: true }),
    ]).start();
  };

  const chargerProfil = async () => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    try {
      const docSnap = await getDoc(doc(db, 'utilisateurs', utilisateur.uid));
      if (docSnap.exists()) setProfil(docSnap.data());
    } catch (e) {}
  };

  const ecouterMessages = () => {
    const q = query(
      collection(db, 'chats/communautaire/messages'),
      orderBy('timestamp', 'asc')
    );
    return onSnapshot(q, (snap) => {
      const msgs: Message[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Message));
      setMessages(msgs);
      setChargement(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
  };

  const envoyerMessage = async () => {
    if (!nouveauMessage.trim() || !profil || envoi) return;
    animerBoutonEnvoi();
    setEnvoi(true);
    const texte = nouveauMessage.trim();
    setNouveauMessage('');
    try {
      await addDoc(collection(db, 'chats/communautaire/messages'), {
        texte,
        auteur: profil.nom,
        auteurId: auth.currentUser?.uid,
        role: profil.role,
        timestamp: serverTimestamp(),
        type: 'texte',
      });
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d envoyer le message.');
      setNouveauMessage(texte);
    } finally {
      setEnvoi(false);
    }
  };

  const estMonMessage = (msg: Message) => msg.auteurId === auth.currentUser?.uid;

  const getInitiales = (nom: string) => {
    return nom?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
  };

  const getCouleurRole = (role: string) => {
    if (role === 'professeur') return '#FFC107';
    if (role === 'admin') return '#FF5252';
    return '#4A90D9';
  };

  const formaterHeure = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const estMoi = estMonMessage(item);
    const couleurRole = getCouleurRole(item.role);
    const messagePrec = messages[index - 1];
    const memeAuteur = messagePrec?.auteurId === item.auteurId;

    if (item.type === 'systeme') {
      return (
        <View style={styles.messageSysteme}>
          <Text style={styles.messageSystemeTexte}>⚡ {item.texte}</Text>
        </View>
      );
    }

    return (
      <View style={[
        styles.messageWrapper,
        estMoi ? styles.messageWrapperDroite : styles.messageWrapperGauche,
        memeAuteur && { marginTop: 2 }
      ]}>
        {!estMoi && !memeAuteur && (
          <View style={[styles.avatar, { backgroundColor: couleurRole + '33', borderColor: couleurRole + '66' }]}>
            <Text style={[styles.avatarTexte, { color: couleurRole }]}>
              {getInitiales(item.auteur)}
            </Text>
          </View>
        )}
        {!estMoi && memeAuteur && <View style={styles.avatarEspaceur} />}

        <View style={styles.messageBulle}>
          {!estMoi && !memeAuteur && (
            <View style={styles.messageAuteurRow}>
              <Text style={[styles.messageAuteur, { color: couleurRole }]}>{item.auteur}</Text>
              {item.role === 'professeur' && (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeTexte}>👨‍🏫 Prof</Text>
                </View>
              )}
              {item.role === 'admin' && (
                <View style={[styles.roleBadge, { backgroundColor: '#FF525222', borderColor: '#FF525255' }]}>
                  <Text style={[styles.roleBadgeTexte, { color: '#FF5252' }]}>👑 Admin</Text>
                </View>
              )}
            </View>
          )}
          <View style={[
            styles.messageBulleInterne,
            estMoi ? styles.messageBulleMoi : styles.messageBulleAutre,
            item.role === 'professeur' && !estMoi && styles.messageBulleProfesseur,
          ]}>
            <Text style={[
              styles.messageTexte,
              estMoi ? styles.messageTexteMoi : styles.messageTexteAutre
            ]}>
              {item.texte}
            </Text>
          </View>
          <Text style={[styles.messageHeure, estMoi && { textAlign: 'right' }]}>
            {formaterHeure(item.timestamp)}
            {estMoi && <Text style={styles.messageLu}> ✓✓</Text>}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
          <Text style={styles.retourTexte}>← Retour</Text>
        </TouchableOpacity>
        <View style={styles.headerCentre}>
          <Text style={styles.headerTitre}>Communaute</Text>
          <View style={styles.headerStatut}>
            <View style={styles.pointVert} />
            <Text style={styles.headerStatutTexte}>{messages.length} messages</Text>
          </View>
        </View>
        <View style={styles.headerIcone}>
          <Text style={styles.headerIconeTexte}>👥</Text>
        </View>
      </Animated.View>

      {/* Bannière info */}
      <Animated.View style={[styles.infoBanniere, { opacity: fadeAnim }]}>
        <Text style={styles.infoBanniereTexte}>💬 {messageBienvenue}</Text>
      </Animated.View>

      {/* Messages */}
      {chargement ? (
        <View style={styles.chargementContainer}>
          <ActivityIndicator size="large" color="#4A90D9" />
          <Text style={styles.chargementTexte}>Chargement des messages...</Text>
        </View>
      ) : (
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
              <Text style={styles.videTitre}>Soyez le premier a ecrire !</Text>
              <Text style={styles.videTexte}>
                Lancez la conversation avec vos camarades. Chaque grand echange commence par un premier message ! 🚀
              </Text>
            </View>
          }
        />
      )}

      {/* Zone de saisie */}
      <Animated.View style={[styles.saisieContainer, { opacity: fadeAnim }]}>
        <View style={styles.saisieInterne}>
          <TextInput
            style={styles.champSaisie}
            placeholder="Ecrivez votre message..."
            placeholderTextColor="#4A6080"
            value={nouveauMessage}
            onChangeText={setNouveauMessage}
            multiline
            maxLength={500}
            onSubmitEditing={envoyerMessage}
          />
          <Animated.View style={{ transform: [{ scale: envoyerAnim }] }}>
            <TouchableOpacity
              style={[
                styles.boutonEnvoyer,
                (!nouveauMessage.trim() || envoi) && styles.boutonEnvoyerDesactive
              ]}
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
        {nouveauMessage.length > 400 && (
          <Text style={styles.compteurCaracteres}>
            {500 - nouveauMessage.length} caracteres restants
          </Text>
        )}
      </Animated.View>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2044' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 24, paddingBottom: 12, backgroundColor: '#0F2044', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  retourBtn: { width: 70 },
  retourTexte: { color: '#4A90D9', fontSize: 14, fontWeight: '600' },
  headerCentre: { alignItems: 'center' },
  headerTitre: { fontSize: 17, fontWeight: 'bold', color: '#FFFFFF' },
  headerStatut: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  pointVert: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4CAF50' },
  headerStatutTexte: { color: '#4CAF50', fontSize: 11, fontWeight: '600' },
  headerIcone: { width: 70, alignItems: 'flex-end' },
  headerIconeTexte: { fontSize: 24 },
  infoBanniere: { backgroundColor: 'rgba(74,144,217,0.1)', paddingHorizontal: 24, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(74,144,217,0.15)' },
  infoBanniereTexte: { color: '#8BA4C4', fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
  chargementContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  chargementTexte: { color: '#8BA4C4', fontSize: 14 },
  listeMessages: { paddingHorizontal: 16, paddingVertical: 16, gap: 4 },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8, gap: 8 },
  messageWrapperDroite: { flexDirection: 'row-reverse' },
  messageWrapperGauche: { flexDirection: 'row' },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0 },
  avatarTexte: { fontSize: 11, fontWeight: '800' },
  avatarEspaceur: { width: 32 },
  messageBulle: { maxWidth: '75%', gap: 2 },
  messageAuteurRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, paddingHorizontal: 4 },
  messageAuteur: { fontSize: 11, fontWeight: '700' },
  roleBadge: { backgroundColor: 'rgba(255,193,7,0.2)', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: 'rgba(255,193,7,0.4)' },
  roleBadgeTexte: { color: '#FFC107', fontSize: 9, fontWeight: '700' },
  messageBulleInterne: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  messageBulleMoi: { backgroundColor: '#4A90D9', borderBottomRightRadius: 4 },
  messageBulleAutre: { backgroundColor: 'rgba(255,255,255,0.08)', borderBottomLeftRadius: 4 },
  messageBulleProfesseur: { backgroundColor: 'rgba(255,193,7,0.12)', borderColor: 'rgba(255,193,7,0.3)', borderWidth: 1 },
  messageTexte: { fontSize: 14, lineHeight: 21 },
  messageTexteMoi: { color: '#FFFFFF' },
  messageTexteAutre: { color: '#E8F0FE' },
  messageHeure: { fontSize: 10, color: '#4A6080', paddingHorizontal: 4 },
  messageLu: { color: '#4A90D9' },
  messageSysteme: { alignItems: 'center', marginVertical: 8 },
  messageSystemeTexte: { color: '#4A6080', fontSize: 11, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  videContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 12 },
  videEmoji: { fontSize: 56 },
  videTitre: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  videTexte: { color: '#8BA4C4', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  saisieContainer: { backgroundColor: '#0F2044', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  saisieInterne: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  champSaisie: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, color: '#FFFFFF', fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  boutonEnvoyer: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4A90D9', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  boutonEnvoyerDesactive: { backgroundColor: 'rgba(74,144,217,0.3)', elevation: 0 },
  boutonEnvoyerIcone: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  compteurCaracteres: { color: '#FF7043', fontSize: 11, textAlign: 'right', marginTop: 4 },
});