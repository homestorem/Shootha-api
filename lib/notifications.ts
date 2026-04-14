import { Platform } from "react-native";
import { updatePlayerExpoPushToken } from "@/lib/firestoreUserProfile";

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

/** طلب إذن الإشعارات وإرجاع رمز Expo Push (أو null) */
export async function requestNotificationPermissionAndGetToken(): Promise<string | null> {
  return getExpoPushToken();
}

/** حفظ رمز الإشعارات في Firestore للاعب */
export async function registerPlayerPushToFirestore(uid: string): Promise<void> {
  if (!uid?.trim() || uid === "guest") return;
  const token = await requestNotificationPermissionAndGetToken();
  if (!token) return;
  try {
    await updatePlayerExpoPushToken(uid, token);
  } catch (e) {
    console.warn("[PUSH] Firestore save failed:", e);
  }
}

/** Legacy Express token registration removed — يحاول حفظ الرمز في Firestore عند توفر uid */
export async function registerPushToken(_authToken: string, firebaseUid?: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const expoPushToken = await getExpoPushToken();
    if (!expoPushToken) return;
    if (firebaseUid?.trim() && firebaseUid !== "guest") {
      await updatePlayerExpoPushToken(firebaseUid, expoPushToken);
    } else if (__DEV__) {
      console.log("[PUSH] No Firebase uid — token not saved to Firestore.");
    }
  } catch (e) {
    console.warn("[PUSH] Token registration skipped:", e);
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
  } catch {
    /* optional module */
  }
}
