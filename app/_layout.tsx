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
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { StatusBar } from "expo-status-bar";
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";

SplashScreen.preventAutoHideAsync();

const { width: W, height: H } = Dimensions.get("window");

function SplashOverlay({ onFinish }: { onFinish: () => void }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const orbitAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 12,
        stiffness: 120,
        useNativeDriver: true,
      }),
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    const spinBall = Animated.loop(
      Animated.timing(orbitAnim, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: true,
      })
    );
    const spinInner = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    spinBall.start();
    spinInner.start();

    const timer = setTimeout(() => {
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        spinBall.stop();
        spinInner.stop();
        onFinish();
      });
    }, 3000);

    return () => {
      clearTimeout(timer);
      spinBall.stop();
      spinInner.stop();
    };
  }, []);

  const orbitRadius = 72;
  const orbitRotate = orbitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const innerRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View style={[styles.splashContainer, { opacity: fadeOut }]}>
      <View style={styles.splashInner}>
        <Animated.View
          style={[
            styles.logoWrap,
            {
              opacity: fadeIn,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.logoCircle}>
            <Ionicons name="football" size={52} color={Colors.primary} />
          </View>

          <Animated.View
            style={[
              styles.orbitContainer,
              { transform: [{ rotate: orbitRotate }] },
            ]}
          >
            <View style={[styles.orbitBall, { marginLeft: orbitRadius }]}>
              <Animated.View
                style={{ transform: [{ rotate: innerRotate }] }}
              >
                <Ionicons name="football" size={18} color="#2ECC71" />
              </Animated.View>
            </View>
          </Animated.View>
        </Animated.View>

        <Animated.View style={{ opacity: fadeIn, alignItems: "center", gap: 6 }}>
          <Text style={styles.logoTitle}>Shoot'ha</Text>
          <Text style={styles.logoSubtitle}>احجز ملعبك في ثوانٍ</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.splashFooter, { opacity: fadeIn }]}>
        <Text style={styles.splashFooterText}>الموصل • العراق</Text>
      </Animated.View>
    </Animated.View>
  );
}

function AppNavigator() {
  const { isLoading, user, isGuest } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (splashDone && !isLoading) {
      if (user || isGuest) {
        router.replace("/(tabs)");
      } else {
        router.replace("/select-role");
      }
    }
  }, [splashDone, isLoading, user, isGuest]);

  const handleSplashFinish = () => {
    setShowSplash(false);
    setSplashDone(true);
  };

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="select-role" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="auth/player/login" options={{ headerShown: false, animation: "slide_from_bottom" }} />
        <Stack.Screen name="auth/player/register" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="auth/player/verify-otp" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="auth/owner/login" options={{ headerShown: false, animation: "slide_from_bottom" }} />
        <Stack.Screen name="auth/owner/register" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="auth/owner/verify-otp" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="venue/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="booking/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
      </Stack>
      {showSplash && <SplashOverlay onFinish={handleSplashFinish} />}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BookingsProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <StatusBar style="light" />
              <AppNavigator />
            </GestureHandlerRootView>
          </BookingsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "web" ? 120 : 160,
    paddingBottom: Platform.OS === "web" ? 40 : 60,
    zIndex: 999,
  },
  splashInner: {
    alignItems: "center",
    gap: 32,
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 180,
    height: 180,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(46,204,113,0.1)",
    borderWidth: 2,
    borderColor: "rgba(46,204,113,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  orbitContainer: {
    position: "absolute",
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitBall: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(46,204,113,0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(46,204,113,0.4)",
  },
  logoTitle: {
    color: Colors.text,
    fontSize: 36,
    fontFamily: "Cairo_700Bold",
    letterSpacing: -0.5,
  },
  logoSubtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: "Cairo_400Regular",
  },
  splashFooter: {
    alignItems: "center",
  },
  splashFooterText: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
  },
});
