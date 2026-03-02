import { Stack } from "expo-router";
import React from "react";

export default function ProfileStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="edit" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="support" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
