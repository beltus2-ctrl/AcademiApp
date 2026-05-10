import { useRouter } from 'expo-router';
import {
    addDoc,
    collection,
    doc, getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    where
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert,
    Animated,
    FlatList, KeyboardAvoidingView, Platform,
    ScrollView,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { API_URL } from '../../utils/config';
import { verifierEtDecrementerQuota } from '../../utils/quota';

interface Message {
  id: string;
  texte: string;
  auteur: string;
  auteurId: string;
  role: string;
  timestamp: any;
  type: 'texte' | 'ia' | 'systeme';
}

interface Professeur {
  id: string;
  nom: string;
  disponible: boolean;
  specialite?: string;
}

export default function ChatProfesseur() {
  const router = useRouter();
  const [etape, setEtape] = useState<'choix' | 'chat'>('choix');
  const [professeurs, setProfesseurs] = useState<Professeur[]>([]);
  const [professeurChoisi, setProfesseurChoisi] = useState<Professeur | null>(null);
  const [modeIA, setModeIA] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [nouveauMessage, setNouveauMessage] = useState('');
  const [profil, setProfil] = useState<any>(null);
  const [chargement, setChargement] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [appulEnvoye, setAppulEnvoye] = useState(false);
  const [iaEntrain, setIaEntrain] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const appulAnim = useRef(new Animated.Value(1)).current;
  const profsAnim = useRef<Animated.Value[]>([]).current;

  useEffect(() => {
    chargerProfil();
    chargerProfesseurs();
    animerEntree();
    animerPulsation();
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
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  };

  const animerAppel = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(appulAnim, { toValue: 1.15, duration: 300, useNativeDriver: true }),
        Animated.timing(appulAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(appulAnim, { toValue: 1.15, duration: 300, useNativeDriver: true }),
        Animated.timing(appulAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
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

  const chargerProfesseurs = async () => {
    setChargement(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'utilisateurs'), where('role', '==', 'professeur'))
      );
      const profs: Professeur[] = snap.docs.map(d => ({
        id: d.id,
        nom: d.data().nom,
        disponible: d.data().disponible || false,
        specialite: d.data().specialite || 'Cours general',
      }));
      setProfesseurs(profs);

      profs.forEach((_, i) => {
        profsAnim.push(new Animated.Value(0));
      });
      Animated.stagger(100, profsAnim.map(anim =>
        Animated.spring(anim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true })
      )).start();
    } catch (e) {
      console.log('Erreur chargement professeurs');
    } finally {
      setChargement(false);
    }
  };

  const envoyerAppel = async () => {
    animerAppel();
    setAppulEnvoye(true);
    try {
      await addDoc(collection(db, 'appels'), {
        etudiantId: auth.currentUser?.uid,
        etudiantNom: profil?.nom,
        timestamp: serverTimestamp(),
        statut: 'en_attente',
        type: 'tous',
      });
      Alert.alert(
        '📞 Appel envoye !',
        'Tous les professeurs ont ete notifies. Un professeur vous repondra des que possible.\n\nSi aucun prof n est disponible, AcademiAI prendra le relais ! 🤖',
        [{ text: 'OK' }]
      );
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d envoyer l appel.');
      setAppulEnvoye(false);
    }
  };

  const demarrerChatProf = async (prof: Professeur) => {
    setProfesseurChoisi(prof);
    setModeIA(!prof.disponible);
    setEtape('chat');

    const chatId = `${auth.currentUser?.uid}_${prof.id}`;
    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('timestamp', 'asc')
    );
    onSnapshot(q, (snap) => {
      const msgs: Message[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Message));
      setMessages(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    if (!prof.disponible) {
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        texte: `Bonjour ! Je suis AcademiAI. ${prof.nom} n est pas disponible en ce moment, mais je suis la pour vous aider ! Comment puis-je vous assister ? 🤖`,
        auteur: 'AcademiAI',
        auteurId: 'ia',
        role: 'ia',
        timestamp: serverTimestamp(),
        type: 'ia',
      });
    } else {
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        texte: `Conversation demarree avec ${prof.nom}. Bonjour ! 👋`,
        auteur: 'Systeme',
        auteurId: 'systeme',
        role: 'systeme',
        timestamp: serverTimestamp(),
        type: 'systeme',
      });
    }
  };

  const demarrerChatIA = async () => {
    setModeIA(true);
    setEtape('chat');
    const chatId = `${auth.currentUser?.uid}_ia_direct`;
    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('timestamp', 'asc')
    );
    onSnapshot(q, (snap) => {
      const msgs: Message[] = snap.docs.map(d => ({
        id: d.id, ...d.data()
      } as Message));
      setMessages(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    await addDoc(collection(db, `chats/${chatId}/messages`), {
      texte: 'Bonjour ! Je suis AcademiAI, votre assistant academique. Je suis disponible 24h/24 pour repondre a toutes vos questions ! Comment puis-je vous aider aujourd hui ? 🤖✨',
      auteur: 'AcademiAI',
      auteurId: 'ia',
      role: 'ia',
      timestamp: serverTimestamp(),
      type: 'ia',
    });
  };

  const envoyerMessage = async () => {
    if (!nouveauMessage.trim() || envoi) return;
    const texte = nouveauMessage.trim();
    setNouveauMessage('');
    setEnvoi(true);

    const chatId = modeIA && !professeurChoisi
      ? `${auth.currentUser?.uid}_ia_direct`
      : `${auth.currentUser?.uid}_${professeurChoisi?.id}`;

    try {
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        texte,
        auteur: profil?.nom,
        auteurId: auth.currentUser?.uid,
        role: profil?.role,
        timestamp: serverTimestamp(),
        type: 'texte',
      });

      if (modeIA) {
        setIaEntrain(true);
        const quota = await verifierEtDecrementerQuota();
        if (!quota.autorise) {
          await addDoc(collection(db, `chats/${chatId}/messages`), {
            texte: '⚠️ Quota journalier atteint. Revenez demain pour continuer avec AcademiAI. 📅',
            auteur: 'AcademiAI',
            auteurId: 'ia',
            role: 'ia',
            timestamp: serverTimestamp(),
            type: 'ia',
          });
          setIaEntrain(false);
          return;
        }

        const response = await fetch(`${API_URL}/chat-ia`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: texte, nom: profil?.nom })
        });
        const data = await response.json();

        await addDoc(collection(db, `chats/${chatId}/messages`), {
          texte: data.reponse || 'Je n ai pas pu generer une reponse. Reessayez.',
          auteur: 'AcademiAI',
          auteurId: 'ia',
          role: 'ia',
          timestamp: serverTimestamp(),
          type: 'ia',
        });
        setIaEntrain(false);
      }
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d envoyer le message.');
      setNouveauMessage(texte);
    } finally {
      setEnvoi(false);
    }
  };

  const formaterHeure = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const estMoi = item.auteurId === auth.currentUser?.uid;
    const estIA = item.role === 'ia';

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
      ]}>
        {!estMoi && (
          <View style={[
            styles.avatar,
            estIA ? styles.avatarIA : styles.avatarProf
          ]}>
            <Text style={styles.avatarTexte}>{estIA ? '🤖' : '👨‍🏫'}</Text>
          </View>
        )}

        <View style={styles.messageBulle}>
          {!estMoi && (
            <Text style={[styles.messageAuteur, estIA && { color: '#4A90D9' }]}>
              {item.auteur} {estIA && '• IA'}
            </Text>
          )}
          <View style={[
            styles.messageBulleInterne,
            estMoi ? styles.messageBulleMoi
              : estIA ? styles.messageBulleIA
              : styles.messageBulleProf
          ]}>
            <Text style={[
              styles.messageTexte,
              estMoi ? { color: '#FFFFFF' } : { color: '#E8F0FE' }
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
    );
  };

  // ─── ÉCRAN CHOIX PROFESSEUR ──────────────────────────────────────
  if (etape === 'choix') {
    const profsDisponibles = professeurs.filter(p => p.disponible);
    const profsIndisponibles = professeurs.filter(p => !p.disponible);

    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
            <Text style={styles.retourTexte}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitre}>Professeurs</Text>
          <View style={{ width: 70 }} />
        </Animated.View>

        {/* Bannière */}
        <Animated.View style={[styles.banniere, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.banniereEmoji}>🎓</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.banniereTitre}>Vos Professeurs</Text>
            <Text style={styles.banniereTexte}>
              {profsDisponibles.length > 0
                ? `${profsDisponibles.length} professeur(s) disponible(s) maintenant !  🟢`
                : 'Aucun prof disponible — AcademiAI est la pour vous ! 🤖'}
            </Text>
          </View>
        </Animated.View>

        {/* Bouton appel urgent */}
        <Animated.View style={{ transform: [{ scale: appulEnvoye ? appulAnim : pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.boutonAppel, appulEnvoye && styles.boutonAppelEnvoye]}
            onPress={appulEnvoye ? undefined : envoyerAppel}
            activeOpacity={0.8}
          >
            <Text style={styles.boutonAppelIcone}>{appulEnvoye ? '✅' : '📞'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.boutonAppelTitre}>
                {appulEnvoye ? 'Appel envoye !' : 'Appel d urgence'}
              </Text>
              <Text style={styles.boutonAppelTexte}>
                {appulEnvoye
                  ? 'Les professeurs ont ete notifies. Patientez...'
                  : 'Notifier TOUS les professeurs disponibles immediatement'}
              </Text>
            </View>
            {!appulEnvoye && (
              <View style={styles.urgenceBadge}>
                <Text style={styles.urgenceBadgeTexte}>URGENT</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* AcademiAI direct */}
        <TouchableOpacity
          style={styles.boutonIA}
          onPress={demarrerChatIA}
          activeOpacity={0.8}
        >
          <Animated.Text style={[styles.boutonIAIcone, { transform: [{ scale: pulseAnim }] }]}>
            🤖
          </Animated.Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.boutonIATitre}>Chatter avec AcademiAI</Text>
            <Text style={styles.boutonIATexte}>
              Disponible 24h/24 — 7j/7. Reponses instantanees ! ⚡
            </Text>
          </View>
          <View style={styles.dispoBadge}>
            <View style={styles.pointVertPetit} />
            <Text style={styles.dispoBadgeTexte}>En ligne</Text>
          </View>
        </TouchableOpacity>

        {/* Liste professeurs disponibles */}
        {profsDisponibles.length > 0 && (
          <>
            <Text style={styles.sectionTitre}>🟢 Professeurs disponibles</Text>
            {profsDisponibles.map((prof, index) => (
              <TouchableOpacity
                key={prof.id}
                style={styles.profCard}
                onPress={() => demarrerChatProf(prof)}
                activeOpacity={0.75}
              >
                <View style={styles.profAvatar}>
                  <Text style={styles.profAvatarTexte}>
                    {prof.nom.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.profInfo}>
                  <Text style={styles.profNom}>{prof.nom}</Text>
                  <Text style={styles.profSpecialite}>{prof.specialite}</Text>
                </View>
                <View style={styles.profStatut}>
                  <View style={styles.pointVert} />
                  <Text style={styles.profStatutTexte}>Disponible</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Liste professeurs indisponibles */}
        {profsIndisponibles.length > 0 && (
          <>
            <Text style={[styles.sectionTitre, { color: '#4A6080' }]}>
              🔴 Professeurs indisponibles
            </Text>
            {profsIndisponibles.map((prof) => (
              <TouchableOpacity
                key={prof.id}
                style={[styles.profCard, styles.profCardIndisponible]}
                onPress={() => {
                  Alert.alert(
                    '🤖 Professeur indisponible',
                    `${prof.nom} n est pas disponible.\n\nAcademiAI va prendre le relais et repondre a vos questions ! 🤖`,
                    [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Chatter avec l IA', onPress: () => demarrerChatProf(prof) }
                    ]
                  );
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.profAvatar, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                  <Text style={[styles.profAvatarTexte, { color: '#4A6080' }]}>
                    {prof.nom.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.profInfo}>
                  <Text style={[styles.profNom, { color: '#4A6080' }]}>{prof.nom}</Text>
                  <Text style={styles.profSpecialite}>{prof.specialite}</Text>
                </View>
                <View style={[styles.profStatut, { gap: 4 }]}>
                  <Text style={{ fontSize: 10 }}>🔴</Text>
                  <Text style={[styles.profStatutTexte, { color: '#4A6080' }]}>Indisponible</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {professeurs.length === 0 && !chargement && (
          <View style={styles.videContainer}>
            <Text style={styles.videEmoji}>👨‍🏫</Text>
            <Text style={styles.videTitre}>Aucun professeur enregistre</Text>
            <Text style={styles.videTexte}>
              AcademiAI est disponible pour vous aider en attendant ! 🤖
            </Text>
            <TouchableOpacity style={styles.boutonIAVide} onPress={demarrerChatIA}>
              <Text style={styles.boutonIAVideTexte}>🤖 Chatter avec AcademiAI</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    );
  }

  // ─── ÉCRAN CHAT ──────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header chat */}
      <View style={styles.chatHeader}>
        <TouchableOpacity
          onPress={() => {
            setEtape('choix');
            setMessages([]);
            setProfesseurChoisi(null);
            setModeIA(false);
          }}
          style={styles.retourBtn}
        >
          <Text style={styles.retourTexte}>← Retour</Text>
        </TouchableOpacity>

        <View style={styles.chatHeaderCentre}>
          <View style={styles.chatAvatarSmall}>
            <Text style={styles.chatAvatarSmallTexte}>
              {modeIA ? '🤖' : professeurChoisi?.nom?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.chatHeaderNom}>
              {modeIA ? 'AcademiAI' : professeurChoisi?.nom}
            </Text>
            <View style={styles.chatHeaderStatut}>
              <View style={[styles.pointVert, modeIA && { backgroundColor: '#4A90D9' }]} />
              <Text style={styles.chatHeaderStatutTexte}>
                {iaEntrain ? 'En train d ecrire...' : modeIA ? 'IA Active' : 'En ligne'}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ width: 70 }} />
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
      />

      {/* Indicateur IA en train d'écrire */}
      {iaEntrain && (
        <View style={styles.iaEntrain}>
          <ActivityIndicator size="small" color="#4A90D9" />
          <Text style={styles.iaEntrainTexte}>AcademiAI reflechit...</Text>
        </View>
      )}

      {/* Zone saisie */}
      <View style={styles.saisieContainer}>
        <View style={styles.saisieInterne}>
          <TextInput
            style={styles.champSaisie}
            placeholder={modeIA ? 'Posez votre question a AcademiAI...' : 'Ecrivez votre message...'}
            placeholderTextColor="#4A6080"
            value={nouveauMessage}
            onChangeText={setNouveauMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.boutonEnvoyer,
              (!nouveauMessage.trim() || envoi) && styles.boutonEnvoyerDesactive,
              modeIA && styles.boutonEnvoyerIA
            ]}
            onPress={envoyerMessage}
            disabled={!nouveauMessage.trim() || envoi}
            activeOpacity={0.8}
          >
            {envoi ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.boutonEnvoyerIcone}>{modeIA ? '🤖' : '➤'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2044' },
  scroll: { flexGrow: 1, paddingBottom: 40, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 20 },
  retourBtn: { width: 70 },
  retourTexte: { color: '#4A90D9', fontSize: 14, fontWeight: '600' },
  headerTitre: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  banniere: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,193,7,0.1)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,193,7,0.25)', gap: 12 },
  banniereEmoji: { fontSize: 32 },
  banniereTitre: { fontSize: 15, fontWeight: 'bold', color: '#FFC107', marginBottom: 3 },
  banniereTexte: { fontSize: 12, color: '#A8C0DC' },
  boutonAppel: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,82,82,0.12)', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: 'rgba(255,82,82,0.4)', gap: 12 },
  boutonAppelEnvoye: { backgroundColor: 'rgba(76,175,80,0.12)', borderColor: 'rgba(76,175,80,0.4)' },
  boutonAppelIcone: { fontSize: 28 },
  boutonAppelTitre: { color: '#FF5252', fontSize: 15, fontWeight: '800', marginBottom: 3 },
  boutonAppelTexte: { color: '#A8C0DC', fontSize: 12 },
  urgenceBadge: { backgroundColor: '#FF5252', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  urgenceBadgeTexte: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  boutonIA: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74,144,217,0.1)', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(74,144,217,0.3)', gap: 12 },
  boutonIAIcone: { fontSize: 28 },
  boutonIATitre: { color: '#4A90D9', fontSize: 15, fontWeight: '800', marginBottom: 3 },
  boutonIATexte: { color: '#A8C0DC', fontSize: 12 },
  dispoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(76,175,80,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, gap: 4, borderWidth: 1, borderColor: 'rgba(76,175,80,0.3)' },
  pointVertPetit: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },
  dispoBadgeTexte: { color: '#4CAF50', fontSize: 10, fontWeight: '700' },
  sectionTitre: { color: '#8BA4C4', fontSize: 12, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  profCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12 },
  profCardIndisponible: { opacity: 0.5 },
  profAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,193,7,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,193,7,0.4)' },
  profAvatarTexte: { color: '#FFC107', fontSize: 14, fontWeight: '800' },
  profInfo: { flex: 1 },
  profNom: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  profSpecialite: { color: '#8BA4C4', fontSize: 12 },
  profStatut: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pointVert: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4CAF50' },
  profStatutTexte: { color: '#4CAF50', fontSize: 11, fontWeight: '600' },
  videContainer: { alignItems: 'center', paddingTop: 40, gap: 12 },
  videEmoji: { fontSize: 56 },
  videTitre: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  videTexte: { color: '#8BA4C4', fontSize: 13, textAlign: 'center' },
  boutonIAVide: { backgroundColor: '#4A90D9', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  boutonIAVideTexte: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 24, paddingBottom: 12, backgroundColor: '#0F2044', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  chatHeaderCentre: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatAvatarSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(74,144,217,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(74,144,217,0.4)' },
  chatAvatarSmallTexte: { fontSize: 16 },
  chatHeaderNom: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  chatHeaderStatut: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  chatHeaderStatutTexte: { color: '#4CAF50', fontSize: 11 },
  listeMessages: { paddingHorizontal: 16, paddingVertical: 16, gap: 4 },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8, gap: 8 },
  messageWrapperDroite: { flexDirection: 'row-reverse' },
  messageWrapperGauche: { flexDirection: 'row' },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarIA: { backgroundColor: 'rgba(74,144,217,0.2)', borderWidth: 1, borderColor: 'rgba(74,144,217,0.4)' },
  avatarProf: { backgroundColor: 'rgba(255,193,7,0.2)', borderWidth: 1, borderColor: 'rgba(255,193,7,0.4)' },
  avatarTexte: { fontSize: 16 },
  messageBulle: { maxWidth: '75%', gap: 2 },
  messageAuteur: { color: '#FFC107', fontSize: 11, fontWeight: '700', paddingHorizontal: 4, marginBottom: 2 },
  messageBulleInterne: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  messageBulleMoi: { backgroundColor: '#4A90D9', borderBottomRightRadius: 4 },
  messageBulleIA: { backgroundColor: 'rgba(74,144,217,0.15)', borderWidth: 1, borderColor: 'rgba(74,144,217,0.3)', borderBottomLeftRadius: 4 },
  messageBulleProf: { backgroundColor: 'rgba(255,193,7,0.12)', borderWidth: 1, borderColor: 'rgba(255,193,7,0.25)', borderBottomLeftRadius: 4 },
  messageTexte: { fontSize: 14, lineHeight: 21 },
  messageHeure: { fontSize: 10, color: '#4A6080', paddingHorizontal: 4 },
  messageSysteme: { alignItems: 'center', marginVertical: 8 },
  messageSystemeTexte: { color: '#4A6080', fontSize: 11, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  iaEntrain: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 8 },
  iaEntrainTexte: { color: '#4A90D9', fontSize: 12, fontStyle: 'italic' },
  saisieContainer: { backgroundColor: '#0F2044', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  saisieInterne: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  champSaisie: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, color: '#FFFFFF', fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  boutonEnvoyer: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4A90D9', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  boutonEnvoyerDesactive: { backgroundColor: 'rgba(74,144,217,0.3)', elevation: 0 },
  boutonEnvoyerIA: { backgroundColor: '#1565C0' },
  boutonEnvoyerIcone: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});