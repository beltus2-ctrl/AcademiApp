import { Stack } from 'expo-router';
import { LogBox } from "react-native";
import { SafeAreaProvider } from 'react-native-safe-area-context';
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested',
  'Unable to activate keep awake',
]);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor: '#0F2044',
            paddingHorizontal: 24,
            flex: 1,
          }
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="inscription" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard/etudiant" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard/professeur" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard/admin" options={{ headerShown: false }} />
        <Stack.Screen name="cours/index" options={{ headerShown: false }} />
        <Stack.Screen name="quiz/index" options={{ headerShown: false }} />
        <Stack.Screen name="quiz/resultats" options={{ headerShown: false }} />
        <Stack.Screen name="exercices/index" options={{ headerShown: false }} />
        <Stack.Screen name="exercices/exercice" options={{ headerShown: false }} />
        <Stack.Screen name="chat/index" options={{ headerShown: false }} />
        <Stack.Screen name="chat/communautaire" options={{ headerShown: false }} />
        <Stack.Screen name="chat/professeur" options={{ headerShown: false }} />
        <Stack.Screen name="examens/index" options={{ headerShown: false }} />
        <Stack.Screen name="examens/simulation" options={{ headerShown: false }} />
        <Stack.Screen name="examens/planning" options={{ headerShown: false }} />
        <Stack.Screen name="prof/chats" options={{ headerShown: false }} />
        <Stack.Screen name="prof/chat-room" options={{ headerShown: false }} />
        <Stack.Screen name="prof/salon-corrections" options={{ headerShown: false }} />
        <Stack.Screen name="corrections/index" options={{ headerShown: false }} />
        <Stack.Screen name="ia/index" options={{ headerShown: false }} />
        <Stack.Screen name="ia/tuteur" options={{ headerShown: false }} />
        <Stack.Screen name="ia/progression" options={{ headerShown: false }} />
        <Stack.Screen name="badges/index" options={{ headerShown: false }} />
        <Stack.Screen name="prof/progression-eleves" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
