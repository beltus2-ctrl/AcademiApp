import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
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
    updateDoc,
    where
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert,
    Animated,
    FlatList, KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db, storage } from '../../firebaseConfig';

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

interface Salon {
  id: string;
  code: string;
  titre: string;
  profId: string;
  profNom: string;
  participants: number;
  actif: boolean;
  timestamp: any;
}

const genererCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const normaliserNomFichier = (nom: string) => {
  const nomNettoye = nom.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  return nomNettoye || 'document';
};

export default function SalonCorrections() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomSafePadding = Math.max(insets.bottom + 8, 24);
  const [etape, setEtape] = useState<'accueil' | 'salon'>('accueil');
  const [salon, setSalon] = useState<Salon | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [nouveauMessage, setNouveauMessage] = useState('');
  const [profil, setProfil] = useState<any>(null);
  const [chargement, setChargement] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [nbParticipants, setNbParticipants] = useState(0);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteEtudiant, setNoteEtudiant] = useState('');
  const [noteValeur, setNoteValeur] = useState('');
  const [salonsExistants, setSalonsExistants] = useState<Salon[]>([]);
  const [showTitreModal, setShowTitreModal] = useState(false);
  const [titreSalon, setTitreSalon] = useState('');
  const [documentEnvoi, setDocumentEnvoi] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const codeAnim = useRef(new Animated.Value(1)).current;
  const noteModalAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    chargerProfil();
    animerEntree();
    animerPulsation();
  }, []);

  useEffect(() => {
    if (salon) {
      const unsubMessages = ecouterMessages();
      const unsubParticipants = ecouterParticipants();
      return () => {
        unsubMessages();
        unsubParticipants();
      };
    }
  }, [salon]);

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

  const animerCode = () => {
    Animated.sequence([
      Animated.timing(codeAnim, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.spring(codeAnim, { toValue: 1, tension: 200, friction: 5, useNativeDriver: true }),
    ]).start();
  };

  const ouvrirNoteModal = () => {
    setShowNoteModal(true);
    Animated.spring(noteModalAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  };

  const fermerNoteModal = () => {
    Animated.timing(noteModalAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowNoteModal(false);
      setNoteEtudiant('');
      setNoteValeur('');
    });
  };

  const chargerProfil = async () => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    try {
      const docSnap = await getDoc(doc(db, 'utilisateurs', utilisateur.uid));
      if (docSnap.exists()) setProfil(docSnap.data());

      const salonsSnap = await getDocs(
        query(collection(db, 'salons'), where('profId', '==', utilisateur.uid))
      );
      const liste: Salon[] = salonsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Salon));
      setSalonsExistants(liste.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    } catch (e) {}
  };

  const ecouterMessages = () => {
    if (!salon) return () => {};
    const q = query(
      collection(db, `salons/${salon.id}/messages`),
      orderBy('timestamp', 'asc')
    );
    return onSnapshot(q, snap => {
      const msgs: Message[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
  };

  const ecouterParticipants = () => {
    if (!salon) return () => {};
    return onSnapshot(doc(db, 'salons', salon.id), snap => {
      if (snap.exists()) {
        setNbParticipants(snap.data().participants || 0);
      }
    });
  };

  const creerSalon = async (titre: string) => {
    const utilisateur = auth.currentUser;
    if (!utilisateur || !profil) return;
    setChargement(true);
    try {
      const code = genererCode();
      const nouveauSalon = await addDoc(collection(db, 'salons'), {
        code,
        titre,
        profId: utilisateur.uid,
        profNom: profil.nom,
        participants: 0,
        actif: true,
        timestamp: serverTimestamp(),
      });

      const salonData: Salon = {
        id: nouveauSalon.id,
        code,
        titre,
        profId: utilisateur.uid,
        profNom: profil.nom,
        participants: 0,
        actif: true,
        timestamp: null,
      };

      await addDoc(collection(db, `salons/${nouveauSalon.id}/messages`), {
        texte: `🎓 Salon "${titre}" ouvert par ${profil.nom} ! Bienvenue a tous les etudiants. Ce salon est en lecture seule pour les etudiants — seul le professeur peut publier des corrections et notes.`,
        auteur: 'Systeme',
        auteurId: 'systeme',
        type: 'systeme',
        timestamp: serverTimestamp(),
      });

      setSalon(salonData);
      setSalonsExistants(prev => [salonData, ...prev]);
      setEtape('salon');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de creer le salon.');
    } finally {
      setChargement(false);
    }
  };

  const rejoindreAnciensalon = async (salonChoisi: Salon) => {
    setSalon(salonChoisi);
    setEtape('salon');
  };

  const demanderTitreSalon = () => {
    setTitreSalon(`Corrections - ${new Date().toLocaleDateString('fr-FR')}`);
    setShowTitreModal(true);
    if (Platform.OS === 'ios') return;

    Alert.prompt(
      '📝 Nom du salon',
      'Donnez un titre a ce salon de corrections',
      async (titre) => {
        if (!titre?.trim()) return;
        await creerSalon(titre.trim());
      },
      'plain-text',
      `Corrections - ${new Date().toLocaleDateString('fr-FR')}`
    );
  };

  const fermerTitreModal = () => {
    if (chargement) return;
    setShowTitreModal(false);
    setTitreSalon('');
  };

  const validerTitreSalon = async () => {
    const titre = titreSalon.trim();
    if (!titre || chargement) return;
    setShowTitreModal(false);
    await creerSalon(titre);
  };

  const envoyerMessage = async () => {
    if (!nouveauMessage.trim() || !salon || envoi) return;
    const texte = nouveauMessage.trim();
    setNouveauMessage('');
    setEnvoi(true);
    try {
      await addDoc(collection(db, `salons/${salon.id}/messages`), {
        texte,
        auteur: profil?.nom || 'Professeur',
        auteurId: auth.currentUser?.uid,
        type: 'texte',
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d envoyer.');
      setNouveauMessage(texte);
    } finally {
      setEnvoi(false);
    }
  };

  const envoyerDocument = async () => {
    if (!salon || documentEnvoi) return;
    setDocumentEnvoi(true);
    try {
      const resultat = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (resultat.canceled) return;
      const fichier = resultat.assets[0];
      const nomFichier = fichier.name || 'document';
      const chemin = `salons/${salon.id}/documents/${Date.now()}-${normaliserNomFichier(nomFichier)}`;
      const reponse = await fetch(fichier.uri);
      const blob = await reponse.blob();
      const refFichier = storageRef(storage, chemin);

      await uploadBytes(refFichier, blob, {
        contentType: fichier.mimeType || 'application/octet-stream',
      });
      const documentUrl = await getDownloadURL(refFichier);

      await addDoc(collection(db, `salons/${salon.id}/messages`), {
        texte: `📎 Document partage : ${fichier.name}`,
        auteur: profil?.nom || 'Professeur',
        auteurId: auth.currentUser?.uid,
        type: 'document',
        documentNom: nomFichier,
        documentUrl,
        documentMimeType: fichier.mimeType || null,
        documentSize: fichier.size || null,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de partager le document.');
    } finally {
      setDocumentEnvoi(false);
    }
  };

  const envoyerNote = async () => {
    if (!noteEtudiant.trim() || !noteValeur.trim()) {
      Alert.alert('Champs manquants', 'Entrez le nom de l etudiant et sa note.');
      return;
    }
    try {
      await addDoc(collection(db, `salons/${salon!.id}/messages`), {
        texte: `📊 Note publiee pour ${noteEtudiant} : ${noteValeur}`,
        auteur: profil?.nom || 'Professeur',
        auteurId: auth.currentUser?.uid,
        type: 'note',
        noteEtudiant: noteEtudiant.trim(),
        noteValeur: noteValeur.trim(),
        timestamp: serverTimestamp(),
      });
      fermerNoteModal();
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de publier la note.');
    }
  };

  const partagerLienSalon = async () => {
    if (!salon) return;
    animerCode();
    const message = `🎓 *Salon de Corrections AcademiApp*\n\n📚 *${salon.titre}*\n👨‍🏫 Professeur : ${profil?.nom}\n\n🔑 *Code d acces : ${salon.code}*\n\n📱 Ouvrez AcademiApp, puis Corrections, puis entrez le code *${salon.code}* pour acceder aux corrections et notes.\n\n_Partage via AcademiApp IUT Douala_`;
    try {
      await Share.share({ message, title: `Salon ${salon.code}` });
    } catch (e) {}
  };

  const copierCode = async () => {
    if (!salon) return;
    animerCode();
    await Clipboard.setStringAsync(salon.code);
    Alert.alert('✅ Code copie !', `Code "${salon.code}" copie dans le presse-papier !`);
  };

  const fermerSalon = async () => {
    if (!salon) return;
    Alert.alert(
      '🔒 Fermer le salon ?',
      'Les etudiants ne pourront plus acceder a ce salon.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Fermer',
          style: 'destructive',
          onPress: async () => {
            await updateDoc(doc(db, 'salons', salon.id), { actif: false });
            await addDoc(collection(db, `salons/${salon.id}/messages`), {
              texte: '🔒 Ce salon a ete ferme par le professeur. Merci a tous !',
              auteur: 'Systeme',
              auteurId: 'systeme',
              type: 'systeme',
              timestamp: serverTimestamp(),
            });
            setEtape('accueil');
            setSalon(null);
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
            <View style={styles.noteEtudiantRow}>
              <Text style={styles.noteEtudiantLabel}>Etudiant :</Text>
              <Text style={styles.noteEtudiantNom}>{item.noteEtudiant}</Text>
            </View>
            <View style={styles.noteValeurContainer}>
              <Text style={styles.noteValeurLabel}>Note obtenue</Text>
              <Text style={styles.noteValeurTexte}>{item.noteValeur}</Text>
            </View>
          </View>
        </View>
      );
    }
    if (item.type === 'document') {
      return (
        <View style={styles.documentCard}>
          <View style={styles.documentIconeContainer}>
            <Text style={styles.documentIcone}>📎</Text>
          </View>
          <View style={styles.documentInfo}>
            <Text style={styles.documentTitre}>Document partage</Text>
            <Text style={styles.documentNom}>{item.documentNom}</Text>
            <Text style={styles.documentHeure}>{formaterHeure(item.timestamp)}</Text>
          </View>
          <View style={styles.documentBadge}>
            <Text style={styles.documentBadgeTexte}>Prof</Text>
          </View>
        </View>
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

  // ─── ÉCRAN ACCUEIL ───────────────────────────────────────────────
  if (etape === 'accueil') {
    return (
      <>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
            <Text style={styles.retourTexte}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitre}>Corrections</Text>
          <View style={{ width: 70 }} />
        </Animated.View>

        {/* Bannière principale */}
        <Animated.View style={[styles.banniere, { opacity: fadeAnim }]}>
          <Animated.View style={[styles.banniereIconeWrapper, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.banniereIcone}>🎓</Text>
          </Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={styles.banniereTitre}>Salon de Corrections</Text>
            <Text style={styles.banniereTexte}>
              Creez un salon prive — partagez le code avec vos etudiants via WhatsApp ou autres reseaux sociaux !
            </Text>
          </View>
        </Animated.View>

        {/* Fonctionnement */}
        <Animated.View style={[styles.fonctionnementContainer, { opacity: fadeAnim }]}>
          <Text style={styles.fonctionnementTitre}>⚡ Comment ca marche ?</Text>
          {[
            { num: '1', texte: 'Creez un salon avec un titre', couleur: '#4A90D9' },
            { num: '2', texte: 'Partagez le code sur WhatsApp', couleur: '#4CAF50' },
            { num: '3', texte: 'Les etudiants entrent le code', couleur: '#FFC107' },
            { num: '4', texte: 'Publiez corrections et notes', couleur: '#AB47BC' },
          ].map((etapeInfo, i) => (
            <View key={i} style={styles.etapeItem}>
              <View style={[styles.etapeNum, { backgroundColor: etapeInfo.couleur + '33', borderColor: etapeInfo.couleur + '66' }]}>
                <Text style={[styles.etapeNumTexte, { color: etapeInfo.couleur }]}>{etapeInfo.num}</Text>
              </View>
              <Text style={styles.etapeTexte}>{etapeInfo.texte}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Bouton créer */}
        <TouchableOpacity
          style={styles.boutonCreer}
          onPress={demanderTitreSalon}
          disabled={chargement}
          activeOpacity={0.8}
        >
          {chargement ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.boutonCreerIcone}>✨</Text>
              <Text style={styles.boutonCreerTexte}>Creer un nouveau salon</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Salons existants */}
        {salonsExistants.length > 0 && (
          <>
            <Text style={styles.sectionTitre}>📋 Vos salons precedents</Text>
            {salonsExistants.map(s => (
              <TouchableOpacity
                key={s.id}
                style={[styles.salonCard, !s.actif && styles.salonCardInactif]}
                onPress={() => s.actif ? rejoindreAnciensalon(s) : null}
                activeOpacity={s.actif ? 0.75 : 1}
              >
                <View style={[styles.salonCode, { backgroundColor: s.actif ? 'rgba(74,144,217,0.2)' : 'rgba(255,255,255,0.05)' }]}>
                  <Text style={[styles.salonCodeTexte, { color: s.actif ? '#4A90D9' : '#4A6080' }]}>
                    {s.code}
                  </Text>
                </View>
                <View style={styles.salonInfo}>
                  <Text style={[styles.salonTitre, !s.actif && { color: '#4A6080' }]}>{s.titre}</Text>
                  <Text style={styles.salonParticipants}>
                    {s.participants} participant(s)
                  </Text>
                </View>
                <View style={[
                  styles.salonStatut,
                  { backgroundColor: s.actif ? 'rgba(76,175,80,0.2)' : 'rgba(255,82,82,0.2)' }
                ]}>
                  <Text style={[styles.salonStatutTexte, { color: s.actif ? '#4CAF50' : '#FF5252' }]}>
                    {s.actif ? '🟢 Actif' : '🔴 Ferme'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

      </ScrollView>

      <Modal visible={showTitreModal} transparent animationType="fade" onRequestClose={fermerTitreModal}>
        <KeyboardAvoidingView
          style={styles.titreModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.titreModal}>
            <View style={styles.noteModalHeader}>
              <Text style={styles.noteModalTitre}>Nom du salon</Text>
              <Text style={styles.noteModalSous}>
                Donnez un titre a ce salon de corrections
              </Text>
            </View>

            <TextInput
              style={styles.noteModalChamp}
              placeholder="Ex: Corrections examen POO"
              placeholderTextColor="#4A6080"
              value={titreSalon}
              onChangeText={setTitreSalon}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={validerTitreSalon}
            />

            <TouchableOpacity
              style={[styles.noteModalBouton, !titreSalon.trim() && styles.boutonDesactive]}
              onPress={validerTitreSalon}
              disabled={!titreSalon.trim() || chargement}
              activeOpacity={0.8}
            >
              {chargement ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.noteModalBoutonTexte}>Creer le salon</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.noteModalAnnuler} onPress={fermerTitreModal} disabled={chargement}>
              <Text style={styles.noteModalAnnulerTexte}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </>
    );
  }

  // ─── ÉCRAN SALON ─────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header salon */}
      <View style={styles.salonHeader}>
        <TouchableOpacity onPress={() => setEtape('accueil')} style={styles.retourBtn}>
          <Text style={styles.retourTexte}>← Retour</Text>
        </TouchableOpacity>
        <View style={styles.salonHeaderCentre}>
          <Text style={styles.salonHeaderTitre} numberOfLines={1}>{salon?.titre}</Text>
          <View style={styles.salonHeaderStatut}>
            <View style={styles.pointVert} />
            <Text style={styles.salonHeaderStatutTexte}>{nbParticipants} connecte(s)</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.fermerBtn} onPress={fermerSalon}>
          <Text style={styles.fermerBtnTexte}>🔒</Text>
        </TouchableOpacity>
      </View>

      {/* Carte code partageable */}
      <View style={styles.codeSalonContainer}>
        <View style={styles.codeSalonGauche}>
          <Text style={styles.codeSalonLabel}>🔑 CODE D ACCES</Text>
          <Animated.Text style={[styles.codeSalonCode, { transform: [{ scale: codeAnim }] }]}>
            {salon?.code}
          </Animated.Text>
          <Text style={styles.codeSalonSous}>Partagez ce code avec vos etudiants</Text>
        </View>
        <View style={styles.codeSalonActions}>
          <TouchableOpacity style={styles.codeBouton} onPress={copierCode}>
            <Text style={styles.codeBoutonIcone}>📋</Text>
            <Text style={styles.codeBoutonTexte}>Copier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.codeBouton, styles.codeBoutonPartager]} onPress={partagerLienSalon}>
            <Text style={styles.codeBoutonIcone}>📤</Text>
            <Text style={[styles.codeBoutonTexte, { color: '#4CAF50' }]}>Partager</Text>
          </TouchableOpacity>
        </View>
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
            <Text style={styles.videEmoji}>📝</Text>
            <Text style={styles.videTitre}>Salon pret !</Text>
            <Text style={styles.videTexte}>
              Partagez le code {salon?.code} avec vos etudiants puis publiez vos corrections.
            </Text>
          </View>
        }
      />

      {/* Outils professeur */}
      <View style={styles.outilsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.outilsScroll}>
          <TouchableOpacity style={[styles.outilBtn, documentEnvoi && styles.outilBtnDesactive]} onPress={envoyerDocument} disabled={documentEnvoi}>
            <Text style={styles.outilBtnIcone}>📎</Text>
            <Text style={styles.outilBtnTexte}>{documentEnvoi ? 'Envoi...' : 'Document'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.outilBtn, { borderColor: 'rgba(255,193,7,0.4)' }]} onPress={ouvrirNoteModal}>
            <Text style={styles.outilBtnIcone}>📊</Text>
            <Text style={[styles.outilBtnTexte, { color: '#FFC107' }]}>Note</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.outilBtn, { borderColor: 'rgba(76,175,80,0.4)' }]} onPress={copierCode}>
            <Text style={styles.outilBtnIcone}>🔑</Text>
            <Text style={[styles.outilBtnTexte, { color: '#4CAF50' }]}>Code</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.outilBtn, { borderColor: 'rgba(171,71,188,0.4)' }]} onPress={partagerLienSalon}>
            <Text style={styles.outilBtnIcone}>📤</Text>
            <Text style={[styles.outilBtnTexte, { color: '#AB47BC' }]}>Partager</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Zone saisie */}
        <View style={[styles.saisieContainer, { paddingBottom: bottomSafePadding }]}>
          <TextInput
            style={styles.champSaisie}
            placeholder="Publiez une correction ou un commentaire..."
            placeholderTextColor="#4A6080"
            value={nouveauMessage}
            onChangeText={setNouveauMessage}
            multiline
            maxLength={1000}
          />
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
        </View>
      </View>

      {/* Modal note */}
      <Modal visible={showNoteModal} transparent animationType="none">
        <TouchableOpacity style={styles.modalOverlay} onPress={fermerNoteModal} activeOpacity={1}>
          <Animated.View style={[styles.noteModal, {
            opacity: noteModalAnim,
            transform: [{ scale: noteModalAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }]
          }]}>
            <View style={styles.noteModalHeader}>
              <Text style={styles.noteModalTitre}>📊 Publier une note</Text>
              <Text style={styles.noteModalSous}>
                La note sera visible par tous les etudiants du salon
              </Text>
            </View>

            <Text style={styles.noteModalLabel}>👤 Nom de l etudiant</Text>
            <TextInput
              style={styles.noteModalChamp}
              placeholder="Ex: Franklin FOKA"
              placeholderTextColor="#4A6080"
              value={noteEtudiant}
              onChangeText={setNoteEtudiant}
            />

            <Text style={styles.noteModalLabel}>📊 Note obtenue</Text>
            <TextInput
              style={styles.noteModalChamp}
              placeholder="Ex: 15/20 ou 75% ou B+"
              placeholderTextColor="#4A6080"
              value={noteValeur}
              onChangeText={setNoteValeur}
            />

            <TouchableOpacity
              style={[styles.noteModalBouton, (!noteEtudiant.trim() || !noteValeur.trim()) && styles.boutonDesactive]}
              onPress={envoyerNote}
              disabled={!noteEtudiant.trim() || !noteValeur.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.noteModalBoutonTexte}>📊 Publier la note</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.noteModalAnnuler} onPress={fermerNoteModal}>
              <Text style={styles.noteModalAnnulerTexte}>Annuler</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

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
  banniere: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74,144,217,0.1)', borderRadius: 18, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', gap: 14 },
  banniereIconeWrapper: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(74,144,217,0.2)', alignItems: 'center', justifyContent: 'center' },
  banniereIcone: { fontSize: 28 },
  banniereTitre: { color: '#4A90D9', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  banniereTexte: { color: '#A8C0DC', fontSize: 12, lineHeight: 18 },
  fonctionnementContainer: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12 },
  fonctionnementTitre: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  etapeItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  etapeNum: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0 },
  etapeNumTexte: { fontSize: 14, fontWeight: '900' },
  etapeTexte: { color: '#A8C0DC', fontSize: 13 },
  boutonCreer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4A90D9', borderRadius: 14, padding: 16, marginBottom: 24, gap: 10, elevation: 6 },
  boutonCreerIcone: { fontSize: 22 },
  boutonCreerTexte: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  sectionTitre: { color: '#8BA4C4', fontSize: 12, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1.5 },
  salonCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12 },
  salonCardInactif: { opacity: 0.5 },
  salonCode: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  salonCodeTexte: { fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  salonInfo: { flex: 1 },
  salonTitre: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  salonParticipants: { color: '#8BA4C4', fontSize: 11 },
  salonStatut: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  salonStatutTexte: { fontSize: 11, fontWeight: '700' },
  salonHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#0A1628', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  salonHeaderCentre: { flex: 1, alignItems: 'center' },
  salonHeaderTitre: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  salonHeaderStatut: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  pointVert: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4CAF50' },
  salonHeaderStatutTexte: { color: '#4CAF50', fontSize: 11 },
  fermerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,82,82,0.15)', alignItems: 'center', justifyContent: 'center' },
  fermerBtnTexte: { fontSize: 18 },
  codeSalonContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74,144,217,0.08)', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(74,144,217,0.2)', gap: 14 },
  codeSalonGauche: { flex: 1 },
  codeSalonLabel: { color: '#4A6080', fontSize: 9, fontWeight: '800', letterSpacing: 2, marginBottom: 4 },
  codeSalonCode: { color: '#4A90D9', fontSize: 28, fontWeight: '900', letterSpacing: 6 },
  codeSalonSous: { color: '#4A6080', fontSize: 10, marginTop: 2 },
  codeSalonActions: { flexDirection: 'row', gap: 8 },
  codeBouton: { alignItems: 'center', backgroundColor: 'rgba(74,144,217,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(74,144,217,0.3)', gap: 3 },
  codeBoutonPartager: { backgroundColor: 'rgba(76,175,80,0.12)', borderColor: 'rgba(76,175,80,0.3)' },
  codeBoutonIcone: { fontSize: 18 },
  codeBoutonTexte: { color: '#4A90D9', fontSize: 10, fontWeight: '700' },
  listeMessages: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  videContainer: { alignItems: 'center', paddingTop: 40, gap: 12 },
  videEmoji: { fontSize: 48 },
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
  messageBulleInterne: { backgroundColor: 'rgba(255,193,7,0.08)', borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,193,7,0.2)' },
  messageTexte: { color: '#E8F0FE', fontSize: 14, lineHeight: 22 },
  messageHeure: { color: '#4A6080', fontSize: 10, paddingHorizontal: 4 },
  noteCard: { backgroundColor: 'rgba(255,193,7,0.08)', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: 'rgba(255,193,7,0.35)', gap: 12 },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteIcone: { fontSize: 22 },
  noteTitre: { flex: 1, color: '#FFC107', fontSize: 13, fontWeight: '700' },
  noteHeure: { color: '#4A6080', fontSize: 10 },
  noteContenu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noteEtudiantRow: { gap: 2 },
  noteEtudiantLabel: { color: '#8BA4C4', fontSize: 11 },
  noteEtudiantNom: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  noteValeurContainer: { backgroundColor: 'rgba(76,175,80,0.15)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(76,175,80,0.35)' },
  noteValeurLabel: { color: '#8BA4C4', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 },
  noteValeurTexte: { color: '#4CAF50', fontSize: 22, fontWeight: '900' },
  documentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74,144,217,0.08)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', gap: 12 },
  documentIconeContainer: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(74,144,217,0.2)', alignItems: 'center', justifyContent: 'center' },
  documentIcone: { fontSize: 22 },
  documentInfo: { flex: 1 },
  documentTitre: { color: '#4A90D9', fontSize: 12, fontWeight: '700', marginBottom: 2 },
  documentNom: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  documentHeure: { color: '#4A6080', fontSize: 10, marginTop: 2 },
  documentBadge: { backgroundColor: 'rgba(255,193,7,0.2)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,193,7,0.4)' },
  documentBadgeTexte: { color: '#FFC107', fontSize: 10, fontWeight: '700' },
  outilsContainer: { backgroundColor: '#0A1628', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 8 },
  outilsScroll: { paddingHorizontal: 16, marginBottom: 8 },
  outilBtn: { alignItems: 'center', backgroundColor: 'rgba(74,144,217,0.1)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: 'rgba(74,144,217,0.3)', gap: 3 },
  outilBtnDesactive: { opacity: 0.55 },
  outilBtnIcone: { fontSize: 20 },
  outilBtnTexte: { color: '#4A90D9', fontSize: 10, fontWeight: '700' },
  saisieContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  champSaisie: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, color: '#FFFFFF', fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  boutonEnvoyer: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4A90D9', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  boutonEnvoyerDesactive: { backgroundColor: 'rgba(74,144,217,0.3)', elevation: 0 },
  boutonEnvoyerIcone: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  titreModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  titreModal: { backgroundColor: '#0A1628', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  noteModal: { backgroundColor: '#0A1628', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  noteModalHeader: { marginBottom: 8 },
  noteModalTitre: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  noteModalSous: { color: '#8BA4C4', fontSize: 12, marginTop: 2 },
  noteModalLabel: { color: '#8BA4C4', fontSize: 13, fontWeight: '600' },
  noteModalChamp: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14, color: '#FFFFFF', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  noteModalBouton: { backgroundColor: '#FFC107', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  noteModalBoutonTexte: { color: '#000000', fontWeight: '800', fontSize: 15 },
  boutonDesactive: { opacity: 0.35 },
  noteModalAnnuler: { alignItems: 'center', padding: 12 },
  noteModalAnnulerTexte: { color: '#4A6080', fontSize: 14 },
});
