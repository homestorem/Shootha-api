/**
 * حقول إضافية في users/{uid}: الموقع الأخير ورمز الإشعارات
 */
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import type { Language } from "@/context/LanguageContext";

export async function updatePlayerLastLocation(
  uid: string,
  lat: number,
  lon: number,
): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(
    doc(db, "users", uid),
    {
      lastKnownLat: lat,
      lastKnownLon: lon,
      locationUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function updatePlayerExpoPushToken(uid: string, token: string): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(
    doc(db, "users", uid),
    {
      expoPushToken: token,
      pushTokenUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getPlayerLanguage(uid: string): Promise<Language | null> {
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const raw = (snap.data() as Record<string, unknown>).language;
  if (raw === "ar" || raw === "en" || raw === "ku") return raw;
  return null;
}

export async function updatePlayerLanguage(uid: string, language: Language): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(
    doc(db, "users", uid),
    {
      language,
      languageUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
