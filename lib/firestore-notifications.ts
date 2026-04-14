/**
 * إشعارات المستخدم — مجموعة `notifications`:
 * - userId (string): غالباً **معرّف اللاعب القصير** (مثل HEK7XQTR = `AuthUser.playerId`)،
 *   وقد يُخزَّن أحياناً **Firebase uid**؛ التطبيق يجلب بالاثنين ويدمج النتائج.
 * - channel, title, message, read, createdAt, imageUrl — كما في لوحة التحكم
 *
 * فهرس مركّب (اختياري): userId + createdAt desc
 */
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
  type DocumentData,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import type { UserRole } from "@/context/AuthContext";

const COLLECTION = "notifications";
const DEFAULT_CHANNEL_APP = "user_app";

/** لمزامنة الشارة في الهيدر مع نفس بيانات صفحة الإشعارات */
export const IN_APP_NOTIFICATIONS_QUERY_KEY = "in-app-notifications" as const;

export function getInAppNotificationsQueryKey(
  authUid: string | undefined,
  playerId: string | undefined,
  role: string | undefined,
) {
  return [IN_APP_NOTIFICATIONS_QUERY_KEY, authUid, playerId, role] as const;
}

export type InAppNotification = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  icon: string;
  createdAt: Date;
  channel: string | null;
  /** مطابقة حقل read في Firestore */
  readOnServer: boolean;
};

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date();
}

function pickImageUrl(data: DocumentData): string | null {
  const keys = ["imageUrl", "image", "photoUrl", "thumbnailUrl"] as const;
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "string" && v.trim().startsWith("http")) return v.trim();
  }
  return null;
}

function channelAllowed(channel: unknown, role: UserRole): boolean {
  const ch = typeof channel === "string" ? channel.trim() : "";
  if (!ch) return true;
  if (role === "supervisor") {
    return ["user_app", "supervisor_app", "admin_app", DEFAULT_CHANNEL_APP].includes(ch);
  }
  if (role === "player") {
    return ch === DEFAULT_CHANNEL_APP || ch === "user_app";
  }
  return ch === DEFAULT_CHANNEL_APP || ch === "user_app";
}

function iconForChannel(channel: string | null): string {
  if (channel === "supervisor_app") return "shield-checkmark-outline";
  if (channel === "admin_app") return "settings-outline";
  return "notifications-outline";
}

function parseUserNotificationDoc(id: string, data: DocumentData): InAppNotification | null {
  const title = String(data.title ?? "").trim();
  const body = String(data.message ?? data.body ?? "").trim();
  if (!title && !body) return null;

  const readRaw = data.read;
  const readOnServer = readRaw === true;

  const ch = typeof data.channel === "string" ? data.channel.trim() : null;

  return {
    id,
    title: title || "إشعار",
    body,
    imageUrl: pickImageUrl(data),
    icon: typeof data.icon === "string" && data.icon.trim() ? data.icon.trim() : iconForChannel(ch),
    createdAt: toDate(data.createdAt),
    channel: ch,
    readOnServer,
  };
}

async function fetchNotificationsForUserIdValue(
  userIdValue: string,
  role: UserRole,
): Promise<InAppNotification[]> {
  const db = getFirestoreDb();
  const batch: InAppNotification[] = [];

  let usedOrderBy = false;
  let snap;
  try {
    snap = await getDocs(
      query(
        collection(db, COLLECTION),
        where("userId", "==", userIdValue),
        orderBy("createdAt", "desc"),
        limit(80),
      ),
    );
    usedOrderBy = true;
  } catch (e) {
    console.warn("[notifications] ordered query failed, using simple query:", e);
    try {
      snap = await getDocs(
        query(collection(db, COLLECTION), where("userId", "==", userIdValue), limit(80)),
      );
    } catch (e2) {
      console.warn("[notifications] fetch failed:", e2);
      return batch;
    }
    usedOrderBy = false;
  }

  snap.forEach((d) => {
    const n = parseUserNotificationDoc(d.id, d.data());
    if (n && channelAllowed(n.channel, role)) batch.push(n);
  });

  if (!usedOrderBy) {
    batch.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  return batch;
}

/**
 * @param authUid معرّف Firebase (مستخدم في بعض السجلات)
 * @param appPlayerId المعرف القصير للاعب في التطبيق — غالباً ما يُطابق حقل `userId` في الوثيقة
 */
export async function fetchInAppNotifications(
  authUid: string,
  appPlayerId: string,
  role: UserRole,
): Promise<InAppNotification[]> {
  if (!authUid || authUid === "guest") return [];

  const idCandidates = [...new Set([authUid, appPlayerId.trim()].filter(Boolean))];
  const merged = new Map<string, InAppNotification>();

  for (const v of idCandidates) {
    const rows = await fetchNotificationsForUserIdValue(v, role);
    for (const n of rows) merged.set(n.id, n);
  }

  return [...merged.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function markUserNotificationRead(docId: string): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, COLLECTION, docId), { read: true });
}

export async function markAllUserNotificationsRead(docIds: string[]): Promise<void> {
  if (docIds.length === 0) return;
  const db = getFirestoreDb();
  const chunk = 400;
  for (let i = 0; i < docIds.length; i += chunk) {
    const batch = writeBatch(db);
    for (const id of docIds.slice(i, i + chunk)) {
      batch.update(doc(db, COLLECTION, id), { read: true });
    }
    await batch.commit();
  }
}

export function formatNotificationTimeAr(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "الآن";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "الآن";
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? "منذ دقيقة" : `منذ ${min} دقيقة`;
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? "منذ ساعة" : `منذ ${h} ساعات`;
  const d = Math.floor(h / 24);
  if (d < 7) return d === 1 ? "منذ يوم" : `منذ ${d} أيام`;
  return date.toLocaleDateString("ar-IQ", { day: "numeric", month: "short" });
}
