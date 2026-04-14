import "react-native-get-random-values";
import "@/i18n";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import {
  useFonts,
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from "@expo-google-fonts/cairo";
import { BookingsProvider } from "@/context/BookingsContext";
import { RandomMatchProvider } from "@/context/RandomMatchContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import FirebaseAuthRoot from "@/components/FirebaseAuthRoot";
import { GuestPromptProvider } from "@/context/GuestPromptContext";
import { LocationProvider, useLocation } from "@/context/LocationContext";
import { registerPlayerPushToFirestore } from "@/lib/notifications";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { LanguageProvider, resolveCloudLanguageOrNull, useLang } from "@/context/LanguageContext";
import { StoreCartProvider } from "@/context/StoreCartContext";
import { StatusBar } from "expo-status-bar";
import { Platform, Pressable, Text, View } from "react-native";
import { AnimatedLogoSplash } from "@/components/AnimatedLogoSplash";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { reloadAppAsync } from "expo";
import {
  installGlobalErrorHandlers,
  logStartupEnvironment,
  validateStartupConfig,
} from "@/lib/startupDiagnostics";

SplashScreen.preventAutoHideAsync().catch((error) => {
  console.error("[startup] SplashScreen.preventAutoHideAsync failed", error);
});

function AppNavigator() {
  const { isLoading, user } = useAuth();
  const { setLanguageForUser } = useLang();
  const { requestLocation } = useLocation();
  const hasRedirected = useRef(false);
  const promptedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (hasRedirected.current) return;

    hasRedirected.current = true;

    if (user) {
      router.replace("/(tabs)");
    } else {
      router.replace("/auth/player/login");
    }
  }, [isLoading, user]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!user || user.role !== "player" || user.id === "guest") return;
    if (promptedForUserRef.current === user.id) return;

    promptedForUserRef.current = user.id;

    (async () => {
      try {
        await registerPlayerPushToFirestore(user.id);
        await requestLocation();
      } catch (error) {
        console.error("[startup] failed post-login init", error);
      }
    })();
  }, [user, requestLocation]);

  useEffect(() => {
    if (!user || user.id === "guest" || user.role !== "player") return;
    (async () => {
      try {
        const cloud = await resolveCloudLanguageOrNull(user.id);
        if (cloud) {
          await setLanguageForUser(cloud, user.id);
        }
      } catch (error) {
        console.error("[startup] language sync failed", error);
      }
    })();
  }, [user?.id, user?.role, setLanguageForUser]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

  <Stack.Screen name="auth" options={{ headerShown: false, animation: "slide_from_right" }} />

  <Stack.Screen name="venue/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
  <Stack.Screen name="booking/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
  <Stack.Screen name="booking/pay-card" options={{ headerShown: false, animation: "slide_from_right" }} />
  <Stack.Screen name="booking/pay-wallet" options={{ headerShown: false, animation: "slide_from_right" }} />
  <Stack.Screen name="random-match-create" options={{ headerShown: false, animation: "slide_from_right" }} />
  <Stack.Screen name="random-match-join" options={{ headerShown: false, animation: "slide_from_right" }} />
  <Stack.Screen name="random-match/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
  <Stack.Screen name="random-match/join-pay" options={{ headerShown: false, animation: "slide_from_right" }} />
  <Stack.Screen name="profile" options={{ headerShown: false }} />
  <Stack.Screen name="store/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
</Stack>
    </>
  );
}

function StartupFailureScreen({ error }: { error: string }) {
  const handleRestart = async () => {
    try {
      await reloadAppAsync();
    } catch (reloadError) {
      console.error("[startup] failed to restart app", reloadError);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, backgroundColor: "#0A0A0A" }}>
      <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 12 }}>
        Startup failed
      </Text>
      <Text style={{ color: "rgba(255,255,255,0.8)", textAlign: "center", marginBottom: 24 }}>
        {error}
      </Text>
      <Pressable
        onPress={handleRestart}
        style={{
          alignSelf: "center",
          backgroundColor: "#228B22",
          paddingVertical: 12,
          paddingHorizontal: 24,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Restart app</Text>
      </Pressable>
    </View>
  );
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

function AppShell() {
  const { isRTL } = useLang();
  return (
    <GestureHandlerRootView style={{ flex: 1, direction: isRTL ? "rtl" : "ltr" }}>
      <ThemedStatusBar />
      <AppNavigator />
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });
  const [splashIntroDone, setSplashIntroDone] = useState(Platform.OS === "web");
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    installGlobalErrorHandlers();
    logStartupEnvironment();

    const configErrors = validateStartupConfig();
    if (configErrors.length > 0) {
      const message = configErrors.join(" | ");
      console.error("[startup] preflight failed", message);
      setStartupError(message);
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  if (startupError) {
    return (
      <SafeAreaProvider>
        <StartupFailureScreen error={startupError} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary
        onError={(error, stackTrace) => {
          console.error("[root-boundary] unhandled render error", {
            message: error.message,
            stack: error.stack,
            componentStack: stackTrace,
          });
        }}
      >
        <View style={{ flex: 1 }}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ThemeProvider>
                <LanguageProvider>
                  <FirebaseAuthRoot>
                    <GuestPromptProvider>
                      <LocationProvider>
                        <StoreCartProvider>
                          <BookingsProvider>
                            <RandomMatchProvider>
                              <AppShell />
                            </RandomMatchProvider>
                          </BookingsProvider>
                        </StoreCartProvider>
                      </LocationProvider>
                    </GuestPromptProvider>
                  </FirebaseAuthRoot>
                </LanguageProvider>
              </ThemeProvider>
            </AuthProvider>
          </QueryClientProvider>
          {!splashIntroDone ? (
            <AnimatedLogoSplash onComplete={() => setSplashIntroDone(true)} />
          ) : null}
        </View>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
