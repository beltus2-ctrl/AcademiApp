import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
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
    </Stack>
  );
}