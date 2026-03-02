import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import React from "react";
import { Colors } from "@/constants/colors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>الرئيسية</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search">
        <Icon sf={{ default: "magnifyingglass", selected: "magnifyingglass" }} />
        <Label>استكشاف</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="store">
        <Icon sf={{ default: "bag", selected: "bag.fill" }} />
        <Label>المتجر</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bookings">
        <Icon sf={{ default: "calendar", selected: "calendar" }} />
        <Label>حجوزاتي</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>حسابي</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : Colors.tabBar,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: Colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.tabBar }]} />
          ) : null,
        tabBarLabelStyle: {
          fontFamily: "Cairo_400Regular",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color, size }) => {
            const { Ionicons } = require("@expo/vector-icons");
            return <Ionicons name="home" size={size} color={color} />;
          },
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "استكشاف",
          tabBarIcon: ({ color, size }) => {
            const { Ionicons } = require("@expo/vector-icons");
            return <Ionicons name="search" size={size} color={color} />;
          },
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: "المتجر",
          tabBarIcon: ({ color, size }) => {
            const { Ionicons } = require("@expo/vector-icons");
            return <Ionicons name="bag-handle" size={size} color={color} />;
          },
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "حجوزاتي",
          tabBarIcon: ({ color, size }) => {
            const { Ionicons } = require("@expo/vector-icons");
            return <Ionicons name="calendar" size={size} color={color} />;
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "حسابي",
          tabBarIcon: ({ color, size }) => {
            const { Ionicons } = require("@expo/vector-icons");
            return <Ionicons name="person" size={size} color={color} />;
          },
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
