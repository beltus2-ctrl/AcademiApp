import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList, KeyboardAvoidingView, Platform,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';
import { API_URL } from '../../utils/config';
import { verifierEtDecrementerQuota } from '../../utils/quota';

interface Message {
  id: string;
  texte: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface ProfilEtudiant {
  nom: string;
  niveauxDebloques: string[];
  scores: Record<string, number>;
  xp: Record<string, number>;
}

const SUGGESTIONS_INITIALES = [
  '📚 Explique-moi un concept difficile',
  '🎯 Quels sont mes points faibles ?',
  '📝 Aide-moi a preparer mon examen',
  '💡 Donne-moi des conseils de revision',
  '🔍 Resous cet exercice avec moi',
  '⚡ Teste mes connaissances',
];

export default function TuteurIA() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomSafePadding = Math.max(insets.bottom + 8, 24);
  const [messages, setMessages] = useState<Message[]>([]);
  const [saisie, setSaisie] = useState('');
  const [chargement, setChargement] = useState(false);
  const [profilEtudiant, setProfilEtudiant] = useState<ProfilEtudiant | null>(null);
  const [iaEntrain, setIaEntrain] = useState(false);
  const [saisiFocus, setSaisiFocus] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const iaEntrainAnim = useRef(new Animated.Value(0)).current;
  const envoyerAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    chargerProfil();
    animerEntree();
    animerPulsation();
  }, []);

  useEffect(() => {
    if (iaEntrain) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(iaEntrainAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(iaEntrainAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      iaEntrainAnim.setValue(0);
    }
  }, [iaEntrain]);

  const animerEntree = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const animerPulsation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  };

  const animerEnvoyer = () => {
    Animated.sequence([
      Animated.timing(envoyerAnim, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(envoyerAnim, { toValue: 1, tension: 200, friction: 5, useNativeDriver: true }),
    ]).start();
  };

  const chargerProfil = async () => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    try {
      const profilSnap = await getDoc(doc(db, 'utilisateurs', utilisateur.uid));
      const progSnap = await getDoc(doc(db, 'progression', utilisateur.uid));

      const profilData = profilSnap.data();
      const progData = progSnap.data();

      const profil: ProfilEtudiant = {
        nom: profilData?.nom || 'Etudiant',
        niveauxDebloques: progData?.niveauxDebloques || ['facile'],
        scores: progData?.scores || {},
        xp: progData?.xp || {},
      };
      setProfilEtudiant(profil);

      const messagesBienvenue: Message[] = [
        {
          id: '1',
          texte: `Bonjour ${profil.nom} ! 👋 Je suis votre tuteur IA personnel.\n\nJ ai analyse votre profil :\n• Niveaux debloques : ${profil.niveauxDebloques.length}/4 🔓\n• XP total : ${Object.values(profil.xp).reduce((a: any, b: any) => a + (b || 0), 0)} ⚡\n\nJe suis la pour vous accompagner dans votre apprentissage. Posez-moi n importe quelle question — je m adapte a votre niveau ! 🎓`,
          role: 'assistant',
          timestamp: new Date(),
        }
      ];
      setMessages(messagesBienvenue);
    } catch (e) {}
  };

  const construireContexteProfil = () => {
    if (!profilEtudiant) return '';
    const xpTotal = Object.values(profilEtudiant.xp).reduce((a: any, b: any) => a + (b || 0), 0);
    const scoresMoyens = Object.entries(profilEtudiant.scores)
      .map(([niveau, score]) => `${niveau}: ${score}%`)
      .join(', ');

    return `
PROFIL DE L ETUDIANT :
- Nom : ${profilEtudiant.nom}
- Niveaux debloques : ${profilEtudiant.niveauxDebloques.join(', ')}
- XP total : ${xpTotal}
- Scores par niveau : ${scoresMoyens || 'Aucun score encore'}
- Etablissement : IUT de Douala, Cameroun

INSTRUCTIONS :
Tu es AcademiAI, un tuteur bienveillant et expert adapte au niveau de cet etudiant.
Reponds toujours en francais, de facon claire et pedagogique.
Adapte la complexite de tes reponses au niveau de l etudiant.
Encourage l etudiant, sois chaleureux et motivant.
Si tu donnes des exercices, adapte-les a son niveau.
Maximum 400 mots par reponse sauf si l etudiant demande plus de details.
    `.trim();
  };

  const envoyerMessage = async (texteManuel?: string) => {
    const texte = texteManuel || saisie.trim();
    if (!texte || chargement) return;
    animerEnvoyer();
    setSaisie('');
    setChargement(true);

    const nouveauMessageUser: Message = {
      id: Date.now().toString(),
      texte,
      role: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, nouveauMessageUser]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    const quota = await verifierEtDecrementerQuota();
    if (!quota.autorise) {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_quota',
        texte: '⚠️ Quota journalier atteint. Revenez demain pour continuer ! 📅',
        role: 'assistant',
        timestamp: new Date(),
      }]);
      setChargement(false);
      return;
    }

    setIaEntrain(true);
    try {
      const historique = messages
        .filter(m => m.role !== 'assistant' || messages.indexOf(m) > 0)
        .slice(-6)
        .map(m => `${m.role === 'user' ? 'Etudiant' : 'Tuteur'}: ${m.texte}`)
        .join('\n');

      const response = await fetch(`${API_URL}/tuteur-ia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: texte,
          contexte: construireContexteProfil(),
          historique,
        })
      });

      const data = await response.json();
      const reponseIA: Message = {
        id: Date.now().toString() + '_ia',
        texte: data.reponse || 'Je n ai pas pu generer une reponse. Reessayez.',
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, reponseIA]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_err',
        texte: '🔌 Connexion impossible. Verifiez que le backend est lance.',
        role: 'assistant',
        timestamp: new Date(),
      }]);
    } finally {
      setChargement(false);
      setIaEntrain(false);
    }
  };

  const formaterHeure = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const estUser = item.role === 'user';
    const messagePrec = messages[index - 1];
    const memeRole = messagePrec?.role === item.role;

    return (
      <View style={[
        styles.messageWrapper,
        estUser ? styles.messageWrapperDroite : styles.messageWrapperGauche,
        memeRole && { marginTop: 2 }
      ]}>
        {!estUser && !memeRole && (
          <Animated.View style={[styles.avatarIA, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.avatarIATexte}>🤖</Text>
          </Animated.View>
        )}
        {!estUser && memeRole && <View style={styles.avatarEspaceur} />}

        <View style={styles.messageBulle}>
          {!estUser && !memeRole && (
            <Text style={styles.messageAuteur}>AcademiAI • Tuteur Personnel</Text>
          )}
          <View style={[
            styles.messageBulleInterne,
            estUser ? styles.messageBulleUser : styles.messageBulleIA
          ]}>
            <Text style={[
              styles.messageTexte,
              estUser ? styles.messageTexteUser : styles.messageTexteIA
            ]}>
              {item.texte}
            </Text>
          </View>
          <Text style={[styles.messageHeure, estUser && { textAlign: 'right' }]}>
            {formaterHeure(item.timestamp)}
            {estUser && <Text style={{ color: '#4A90D9' }}> ✓✓</Text>}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'android' ? 90 : 0}
    >
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
          <Text style={styles.retourTexte}>← Retour</Text>
        </TouchableOpacity>
        <View style={styles.headerCentre}>
          <Animated.View style={[styles.headerAvatar, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.headerAvatarTexte}>🤖</Text>
          </Animated.View>
          <View>
            <Text style={styles.headerTitre}>Tuteur IA</Text>
            <View style={styles.headerStatut}>
              <Animated.View style={[styles.statutPoint, { opacity: iaEntrainAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]} />
              <Text style={styles.headerStatutTexte}>
                {iaEntrain ? 'En train de reflechir...' : 'Pret a vous aider'}
              </Text>
            </View>
          </View>
        </View>
        <View style={{ width: 70 }} />
      </Animated.View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listeMessages}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          messages.length <= 1 ? (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitre}>💬 Questions suggérées</Text>
              <View style={styles.suggestionsGrille}>
                {SUGGESTIONS_INITIALES.map((suggestion, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.suggestionBtn}
                    onPress={() => envoyerMessage(suggestion.slice(2))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionTexte}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null
        }
      />

      {/* Indicateur IA en train d'écrire */}
      {iaEntrain && (
        <View style={styles.iaEntrainContainer}>
          <Animated.Text style={[styles.iaEntrainTexte, { opacity: iaEntrainAnim }]}>
            🤖 AcademiAI reflechit...
          </Animated.Text>
        </View>
      )}

      {/* Zone saisie */}
      <View style={styles.saisieContainer}>
        <View style={[styles.saisieWrapper, saisiFocus && styles.saisieWrapperFocus]}>
          <TextInput
            style={styles.champSaisie}
            placeholder="Posez votre question au tuteur..."
            placeholderTextColor="#4A6080"
            value={saisie}
            onChangeText={setSaisie}
            multiline
            maxLength={500}
            onFocus={() => setSaisiFocus(true)}
            onBlur={() => setSaisiFocus(false)}
          />
          <Animated.View style={{ transform: [{ scale: envoyerAnim }] }}>
            <TouchableOpacity
              style={[styles.boutonEnvoyer, (!saisie.trim() || chargement) && styles.boutonEnvoyerDesactive]}
              onPress={() => envoyerMessage()}
              disabled={!saisie.trim() || chargement}
              activeOpacity={0.8}
            >
              {chargement ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.boutonEnvoyerIcone}>🚀</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2044' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#0A1628', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  retourBtn: { width: 70 },
  retourTexte: { color: '#4A90D9', fontSize: 14, fontWeight: '600' },
  headerCentre: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(74,144,217,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(74,144,217,0.4)' },
  headerAvatarTexte: { fontSize: 20 },
  headerTitre: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  headerStatut: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statutPoint: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4CAF50' },
  headerStatutTexte: { color: '#4CAF50', fontSize: 11 },
  listeMessages: { paddingHorizontal: 16, paddingVertical: 16, gap: 4 },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8, gap: 8 },
  messageWrapperDroite: { flexDirection: 'row-reverse' },
  messageWrapperGauche: { flexDirection: 'row' },
  avatarIA: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(74,144,217,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(74,144,217,0.4)', flexShrink: 0 },
  avatarIATexte: { fontSize: 16 },
  avatarEspaceur: { width: 32 },
  messageBulle: { maxWidth: '78%', gap: 2 },
  messageAuteur: { color: '#4A90D9', fontSize: 10, fontWeight: '700', paddingHorizontal: 4, marginBottom: 2 },
  messageBulleInterne: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  messageBulleUser: { backgroundColor: '#4A90D9', borderBottomRightRadius: 4 },
  messageBulleIA: { backgroundColor: 'rgba(74,144,217,0.1)', borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', borderBottomLeftRadius: 4 },
  messageTexte: { fontSize: 14, lineHeight: 22 },
  messageTexteUser: { color: '#FFFFFF' },
  messageTexteIA: { color: '#E8F0FE' },
  messageHeure: { fontSize: 10, color: '#4A6080', paddingHorizontal: 4 },
  suggestionsContainer: { marginTop: 16, gap: 10 },
  suggestionsTitre: { color: '#8BA4C4', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  suggestionsGrille: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionBtn: { backgroundColor: 'rgba(74,144,217,0.1)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)' },
  suggestionTexte: { color: '#4A90D9', fontSize: 12, fontWeight: '600' },
  iaEntrainContainer: { paddingHorizontal: 24, paddingVertical: 6 },
  iaEntrainTexte: { color: '#4A90D9', fontSize: 12, fontStyle: 'italic' },
  saisieContainer: { paddingBottom: Platform.OS === 'android' ? 24 : 10, backgroundColor: '#0A1628', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  saisieWrapper: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', gap: 10 },
  saisieWrapperFocus: { borderColor: '#4A90D9', backgroundColor: 'rgba(74,144,217,0.08)' },
  champSaisie: { flex: 1, color: '#FFFFFF', fontSize: 14, maxHeight: 100, paddingVertical: 8 },
  boutonEnvoyer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4A90D9', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  boutonEnvoyerDesactive: { backgroundColor: 'rgba(74,144,217,0.3)', elevation: 0 },
  boutonEnvoyerIcone: { fontSize: 18 },
});