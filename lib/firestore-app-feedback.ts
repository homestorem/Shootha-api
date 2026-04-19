import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";

export type AppFeedbackPayload = {
  userId: string;
  userName: string | null;
  phone: string | null;
  playerId: string | null;
  role: string | null;
  stars: number;
  message: string;
  platform: string;
  appVersion: string | null;
};

const COLLECTION = "appFeedback";

export async function submitAppFeedback(payload: AppFeedbackPayload): Promise<void> {
  const db = getFirestoreDb();
  const stars = Math.max(1, Math.min(5, Math.round(payload.stars)));
  const message = String(payload.message ?? "").trim();
  if (!payload.userId?.trim()) {
    throw new Error("Missing userId");
  }
  if (!message) {
    throw new Error("Message is required");
  }
  await addDoc(collection(db, COLLECTION), {
    userId: payload.userId.trim(),
    userName: (payload.userName ?? "").trim() || null,
    phone: (payload.phone ?? "").trim() || null,
    playerId: (payload.playerId ?? "").trim() || null,
    role: (payload.role ?? "").trim() || null,
    stars,
    message,
    platform: payload.platform,
    appVersion: payload.appVersion ?? null,
    createdAt: serverTimestamp(),
  });
}

