import { StyleSheet, Text, View } from 'react-native';

export default function Index(){
  return (
    <View>
      <Text style={styles.titre}>AcademiApp 🎓</Text> 
      <Text style={styles.sous}>Bienvenue sur votre assistant académique.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titre: {
   fontSize: 32,
   fontWeight: "bold",
   color: "#FFFFFF",
   marginBottom: 12,
   textAlign: "center",
  },
  sous: {
    fontSize: 16,
    color: '#8BA4C4',
    textAlign: "center",
    paddingHorizontal: 40,
  },
});