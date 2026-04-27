import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen
      name="index"
      options={{
        headerShown: false,
        contentStyle: {
          backgroundColor: "#0F2044",
          flex: 1,
          alignItems: "center",
          justifyContent: "center"

        }
      }}
      />
    </Stack>
  );
}
