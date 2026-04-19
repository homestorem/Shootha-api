import "react-native-get-random-values";
import "@/i18n";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, router, useRootNavigationState } from "expo-router";
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
import { PostMatchRatingCoordinator } from "@/components/PostMatchRatingCoordinator";
import { RandomMatchProvider } from "@/context/RandomMatchContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import FirebaseAuthRoot from "@/components/FirebaseAuthRoot";
import { GuestPromptProvider } from "@/context/GuestPromptContext";
import { LocationProvider, useLocation } from "@/context/LocationContext";
import { registerPlayerPushToFirestore, setupNotificationHandler } from "@/lib/notifications";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { LanguageProvider, resolveCloudLanguageOrNull, useLang } from "@/context/LanguageContext";
import { StoreCartProvider } from "@/context/StoreCartContext";
import { StatusBar } from "expo-status-bar";
import { AppState, Platform, View } from "react-native";
import { AnimatedLogoSplash } from "@/components/AnimatedLogoSplash";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  installGlobalErrorHandlers,
  logStartupEnvironment,
  validateStartupConfig,
} from "@/lib/startupDiagnostics";
import { getFirebaseApp } from "@/lib/firebase";

SplashScreen.preventAutoHideAsync().catch((error) => {
  console.error("[startup] SplashScreen.preventAutoHideAsync failed", error);
});

function AppNavigator() {
  const rootNav = useRootNavigationState();
  const { isLoading, user } = useAuth();
  const { setLanguageForUser } = useLang();
  const { requestLocation } = useLocation();
  const userId = user?.id;
  const userRole = user?.role;
  /** يتغيّر عند تسجيل الدخول/الخروج — لا نستخدم hasRedirected لمرة واحدة فقط لأنه يمنع التوجيه بعد logout */
  const lastRoutedUserId = useRef<string | undefined>("__boot__");

  useEffect(() => {
    /** بدون مفتاح الجذر، router.replace قد يُسقط التطبيق في الإصدار (release) */
    if (!rootNav?.key) return;
    if (isLoading) return;
    const uid = user?.id;
    if (lastRoutedUserId.current === uid) return;
    lastRoutedUserId.current = uid;

    if (user) {
      router.replace("/(tabs)");
    } else {
      router.replace("/auth/player/login");
    }
  }, [rootNav?.key, isLoading, user]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!user || user.role !== "player" || user.id === "guest") return;

    (async () => {
      try {
        await registerPlayerPushToFirestore({ id: user.id, phone: user.phone });
        await requestLocation();
      } catch (error) {
        console.error("[startup] failed post-login init", error);
      }
    })();
  }, [user, requestLocation]);

  /** إعادة تسجيل التوكن عند العودة للتطبيق (مثلاً بعد منح الإذن من الإعدادات) */
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (!user || user.role !== "player" || user.id === "guest") return;
      void registerPlayerPushToFirestore({ id: user.id, phone: user.phone });
    });
    return () => sub.remove();
  }, [user]);

  useEffect(() => {
    if (!userId || userId === "guest" || userRole !== "player") return;
    (async () => {
      try {
        const cloud = await resolveCloudLanguageOrNull(userId);
        if (cloud) {
          await setLanguageForUser(cloud, userId);
        }
      } catch (error) {
        console.error("[startup] language sync failed", error);
      }
    })();
  }, [userId, userRole, setLanguageForUser]);

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
  useEffect(() => {
    installGlobalErrorHandlers();
    logStartupEnvironment();
    if (Platform.OS !== "web") {
      void setupNotificationHandler();
    }

    const configErrors = validateStartupConfig();
    if (configErrors.length > 0) {
      const message = configErrors.join(" | ");
      console.error("[startup] preflight failed", message);
      console.warn(
        "[startup] App will continue. Verify EXPO_PUBLIC_FIREBASE_* in EAS if Firebase features fail.",
      );
    }

    try {
      getFirebaseApp();
      console.log("[startup] Firebase initialized successfully");
    } catch (error) {
      console.error("[startup] Firebase initialization failed", error);
    }
  }, []);

  const fontsReady = fontsLoaded || !!fontError;

  /** إخفاء السبلاش الأصلي بعد جاهزية الخطوط لتفادي تعارض مع الإقلاع على أندرويد */
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!fontsReady) return;
    void SplashScreen.hideAsync();
  }, [fontsReady]);

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
        <View style={{ flex: 1, backgroundColor: "#228B22" }}>
          {fontsReady ? (
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
                                <PostMatchRatingCoordinator />
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
          ) : null}
          {Platform.OS !== "web" && !splashIntroDone ? (
            <AnimatedLogoSplash onComplete={() => setSplashIntroDone(true)} />
          ) : null}
        </View>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
