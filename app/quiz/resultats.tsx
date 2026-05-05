import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Question {
  id: number;
  question: string;
  options: string[];
  reponseCorrecte: number;
  explication: string;
  difficulte: string;
}

const LETTRES = ['A', 'B', 'C', 'D'];

export default function Resultats() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const score = parseInt(params.score as string);
  const total = parseInt(params.total as string);
  const pourcentage = parseInt(params.pourcentage as string);
  const questions: Question[] = JSON.parse(params.questions as string);
  const reponses: number[] = JSON.parse(params.reponses as string);

  const reussi = pourcentage >= 70;

  const getEmoji = () => {
    if (pourcentage >= 90) return '🏆';
    if (pourcentage >= 70) return '🎉';
    if (pourcentage >= 50) return '😕';
    return '😞';
  };

  const getMessage = () => {
    if (pourcentage >= 90) return 'Excellent ! Maitrise parfaite !';
    if (pourcentage >= 70) return 'Bravo ! Tu as valide le quiz !';
    if (pourcentage >= 50) return 'Pas mal, mais tu peux mieux faire !';
    return 'Continue a travailler, tu vas y arriver !';
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitre}>Resultats</Text>
      </View>

      {/* Score principal */}
      <View style={[styles.scoreContainer, { borderColor: reussi ? '#4CAF50' : '#FF5252' }]}>
        <Text style={styles.scoreEmoji}>{getEmoji()}</Text>
        <Text style={[styles.scorePourcentage, { color: reussi ? '#4CAF50' : '#FF5252' }]}>
          {pourcentage}%
        </Text>
        <Text style={styles.scoreDetail}>{score} / {total} bonnes reponses</Text>
        <Text style={styles.scoreMessage}>{getMessage()}</Text>

        <View style={[styles.statutBadge, { backgroundColor: reussi ? '#4CAF5022' : '#FF525222', borderColor: reussi ? '#4CAF50' : '#FF5252' }]}>
          <Text style={[styles.statutTexte, { color: reussi ? '#4CAF50' : '#FF5252' }]}>
            {reussi ? '✅ Quiz Valide' : '❌ Quiz Echoue'}
          </Text>
        </View>
      </View>

      {/* Message selon résultat */}
      <View style={[styles.messageContainer, { borderColor: reussi ? '#4CAF5044' : '#FF525244' }]}>
        {reussi ? (
          <>
            <Text style={styles.messageTitre}>🏆 Felicitations !</Text>
            <Text style={styles.messageTexte}>
              Tu as atteint le seuil de 70%. Tu peux maintenant acceder a la banque d exercices pour approfondir tes connaissances.
            </Text>
            <TouchableOpacity style={styles.boutonExercices} activeOpacity={0.8}>
              <Text style={styles.boutonExercicesTexte}>📚 Acceder aux exercices</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.messageTitre}>💪 Ne te decourage pas !</Text>
            <Text style={styles.messageTexte}>
              Tu n as pas atteint les 70% requis. Relis bien ton cours, consulte les corrections ci-dessous et retente le quiz.
            </Text>
            <TouchableOpacity
              style={styles.boutonRecommencer}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={styles.boutonRecommencerTexte}>🔁 Recommencer le quiz</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Corrections détaillées */}
      <Text style={styles.correctionsTitre}>📖 Corrections detaillees</Text>

      {questions.map((question, index) => {
        const estCorrect = reponses[index] === question.reponseCorrecte;
        return (
          <View key={index} style={[styles.correctionItem, { borderColor: estCorrect ? '#4CAF5044' : '#FF525244' }]}>

            <View style={styles.correctionHeader}>
              <Text style={[styles.correctionStatut, { color: estCorrect ? '#4CAF50' : '#FF5252' }]}>
                {estCorrect ? '✅' : '❌'} Question {index + 1}
              </Text>
              <View style={[styles.difficulteBadge, {
                backgroundColor: question.difficulte === 'facile' ? '#4CAF5022'
                  : question.difficulte === 'intermediaire' ? '#FFC10722'
                  : question.difficulte === 'avance' ? '#FF704322' : '#FF525222',
                borderColor: question.difficulte === 'facile' ? '#4CAF50'
                  : question.difficulte === 'intermediaire' ? '#FFC107'
                  : question.difficulte === 'avance' ? '#FF7043' : '#FF5252',
              }]}>
                <Text style={[styles.difficulteTexte, {
                  color: question.difficulte === 'facile' ? '#4CAF50'
                    : question.difficulte === 'intermediaire' ? '#FFC107'
                    : question.difficulte === 'avance' ? '#FF7043' : '#FF5252',
                }]}>
                  {question.difficulte}
                </Text>
              </View>
            </View>

            <Text style={styles.correctionQuestion}>{question.question}</Text>

            {question.options.map((option, optIndex) => {
              const estLaBonneReponse = optIndex === question.reponseCorrecte;
              const estLaReponseChoisie = optIndex === reponses[index];
              let couleurFond = 'rgba(255,255,255,0.04)';
              let couleurBord = 'rgba(255,255,255,0.08)';
              let couleurTexte = '#8BA4C4';

              if (estLaBonneReponse) {
                couleurFond = 'rgba(76,175,80,0.15)';
                couleurBord = '#4CAF50';
                couleurTexte = '#4CAF50';
              } else if (estLaReponseChoisie && !estCorrect) {
                couleurFond = 'rgba(255,82,82,0.15)';
                couleurBord = '#FF5252';
                couleurTexte = '#FF5252';
              }

              return (
                <View key={optIndex} style={[styles.optionCorrection, { backgroundColor: couleurFond, borderColor: couleurBord }]}>
                  <View style={[styles.optionLettre, { backgroundColor: estLaBonneReponse ? '#4CAF50' : estLaReponseChoisie ? '#FF5252' : 'rgba(255,255,255,0.08)' }]}>
                    <Text style={styles.optionLettreTexte}>{LETTRES[optIndex]}</Text>
                  </View>
                  <Text style={[styles.optionTexte, { color: couleurTexte }]}>{option}</Text>
                  {estLaBonneReponse && <Text style={{ color: '#4CAF50', fontSize: 16 }}>✓</Text>}
                  {estLaReponseChoisie && !estCorrect && <Text style={{ color: '#FF5252', fontSize: 16 }}>✗</Text>}
                </View>
              );
            })}

            <View style={styles.explicationContainer}>
              <Text style={styles.explicationTitre}>💡 Explication</Text>
              <Text style={styles.explicationTexte}>{question.explication}</Text>
            </View>
          </View>
        );
      })}

      {/* Bouton retour */}
      <TouchableOpacity
        style={styles.boutonRetour}
        onPress={() => router.replace('/dashboard/etudiant')}
        activeOpacity={0.8}
      >
        <Text style={styles.boutonRetourTexte}>🏠 Retour au tableau de bord</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 60, paddingHorizontal: 24 },
  header: { paddingTop: 50, paddingBottom: 20, alignItems: 'center' },
  headerTitre: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  scoreContainer: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 2, marginBottom: 20, gap: 8 },
  scoreEmoji: { fontSize: 56 },
  scorePourcentage: { fontSize: 56, fontWeight: '900' },
  scoreDetail: { color: '#8BA4C4', fontSize: 16 },
  scoreMessage: { color: '#C8D8EE', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  statutBadge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, marginTop: 4 },
  statutTexte: { fontSize: 14, fontWeight: '700' },
  messageContainer: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 18, marginBottom: 24, borderWidth: 1, gap: 12 },
  messageTitre: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  messageTexte: { color: '#A8C0DC', fontSize: 14, lineHeight: 22 },
  boutonExercices: { backgroundColor: '#4CAF50', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  boutonExercicesTexte: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  boutonRecommencer: { backgroundColor: '#4A90D9', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  boutonRecommencerTexte: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  correctionsTitre: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  correctionItem: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, gap: 12 },
  correctionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  correctionStatut: { fontSize: 14, fontWeight: '700' },
  difficulteBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  difficulteTexte: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  correctionQuestion: { color: '#FFFFFF', fontSize: 14, lineHeight: 22, fontWeight: '500' },
  optionCorrection: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 10, borderWidth: 1, gap: 10 },
  optionLettre: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  optionLettreTexte: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  optionTexte: { flex: 1, fontSize: 13, lineHeight: 18 },
  explicationContainer: { backgroundColor: 'rgba(74,144,217,0.1)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(74,144,217,0.25)' },
  explicationTitre: { color: '#4A90D9', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  explicationTexte: { color: '#A8C0DC', fontSize: 13, lineHeight: 20 },
  boutonRetour: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  boutonRetourTexte: { color: '#C8D8EE', fontWeight: '600', fontSize: 14 },
});