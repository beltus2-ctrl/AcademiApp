import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { verifierEtDecrementerQuota } from '../../utils/quota';
import { API_URL } from '../../utils/config';

export default function Recommandations() {
  const router = useRouter();
  const [recommandations, setRecommandations] = useState('');
  const [chargement, setChargement] = useState(false);
  const [profil, setProfil] = useState<any>(null);
  const [progression, setProgression] = useState<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { chargerEtAnalyser(); }, []);

  const chargerEtAnalyser = async () => {
    const utilisateur = auth.currentUser;
    if (!utilisateur) return;
    setChargement(true);
    try {
      const pSnap = await getDoc(doc(db, 'utilisateurs', utilisateur.uid));
      const progSnap = await getDoc(doc(db, 'progression', utilisateur.uid));
      const p = pSnap.data(); const prog = progSnap.data();
      setProfil(p); setProgression(prog);
      const quota = await verifierEtDecrementerQuota();
      if (!quota.autorise) { setRecommandations('Quota journalier atteint. Revenez demain !'); setChargement(false); return; }
      const xpTotal = Object.values(prog?.xp || {}).reduce((a:any,b:any)=>a+(b||0),0);
      const scores = Object.entries(prog?.scores || {}).map(([k,v])=>`${k}: ${v}%`).join(', ');
      const niveaux = prog?.niveauxDebloques?.join(', ') || 'facile';
      const response = await fetch(`${API_URL}/recommandations-ia`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ nom: p?.nom, xpTotal, scores, niveaux })
      });
      const data = await response.json();
      setRecommandations(data.recommandations || 'Impossible de generer les recommandations.');
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    } catch(e) {
      setRecommandations('Connexion impossible. Verifiez que le backend est lance.');
    } finally { setChargement(false); }
  };

  return (
    <ScrollView contentContainerStyle={{flexGrow:1,paddingBottom:60,paddingHorizontal:24}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:50,paddingBottom:20}}>
        <TouchableOpacity onPress={()=>router.back()}>
          <Text style={{color:'#4A90D9',fontSize:14,fontWeight:'600'}}>← Retour</Text>
        </TouchableOpacity>
        <Text style={{fontSize:18,fontWeight:'bold',color:'#FFFFFF'}}>Recommandations IA</Text>
        <View style={{width:70}} />
      </View>
      <View style={{backgroundColor:'rgba(171,71,188,0.1)',borderRadius:16,padding:18,marginBottom:20,borderWidth:1,borderColor:'rgba(171,71,188,0.3)',flexDirection:'row',alignItems:'center',gap:12}}>
        <Text style={{fontSize:32}}>🎯</Text>
        <View style={{flex:1}}>
          <Text style={{color:'#AB47BC',fontSize:15,fontWeight:'800',marginBottom:3}}>Pour {profil?.nom?.split(' ')[0] || 'toi'}</Text>
          <Text style={{color:'#A8C0DC',fontSize:12}}>Analyse personnalisee de votre profil academique</Text>
        </View>
      </View>
      {chargement ? (
        <View style={{alignItems:'center',paddingTop:60,gap:16}}>
          <ActivityIndicator size="large" color="#AB47BC" />
          <Text style={{color:'#8BA4C4',fontSize:14}}>AcademiAI analyse votre profil...</Text>
        </View>
      ) : (
        <Animated.View style={{opacity:fadeAnim}}>
          <View style={{backgroundColor:'rgba(255,255,255,0.05)',borderRadius:16,padding:18,borderWidth:1,borderColor:'rgba(255,255,255,0.08)',marginBottom:16}}>
            <Text style={{color:'#AB47BC',fontSize:14,fontWeight:'700',marginBottom:10}}>🤖 Analyse AcademiAI</Text>
            <Text style={{color:'#C8D8EE',fontSize:14,lineHeight:24}}>{recommandations}</Text>
          </View>
          <TouchableOpacity onPress={chargerEtAnalyser} style={{backgroundColor:'#AB47BC',borderRadius:12,padding:14,alignItems:'center'}}>
            <Text style={{color:'#FFFFFF',fontWeight:'700',fontSize:14}}>🔄 Regenerer les recommandations</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ScrollView>
  );
}
