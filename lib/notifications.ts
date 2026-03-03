import { Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";

async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const Notifications = await import("expo-notifications");
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (e) {
    console.warn("[PUSH] Could not get push token:", e);
    return null;
  }
}

export async function registerPushToken(authToken: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const expoPushToken = await getExpoPushToken();
    if (!expoPushToken) return;
    const url = new URL("/api/notifications/register-token", getApiUrl()).toString();
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ expoPublicToken: expoPushToken }),
    });
    console.log("[PUSH] Token registered:", expoPushToken.slice(0, 30) + "...");
  } catch (e) {
    console.warn("[PUSH] Token registration failed:", e);
  }
}

export async function setupNotificationHandler(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {}
}
