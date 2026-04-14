/**
 * دعم فني — مجموعات Firestore:
 * - `chats/{chatId}`: userId, lastMessage, lastMessageTime, lastMessageSenderType, status, userLastReadAt
 * - `chats/{chatId}/messages/{msgId}`: chatId (حقل للتوافق), senderId, senderType, text, createdAt
 *
 * قواعد الأمان: اسمح للمستخدم بقراءة/كتابة المحادثة التي userId يطابق uid فقط،
 * ورسائل senderType === "user" و senderId === uid. الردود كـ admin من لوحة تحكم أو Cloud Functions.
 */
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";

export type ChatStatus = "open" | "closed";
export type SenderType = "user" | "admin";

export type SupportChatDoc = {
  id: string;
  userId: string;
  lastMessage: string;
  lastMessageTime: Date | null;
  lastMessageSenderType: SenderType | null;
  status: ChatStatus;
  userLastReadAt: Date | null;
};

export type SupportMessage = {
  id: string;
  chatId: string;
  senderId: string;
  senderType: SenderType;
  text: string;
  createdAt: Date | null;
};

const SUPPORT_COLLECTION = "دعم والمحادثات";
const MESSAGES_SUBCOLLECTION = "messages";

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const sec = (value as { seconds?: unknown }).seconds;
    if (typeof sec === "number" && Number.isFinite(sec)) {
      const ns = (value as { nanoseconds?: unknown }).nanoseconds;
      const n = typeof ns === "number" ? ns : 0;
      return new Date(sec * 1000 + n / 1e6);
    }
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

function parseChatDoc(id: string, data: DocumentData): SupportChatDoc {
  const statusRaw = data.status;
  const status: ChatStatus =
    statusRaw === "closed" ? "closed" : "open";
  const stRaw = data.lastMessageSenderType;
  const st =
    typeof stRaw === "string" ? stRaw.trim().toLowerCase() : String(stRaw ?? "");
  const lastMessageSenderType: SenderType | null =
    st === "admin" || st === "staff" || st === "support" || st === "agent" || st === "moderator"
      ? "admin"
      : st === "user"
        ? "user"
        : null;
  return {
    id,
    userId: typeof data.userId === "string" ? data.userId : "",
    lastMessage: typeof data.lastMessage === "string" ? data.lastMessage : "",
    lastMessageTime: toDate(data.lastUpdate ?? data.lastMessageTime),
    lastMessageSenderType,
    status,
    userLastReadAt: toDate(data.userLastReadAt),
  };
}

function parseMessageDoc(
  chatId: string,
  id: string,
  data: DocumentData,
): SupportMessage {
  const stRaw = data.type ?? data.senderType;
  const st =
    typeof stRaw === "string" ? stRaw.trim().toLowerCase() : String(stRaw ?? "");
  const senderType: SenderType =
    st === "admin" ||
    st === "staff" ||
    st === "support" ||
    st === "agent" ||
    st === "moderator" ||
    st === "operator" ||
    st === "system"
      ? "admin"
      : "user";
  return {
    id,
    chatId: typeof data.chatId === "string" ? data.chatId : chatId,
    senderId: typeof data.senderId === "string" ? data.senderId : "",
    senderType,
    text: typeof data.text === "string" ? data.text : "",
    createdAt: toDate(data.timestamp ?? data.createdAt),
  };
}

export async function ensureSupportChatForUser(userId: string): Promise<string> {
  const db = getFirestoreDb();
  const ref = doc(db, SUPPORT_COLLECTION, userId);
  await setDoc(ref, {
    userId,
    lastMessage: "",
    lastUpdate: serverTimestamp(),
    lastMessageSenderType: null,
    status: "open",
    userLastReadAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });
  return userId;
}

export function subscribeSupportChat(
  chatId: string,
  onData: (chat: SupportChatDoc | null) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  const ref = doc(db, SUPPORT_COLLECTION, chatId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(parseChatDoc(snap.id, snap.data()));
    },
    (err) => onError?.(err as Error),
  );
}

export function subscribeSupportMessages(
  chatId: string,
  onMessages: (items: SupportMessage[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  const ref = collection(db, SUPPORT_COLLECTION, chatId, MESSAGES_SUBCOLLECTION);
  /**
   * بدون orderBy على createdAt: لوحة التحكم أو Admin SDK قد تكتب createdAt ناقصاً أو كنص،
   * وFirestore يستبعد تلك المستندات من استعلام orderBy فيختفي رد الدعم.
   */
  return onSnapshot(
    ref,
    (snap) => {
      const items: SupportMessage[] = snap.docs.map((d) =>
        parseMessageDoc(chatId, d.id, d.data()),
      );
      items.sort((a, b) => {
        const ta = a.createdAt?.getTime() ?? 0;
        const tb = b.createdAt?.getTime() ?? 0;
        if (ta !== tb) return ta - tb;
        return a.id.localeCompare(b.id);
      });
      onMessages(items);
    },
    (err) => onError?.(err as Error),
  );
}

export async function markSupportChatReadByUser(chatId: string): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, SUPPORT_COLLECTION, chatId), {
    userLastReadAt: serverTimestamp(),
  });
}

export async function sendUserSupportMessage(
  chatId: string,
  userId: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const db = getFirestoreDb();
  const messagesRef = collection(db, SUPPORT_COLLECTION, chatId, MESSAGES_SUBCOLLECTION);
  await addDoc(messagesRef, {
    chatId,
    senderId: userId,
    type: "user" as const,
    senderType: "user" as const,
    text: trimmed,
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, SUPPORT_COLLECTION, chatId), {
    userId: chatId,
    lastMessage: trimmed,
    lastUpdate: serverTimestamp(),
    lastMessageTime: serverTimestamp(),
    lastMessageSenderType: "user" as const,
    status: "open",
  }, { merge: true });
}

/** شارة غير مقروء: آخر رسالة من الدعم وأحدث من آخر قراءة للمستخدم */
export function computeUnreadSupportHint(chat: SupportChatDoc | null): boolean {
  if (!chat) return false;
  if (chat.lastMessageSenderType !== "admin") return false;
  if (!chat.lastMessageTime) return false;
  if (!chat.userLastReadAt) return true;
  return chat.lastMessageTime.getTime() > chat.userLastReadAt.getTime();
}

/**
 * مراقبة محادثة المستخدم (واحدة لكل userId) لعرض الشارة في الملف الشخصي.
 */
export function subscribeUserSupportChatByUserId(
  userId: string,
  onChat: (chat: SupportChatDoc | null) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  return onSnapshot(
    doc(db, SUPPORT_COLLECTION, userId),
    (snap) => {
      if (!snap.exists()) {
        onChat(null);
        return;
      }
      onChat(parseChatDoc(snap.id, snap.data()));
    },
    (err) => onError?.(err as Error),
  );
}
