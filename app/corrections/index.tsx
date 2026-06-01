import { useRouter } from 'expo-router';
import {
    collection,
    doc,
    getDocs,
    increment,
    onSnapshot, orderBy,
    query,
    updateDoc,
    where
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert,
    Animated,
    FlatList, KeyboardAvoidingView, Linking, Platform,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { db } from '../../firebaseConfig';

interface Message {
  id: string;
  texte: string;
  auteur: string;
  auteurId: string;
  type: 'texte' | 'document' | 'systeme' | 'note';
  timestamp: any;
  documentNom?: string;
  documentUrl?: string;
  documentMimeType?: string;
  documentSize?: number;
  noteEtudiant?: string;
  noteValeur?: string;
}

export default function CorrectionsEtudiant() {
  const router = useRouter();
  const [etape, setEtape] = useState<'code' | 'salon'>('code');
  const [code, setCode] = useState('');
  const [salonId, setSalonId] = useState('');
  const [salonInfo, setSalonInfo] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chargement, setChargement] = useState(false);
  const [codeFocus, setCodeFocus] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animerEntree();
    animerPulsation();
  }, []);

  useEffect(() => {
    if (salonId) {
      const unsub = ecouterMessages();
      return unsub;
    }
  }, [salonId]);

  const animerEntree = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const animerPulsation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  };

  const animerErreur = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const rejoindre = async () => {
    if (code.trim().length !== 6) {
      animerErreur();
      Alert.alert('Code invalide', 'Le code doit contenir 6 caracteres.');
      return;
    }
    setChargement(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'salons'), where('code', '==', code.trim().toUpperCase()))
      );
      if (snap.empty) {
        animerErreur();
        Alert.alert('❌ Code introuvable', 'Verifiez le code et reessayez.');
        return;
      }
      const salonDoc = snap.docs[0];
      const data = salonDoc.data();
      if (!data.actif) {
        Alert.alert('🔒 Salon ferme', 'Ce salon a ete ferme par le professeur.');
        return;
      }
      await updateDoc(doc(db, 'salons', salonDoc.id), {
        participants: increment(1)
      });
      setSalonId(salonDoc.id);
      setSalonInfo(data);
      setEtape('salon');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de rejoindre le salon.');
    } finally {
      setChargement(false);
    }
  };

  const ecouterMessages = () => {
    const q = query(
      collection(db, `salons/${salonId}/messages`),
      orderBy('timestamp', 'asc')
    );
    return onSnapshot(q, snap => {
      const msgs: Message[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
  };

  const quitterSalon = async () => {
    try {
      await updateDoc(doc(db, 'salons', salonId), {
        participants: increment(-1)
      });
    } catch (e) {}
    setEtape('code');
    setSalonId('');
    setSalonInfo(null);
    setMessages([]);
    setCode('');
  };

  const formaterHeure = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const ouvrirDocument = async (message: Message) => {
    if (!message.documentUrl) {
      Alert.alert('Document indisponible', 'Ce document ne contient pas de lien telechargeable.');
      return;
    }
    try {
      const peutOuvrir = await Linking.canOpenURL(message.documentUrl);
      if (!peutOuvrir) {
        Alert.alert('Ouverture impossible', 'Aucune application ne peut ouvrir ce document.');
        return;
      }
      await Linking.openURL(message.documentUrl);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d ouvrir ce document.');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.type === 'systeme') {
      return (
        <View style={styles.messageSysteme}>
          <Text style={styles.messageSystemeTexte}>{item.texte}</Text>
        </View>
      );
    }
    if (item.type === 'note') {
      return (
        <View style={styles.noteCard}>
          <View style={styles.noteHeader}>
            <Text style={styles.noteIcone}>📊</Text>
            <Text style={styles.noteTitre}>Note publiee</Text>
            <Text style={styles.noteHeure}>{formaterHeure(item.timestamp)}</Text>
          </View>
          <View style={styles.noteContenu}>
            <View>
              <Text style={styles.noteEtudiantLabel}>Etudiant</Text>
              <Text style={styles.noteEtudiantNom}>{item.noteEtudiant}</Text>
            </View>
            <View style={styles.noteValeurContainer}>
              <Text style={styles.noteValeurLabel}>Note</Text>
              <Text style={styles.noteValeurTexte}>{item.noteValeur}</Text>
            </View>
          </View>
        </View>
      );
    }
    if (item.type === 'document') {
      return (
        <TouchableOpacity
          style={[styles.documentCard, !item.documentUrl && styles.documentCardDesactive]}
          onPress={() => ouvrirDocument(item)}
          disabled={!item.documentUrl}
          activeOpacity={0.75}
        >
          <View style={styles.documentIconeWrapper}>
            <Text style={styles.documentIcone}>📎</Text>
          </View>
          <View style={styles.documentInfo}>
            <Text style={styles.documentTitre}>Document du professeur</Text>
            <Text style={styles.documentNom}>{item.documentNom}</Text>
            <Text style={styles.documentHeure}>{formaterHeure(item.timestamp)}</Text>
          </View>
          <View style={styles.documentAction}>
            <Text style={styles.documentActionTexte}>{item.documentUrl ? 'Ouvrir' : 'Indispo'}</Text>
          </View>
        </TouchableOpacity>
      );
    }
    return (
      <View style={styles.messageWrapper}>
        <View style={styles.messageAvatar}>
          <Text style={styles.messageAvatarTexte}>
            {item.auteur?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.messageBulle}>
          <View style={styles.messageAuteurRow}>
            <Text style={styles.messageAuteur}>{item.auteur}</Text>
            <View style={styles.profBadge}>
              <Text style={styles.profBadgeTexte}>👨‍🏫 Prof</Text>
            </View>
          </View>
          <View style={styles.messageBulleInterne}>
            <Text style={styles.messageTexte}>{item.texte}</Text>
          </View>
          <Text style={styles.messageHeure}>{formaterHeure(item.timestamp)}</Text>
        </View>
      </View>
    );
  };

  // ─── ÉCRAN SAISIE CODE ────────────────────────────────────────
  if (etape === 'code') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View style={[styles.codeContainer, { opacity: fadeAnim }]}>

          <View style={styles.codeHeader}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.retourTexte}>← Retour</Text>
            </TouchableOpacity>
          </View>

          {/* Illustration */}
          <Animated.View style={[styles.illustration, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.illustrationEmoji}>🎓</Text>
          </Animated.View>

          <Text style={styles.codeTitre}>Rejoindre un salon</Text>
          <Text style={styles.codeSous}>
            Entrez le code a 6 caracteres fourni par votre professeur ou recu sur WhatsApp
          </Text>

          {/* Champ code */}
          <Animated.View style={[styles.codeChampWrapper, {
            borderColor: codeFocus ? '#4A90D9' : 'rgba(255,255,255,0.12)',
            transform: [{ translateX: shakeAnim }]
          }]}>
            <TextInput
              style={styles.codeChamp}
              placeholder="Ex: ABC123"
              placeholderTextColor="#1E3A5F"
              value={code}
              onChangeText={v => setCode(v.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              onFocus={() => setCodeFocus(true)}
              onBlur={() => setCodeFocus(false)}
              textAlign="center"
            />
          </Animated.View>

          {/* Indicateurs de caractères */}
          <View style={styles.codeIndicateurs}>
            {Array.from({ length: 6 }, (_, i) => (
              <View key={i} style={[
                styles.codeIndicateur,
                code.length > i && styles.codeIndicateurActif
              ]}>
                <Text style={[styles.codeIndicateurTexte, code.length > i && styles.codeIndicateurTexteActif]}>
                  {code[i] || '•'}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.boutonRejoindre, (code.length !== 6 || chargement) && styles.boutonDesactive]}
            onPress={rejoindre}
            disabled={code.length !== 6 || chargement}
            activeOpacity={0.8}
          >
            {chargement ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.boutonRejoindreTexte}>🚀 Rejoindre le salon</Text>
            )}
          </TouchableOpacity>

          {/* Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoTexte}>
              💡 Le code vous a ete envoye par votre professeur. Verifiez votre WhatsApp ou vos autres messageries.
            </Text>
          </View>

        </Animated.View>
      </KeyboardAvoidingView>
    );
  }

  // ─── ÉCRAN SALON LECTURE SEULE ────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.salonHeader}>
        <TouchableOpacity onPress={quitterSalon} style={styles.retourBtn}>
          <Text style={styles.retourTexte}>← Quitter</Text>
        </TouchableOpacity>
        <View style={styles.salonHeaderCentre}>
          <Text style={styles.salonHeaderTitre} numberOfLines={1}>
            {salonInfo?.titre}
          </Text>
          <Text style={styles.salonHeaderProf}>👨‍🏫 {salonInfo?.profNom}</Text>
        </View>
        <View style={styles.lectureSeuleBadge}>
          <Text style={styles.lectureSeuleTexte}>👁️ Lecture</Text>
        </View>
      </View>

      {/* Bannière lecture seule */}
      <View style={styles.lectureSeuleBanniere}>
        <Text style={styles.lectureSeuleBanniereTexte}>
          📖 Vous etes en mode lecture — Seul le professeur peut publier dans ce salon
        </Text>
      </View>

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
            <Text style={styles.videEmoji}>⏳</Text>
            <Text style={styles.videTitre}>En attente du professeur...</Text>
            <Text style={styles.videTexte}>
              Le professeur n a pas encore publie de corrections. Restez connecte !
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2044' },
  codeContainer: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  codeHeader: { position: 'absolute', top: 50, left: 24 },
  retourTexte: { color: '#4A90D9', fontSize: 14, fontWeight: '600' },
  illustration: { alignItems: 'center', marginBottom: 24 },
  illustrationEmoji: { fontSize: 72 },
  codeTitre: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  codeSous: { color: '#8BA4C4', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  codeChampWrapper: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, borderWidth: 2, marginBottom: 16, overflow: 'hidden' },
  codeChamp: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', padding: 20, letterSpacing: 8, textAlign: 'center' },
  codeIndicateurs: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 28 },
  codeIndicateur: { width: 36, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  codeIndicateurActif: { backgroundColor: 'rgba(74,144,217,0.2)', borderColor: '#4A90D9' },
  codeIndicateurTexte: { color: '#4A6080', fontSize: 18, fontWeight: '700' },
  codeIndicateurTexteActif: { color: '#4A90D9' },
  boutonRejoindre: { backgroundColor: '#4A90D9', borderRadius: 14, padding: 16, alignItems: 'center', elevation: 6, marginBottom: 20 },
  boutonDesactive: { backgroundColor: 'rgba(74,144,217,0.3)', elevation: 0 },
  boutonRejoindreTexte: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  infoContainer: { backgroundColor: 'rgba(255,193,7,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,193,7,0.2)' },
  infoTexte: { color: '#A8C0DC', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  retourBtn: { width: 70 },
  salonHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#0A1628', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  salonHeaderCentre: { flex: 1, alignItems: 'center' },
  salonHeaderTitre: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  salonHeaderProf: { color: '#FFC107', fontSize: 11, marginTop: 2 },
  lectureSeuleBadge: { backgroundColor: 'rgba(74,144,217,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(74,144,217,0.3)' },
  lectureSeuleTexte: { color: '#4A90D9', fontSize: 10, fontWeight: '700' },
  lectureSeuleBanniere: { backgroundColor: 'rgba(255,193,7,0.08)', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,193,7,0.15)' },
  lectureSeuleBanniereTexte: { color: '#A8C0DC', fontSize: 11, textAlign: 'center', fontStyle: 'italic' },
  listeMessages: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  videContainer: { alignItems: 'center', paddingTop: 60, gap: 12 },
  videEmoji: { fontSize: 56 },
  videTitre: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  videTexte: { color: '#8BA4C4', fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  messageSysteme: { alignItems: 'center', marginVertical: 4 },
  messageSystemeTexte: { color: '#4A6080', fontSize: 11, backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, textAlign: 'center' },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  messageAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,193,7,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,193,7,0.4)', flexShrink: 0 },
  messageAvatarTexte: { color: '#FFC107', fontSize: 11, fontWeight: '800' },
  messageBulle: { flex: 1, gap: 2 },
  messageAuteurRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  messageAuteur: { color: '#FFC107', fontSize: 12, fontWeight: '700' },
  profBadge: { backgroundColor: 'rgba(255,193,7,0.2)', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,193,7,0.4)' },
  profBadgeTexte: { color: '#FFC107', fontSize: 9, fontWeight: '700' },
  messageBulleInterne: { backgroundColor: 'rgba(255,193,7,0.08)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,193,7,0.2)' },
  messageTexte: { color: '#E8F0FE', fontSize: 14, lineHeight: 22 },
  messageHeure: { color: '#4A6080', fontSize: 10, paddingHorizontal: 4 },
  noteCard: { backgroundColor: 'rgba(255,193,7,0.08)', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: 'rgba(255,193,7,0.35)', gap: 12 },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteIcone: { fontSize: 22 },
  noteTitre: { flex: 1, color: '#FFC107', fontSize: 13, fontWeight: '700' },
  noteHeure: { color: '#4A6080', fontSize: 10 },
  noteContenu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noteEtudiantLabel: { color: '#8BA4C4', fontSize: 11, marginBottom: 2 },
  noteEtudiantNom: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  noteValeurContainer: { backgroundColor: 'rgba(76,175,80,0.15)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(76,175,80,0.35)' },
  noteValeurLabel: { color: '#8BA4C4', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 },
  noteValeurTexte: { color: '#4CAF50', fontSize: 22, fontWeight: '900' },
  documentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74,144,217,0.08)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', gap: 12 },
  documentCardDesactive: { opacity: 0.55 },
  documentIconeWrapper: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(74,144,217,0.2)', alignItems: 'center', justifyContent: 'center' },
  documentIcone: { fontSize: 22 },
  documentInfo: { flex: 1 },
  documentTitre: { color: '#4A90D9', fontSize: 12, fontWeight: '700', marginBottom: 2 },
  documentNom: { color: '#FFFFFF', fontSize: 13 },
  documentHeure: { color: '#4A6080', fontSize: 10, marginTop: 2 },
  documentAction: { backgroundColor: 'rgba(74,144,217,0.18)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(74,144,217,0.35)' },
  documentActionTexte: { color: '#4A90D9', fontSize: 10, fontWeight: '800' },
});
