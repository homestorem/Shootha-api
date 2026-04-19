import { Platform } from "react-native";
import Constants from "expo-constants";
import { updatePlayerExpoPushToken } from "@/lib/firestoreUserProfile";
import { isValidIqMobileE164 } from "@/lib/phoneE164";

export type PushUserRef = {
  id: string;
  phone?: string | null;
};

/** معرّف مستند `users/{docId}` — يفضّل E.164 العراقي إن وُجد */
export function resolveFirestoreUserDocIdForPush(user: PushUserRef): string | null {
  const phone = String(user.phone ?? "").trim();
  if (phone && isValidIqMobileE164(phone)) return phone;
  const id = String(user.id ?? "").trim();
  if (id && isValidIqMobileE164(id)) return id;
  if (id && id !== "guest") return id;
  return null;
}

function getEasProjectId(): string | undefined {
  const fromExtra =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (fromExtra) return fromExtra;
  const legacy = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig
    ?.projectId;
  return legacy;
}

async function ensureAndroidDefaultChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const Notifications = await import("expo-notifications");
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      enableVibrate: true,
      showBadge: true,
      vibrationPattern: [0, 250, 250, 250],
    });
  } catch (e) {
    console.warn("[PUSH] Android channel setup failed:", e);
  }
}

async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const Notifications = await import("expo-notifications");
    await ensureAndroidDefaultChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    const projectId = getEasProjectId();
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
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

let lastPushRegistrationSuccessKey = "";

/** حفظ رمز الإشعارات في Firestore للاعب */
export async function registerPlayerPushToFirestore(user: PushUserRef): Promise<void> {
  const uid = resolveFirestoreUserDocIdForPush(user);
  if (!uid) return;

  const token = await requestNotificationPermissionAndGetToken();
  if (!token) return;

  const dedupeKey = `${uid}:${token}`;
  if (lastPushRegistrationSuccessKey === dedupeKey) return;

  try {
    await updatePlayerExpoPushToken(uid, token);
    lastPushRegistrationSuccessKey = dedupeKey;
  } catch (e) {
    console.warn("[PUSH] Firestore save failed:", e);
  }
}

/** Legacy: حفظ التوكن في Firestore عند توفر مرجع المستخدم */
export async function registerPushToken(
  _authToken: string,
  userRef?: PushUserRef | null,
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    if (!userRef) {
      if (__DEV__) console.log("[PUSH] No user ref — token not saved to Firestore.");
      return;
    }
    await registerPlayerPushToFirestore(userRef);
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
