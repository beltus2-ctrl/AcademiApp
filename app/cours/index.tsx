import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { obtenirQuota, verifierEtDecrementerQuota } from '../../utils/quota';

import { API_URL } from '../../utils/config';

export default function Cours() {
  const router = useRouter();
  const [titre, setTitre] = useState('');
  const [notes, setNotes] = useState('');
  const [filiere, setFiliere] = useState('');
  const [niveau, setNiveau] = useState('');
  const [reponse, setReponse] = useState('');
  const [chargement, setChargement] = useState(false);
  const [mode, setMode] = useState('resumer');
  const [reponseOuverte, setReponseOuverte] = useState(true);
  const [quotaRestant, setQuotaRestant] = useState<number | null>(null);

  useEffect(() => {
    const chargerQuota = async () => {
      const quota = await obtenirQuota();
      setQuotaRestant(quota);
    };
    chargerQuota();
  }, []);

  const resumerChapitre = async () => {
    if (!titre.trim()) {
      Alert.alert('Champ manquant', 'Veuillez entrer un titre de chapitre');
      return;
    }
    setChargement(true);
    const quota = await verifierEtDecrementerQuota();
    if (!quota.autorise) {
      Alert.alert('⚠️ Quota atteint', quota.message || 'Reessayez demain.');
      setChargement(false);
      return;
    }
    setQuotaRestant(quota.requetesRestantes);
    setReponse('');
    try {
      const response = await fetch(`${API_URL}/resumer-chapitre`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre, filiere, niveau })
      });
      const data = await response.json();
      if (response.status === 429) {
        Alert.alert(
          '⚠️ Quota journalier atteint',
          'Vous avez utilise toutes vos requetes AcademiAI pour aujourd\'hui.\n\nRevenez demain pour continuer vos recherches. 📅'
        );
        return;
      }
      if (response.status === 400) {
        Alert.alert('Donnee manquante', data.erreur || 'Verifiez vos informations');
        return;
      };
      if (!response.ok) {
        Alert.alert('Erreur serveur', data.erreur || 'Une erreur inattendue est survenue');
        return;
      }
      if (data.reponse && data.reponse.length > 0) {
        setReponse(data.reponse);
        setReponseOuverte(true);
      } else {
        Alert.alert('Reponse vide', 'AcademiAI n\'a pas pu generer de reponse. Reessayez.');
      }
    } catch (erreur) {
      Alert.alert(
        '🔌 Connexion impossible',
        'Impossible de contacter le serveur.\n\nVerifiez que :\n• Le backend est lance\n• Vous etes sur le bon reseau'
      );
    } finally {
      setChargement(false);
    }
  };

  const ameliorerNotes = async () => {
    if (!notes.trim()) {
      Alert.alert('Champ manquant', 'Veuillez entrer vos notes');
      return;
    }
    setChargement(true);
    const quota = await verifierEtDecrementerQuota();
    if (!quota.autorise) {
      Alert.alert('⚠️ Quota atteint', quota.message || 'Reessayez demain.');
      setChargement(false);
      return;
    }
    setQuotaRestant(quota.requetesRestantes);
    setReponse('');
    try {
      const response = await fetch(`${API_URL}/ameliorer-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texte: notes })
      });
      const data = await response.json();
      if (response.status === 429) {
        Alert.alert(
          '⚠️ Quota journalier atteint',
          'Vous avez utilise toutes vos requetes AcademiAI pour aujourd\'hui.\n\nRevenez demain pour continuer vos recherches. 📅'
        );
        return;
      }
      if (response.status === 400) {
        Alert.alert('Donnee manquante', data.erreur || 'Verifiez vos informations');
        return;
      }
      if (!response.ok) {
        Alert.alert('Erreur serveur', data.erreur || 'Une erreur inattendue est survenue');
        return;
      }
      if (data.reponse && data.reponse.length > 0) {
        setReponse(data.reponse);
        setReponseOuverte(true);
      } else {
        Alert.alert('Reponse vide', 'AcademiAI n\'a pas pu analyser vos notes. Reessayez.');
      }
    } catch (erreur) {
      Alert.alert(
        '🔌 Connexion impossible',
        'Impossible de contacter le serveur.\n\nVerifiez que :\n• Le backend est lance\n• Vous etes sur le bon reseau'
      );
    } finally {
      setChargement(false);
    }
  };

  const nouvelleRecherche = () => {
    setReponse('');
    setTitre('');
    setNotes('');
    setFiliere('');
    setNiveau('');
    setReponseOuverte(true);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.retourBtn}>
            <Text style={styles.retourTexte}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitre}>Mes Cours</Text>
          <View style={{ width: 70 }} />
        </View>

        <View style={styles.banniere}>
          <Text style={styles.banniereEmoji}>🤖</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.banniereTitre}>AcademiAI</Text>
            <Text style={styles.banniereTexte}>Ton assistant academique intelligent</Text>
                       {quotaRestant !== null && (
  <View style={styles.quotaContainer}>
    <Text style={styles.quotaTexte}>
      {quotaRestant > 5
        ? `✅ ${quotaRestant} requetes restantes aujourd'hui`
        : quotaRestant > 0
        ? `⚠️ Attention : ${quotaRestant} requetes restantes`
        : `❌ Quota journalier epuise`}
    </Text>
    <View style={styles.quotaBarre}>
      <View style={[
        styles.quotaProgression,
        { 
          width: `${(quotaRestant / 20) * 100}%` as any,
          backgroundColor: quotaRestant > 5 ? '#4CAF50' : quotaRestant > 0 ? '#FFC107' : '#FF5252'
        }
      ]} />
    </View>
  </View>
)}
          </View>
          <View style={styles.banniereStatut}>
            <View style={styles.pointVert} />
            <Text style={styles.banniereStatutTexte}>En ligne</Text>
          </View>
        </View>

        <View style={styles.modesContainer}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'resumer' && styles.modeBtnActif]}
            onPress={() => { setMode('resumer'); setReponse(''); }}
            activeOpacity={0.7}
          >
            <Text style={styles.modeEmoji}>🔍</Text>
            <Text style={[styles.modeTexte, mode === 'resumer' && styles.modeTexteActif]}>
              Resumer un chapitre
            </Text>
            {mode === 'resumer' && <View style={styles.modeBadge} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'ameliorer' && styles.modeBtnActif]}
            onPress={() => { setMode('ameliorer'); setReponse(''); }}
            activeOpacity={0.7}
          >
            <Text style={styles.modeEmoji}>✨</Text>
            <Text style={[styles.modeTexte, mode === 'ameliorer' && styles.modeTexteActif]}>
              Ameliorer mes notes
            </Text>
            {mode === 'ameliorer' && <View style={styles.modeBadge} />}
          </TouchableOpacity>
        </View>

        {mode === 'resumer' && (
          <View style={styles.formulaire}>
            <Text style={styles.label}>📖 Titre du chapitre *</Text>
            <TextInput
              style={styles.champ}
              placeholder="Ex: Les transistors bipolaires"
              placeholderTextColor="#4A6080"
              value={titre}
              onChangeText={setTitre}
              returnKeyType="next"
            />
            <Text style={styles.label}>🎓 Filiere (optionnel)</Text>
            <TextInput
              style={styles.champ}
              placeholder="Ex: Informatique Industrielle"
              placeholderTextColor="#4A6080"
              value={filiere}
              onChangeText={setFiliere}
              returnKeyType="next"
            />
            <Text style={styles.label}>📊 Niveau (optionnel)</Text>
            <TextInput
              style={styles.champ}
              placeholder="Ex: BTS 1"
              placeholderTextColor="#4A6080"
              value={niveau}
              onChangeText={setNiveau}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.bouton, chargement && styles.boutonDesactive]}
              onPress={resumerChapitre}
              disabled={chargement}
              activeOpacity={0.8}
            >
              <Text style={styles.texteBouton}>
                {chargement ? '⏳ Analyse en cours...' : '🔍 Generer le resume'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === 'ameliorer' && (
          <View style={styles.formulaire}>
            <Text style={styles.label}>📝 Vos notes brutes *</Text>
            <TextInput
              style={[styles.champ, styles.champMultiline]}
              placeholder="Collez ou tapez vos notes ici..."
              placeholderTextColor="#4A6080"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.bouton, chargement && styles.boutonDesactive]}
              onPress={ameliorerNotes}
              disabled={chargement}
              activeOpacity={0.8}
            >
              <Text style={styles.texteBouton}>
                {chargement ? '⏳ Analyse en cours...' : '✨ Ameliorer mes notes'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {chargement && (
          <View style={styles.chargementContainer}>
            <ActivityIndicator size="large" color="#4A90D9" />
            <Text style={styles.chargementTitre}>AcademiAI analyse votre demande</Text>
            <Text style={styles.chargementSous}>Cela peut prendre quelques secondes...</Text>
          </View>
        )}

        {reponse !== '' && (
          <View style={styles.reponseContainer}>
            <TouchableOpacity
              style={styles.reponseHeader}
              onPress={() => setReponseOuverte(!reponseOuverte)}
              activeOpacity={0.7}
            >
              <View style={styles.reponseHeaderGauche}>
                <Text style={styles.reponseEmoji}>🤖</Text>
                <Text style={styles.reponseTitre}>Reponse de AcademiAI</Text>
              </View>
              <Text style={styles.reponseChevron}>
                {reponseOuverte ? '▲ Reduire' : '▼ Agrandir'}
              </Text>
            </TouchableOpacity>
            <View style={styles.reponseDivider} />
            {reponseOuverte && (
              <ScrollView
                style={styles.reponseScroll}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                <Text style={styles.reponseTexte}>{reponse}</Text>
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.boutonNouvelle}
              onPress={nouvelleRecherche}
              activeOpacity={0.7}
            >
              <Text style={styles.texteBoutonNouvelle}>🔄 Nouvelle recherche</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 20 },
  retourBtn: { width: 70, paddingVertical: 6 },
  retourTexte: { color: '#4A90D9', fontSize: 14, fontWeight: '600' },
  headerTitre: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  banniere: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74,144,217,0.12)', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', gap: 12 },
  banniereEmoji: { fontSize: 34 },
  banniereTitre: { fontSize: 16, fontWeight: 'bold', color: '#4A90D9', marginBottom: 2 },
  banniereTexte: { fontSize: 12, color: '#8BA4C4' },
  banniereStatut: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pointVert: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  banniereStatutTexte: { fontSize: 11, color: '#4CAF50', fontWeight: '600' },
  modesContainer: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  modeBtn: { flex: 1, paddingVertical: 14, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', gap: 6, position: 'relative' },
  modeBtnActif: { backgroundColor: 'rgba(74,144,217,0.18)', borderColor: '#4A90D9' },
  modeBadge: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 3, backgroundColor: '#4A90D9', borderRadius: 3 },
  modeEmoji: { fontSize: 22 },
  modeTexte: { color: '#8BA4C4', fontWeight: '600', fontSize: 12, textAlign: 'center' },
  modeTexteActif: { color: '#4A90D9' },
  formulaire: { marginBottom: 8 },
  label: { color: '#8BA4C4', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  champ: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, color: '#FFFFFF', fontSize: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  champMultiline: { height: 160, textAlignVertical: 'top' },
  bouton: { backgroundColor: '#4A90D9', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4, elevation: 4 },
  boutonDesactive: { backgroundColor: 'rgba(74,144,217,0.35)', elevation: 0 },
  texteBouton: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  chargementContainer: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  chargementTitre: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  chargementSous: { color: '#8BA4C4', fontSize: 13 },
  reponseContainer: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)', marginTop: 16, overflow: 'hidden' },
  reponseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  reponseHeaderGauche: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reponseEmoji: { fontSize: 20 },
  reponseTitre: { color: '#4A90D9', fontWeight: 'bold', fontSize: 14 },
  reponseChevron: { color: '#4A90D9', fontSize: 12, fontWeight: '600' },
  reponseDivider: { height: 1, backgroundColor: 'rgba(74,144,217,0.2)' },
  reponseScroll: { maxHeight: 400, padding: 16 },
  reponseTexte: { color: '#C8D8EE', fontSize: 14, lineHeight: 24 },
  boutonNouvelle: { margin: 16, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(74,144,217,0.4)', alignItems: 'center', backgroundColor: 'rgba(74,144,217,0.08)' },
  texteBoutonNouvelle: { color: '#4A90D9', fontWeight: '600', fontSize: 14 },
  quotaContainer: {
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: 10,
  padding: 12,
  marginBottom: 20,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
},
quotaTexte: {
  color: '#C8D8EE',
  fontSize: 13,
  fontWeight: '600',
  marginBottom: 8,
},
quotaBarre: {
  height: 6,
  backgroundColor: 'rgba(255,255,255,0.1)',
  borderRadius: 3,
  overflow: 'hidden',
},
quotaProgression: {
  height: '100%',
  borderRadius: 3,
},
});