/**
 * مصادقة الهاتف عبر خادم OTP IQ + ملفات المستخدمين في Firestore (بدون Firebase Phone Auth).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  serverTimestamp,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { assertFirebaseConfigured } from "@/lib/firebaseConfig";
import { generateImmutablePlayerPublicId } from "@/lib/playerPublicId";
import { generateFriendInviteCode } from "@/lib/referral-invite-code";
import { sendOtpRequest, verifyOtpRequest } from "@/lib/otpApi";
import { setPendingFirebaseBridgeTicket } from "@/lib/firebaseBridgeTicket";
import { getResolvedApiBaseUrl } from "@/lib/devServerHost";

/** رمز دعوة الصديق — يُولَّد مرة ويُخزَّن في `inviteCode` */
function inviteCodeIfMissingPatch(existing: Record<string, unknown> | undefined): {
  inviteCode: string;
} | Record<string, never> {
  const cur =
    existing && typeof existing.inviteCode === "string"
      ? String(existing.inviteCode).trim()
      : "";
  if (cur) return {};
  return { inviteCode: generateFriendInviteCode() };
}

export async function sendPhoneOtp(phoneE164: string): Promise<void> {
  const phone = phoneE164.trim();
  await assertPhoneAllowedForPlayerApp(phone);
  await sendOtpRequest(phone);
}

export async function verifyPhoneOtp(phoneE164: string, code: string): Promise<void> {
  const phone = phoneE164.trim();
  const clean = String(code).replace(/\s/g, "");
  if (!clean) throw new Error("أدخل رمز التحقق");
  const { firebaseBridgeTicket } = await verifyOtpRequest(phone, clean);
  if (firebaseBridgeTicket) {
    setPendingFirebaseBridgeTicket(phone, firebaseBridgeTicket);
  }
}

/**
 * يمنع التداخل بين حسابات Shootha (لاعب) وShootha Business (owner/supervisor).
 */
export async function assertPhoneAllowedForPlayerApp(phoneE164: string): Promise<void> {
  const phone = String(phoneE164 ?? "").trim();
  if (!phone) return;
  const base = getResolvedApiBaseUrl();
  if (!base) return;
  try {
    const res = await fetch(`${base}/api/auth/player-access-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (res.ok) return;
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    const msg = body.message?.trim();
    throw new Error(msg || "هذا الرقم غير مسموح لتطبيق اللاعب.");
  } catch (e) {
    if (e instanceof Error) {
      const raw = e.message || "";
      const networkTimeout =
        /Network request timed out|timed out|timeout|network request failed/i.test(raw);
      if (networkTimeout) {
        throw new Error(
          `تعذر الوصول إلى خادم التحقق (${base}). تأكد أن السيرفر المحلي يعمل، والهاتف والحاسوب على نفس شبكة Wi‑Fi، واسمح للمنفذ 4001 في جدار حماية ويندوز.`,
        );
      }
      throw e;
    }
    throw new Error(`تعذر التحقق من صلاحية الرقم حالياً (${base}).`);
  }
}

export type FirestoreUserExtras = {
  name?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string | null;
  profileImage?: string | null;
  gender?: string | null;
  position?: string | null;
  /** رمز مشاركة أثناء إنشاء الحساب (اختياري) */
  shareCode?: string | null;
};

export async function isPhoneAlreadyRegistered(phoneE164: string): Promise<boolean> {
  const phone = String(phoneE164 ?? "").trim();
  if (!phone) return false;
  assertFirebaseConfigured();
  const db = getFirestoreDb();
  const byId = await getDoc(doc(db, "users", phone));
  if (byId.exists()) return true;
  const q = query(collection(db, "users"), where("phone", "==", phone), limit(1));
  const snap = await getDocs(q);
  return !snap.empty;
}

function profilePayload(extras?: FirestoreUserExtras): Record<string, unknown> {
  return {
    ...(extras?.name != null && extras.name !== "" ? { name: extras.name } : {}),
    ...(extras?.email != null && extras.email !== "" ? { email: extras.email } : {}),
    ...(extras?.phone != null && extras.phone !== "" ? { phone: extras.phone } : {}),
    ...(extras?.dateOfBirth != null ? { dateOfBirth: extras.dateOfBirth } : {}),
    ...(extras?.profileImage != null
      ? { profileImage: extras.profileImage, image: extras.profileImage }
      : {}),
    ...(extras?.gender != null ? { gender: extras.gender } : {}),
    ...(extras?.position != null ? { position: extras.position } : {}),
    ...(extras?.shareCode != null && String(extras.shareCode).trim() !== ""
      ? { shareCode: String(extras.shareCode).trim() }
      : {}),
  };
}

/**
 * مستند المستخدم: المعرف هو رقم E.164 (مطابق لمتطلبات المشروع).
 */
export async function ensureFirestoreUserByPhone(
  phoneE164: string,
  extras?: FirestoreUserExtras,
): Promise<void> {
  assertFirebaseConfigured();
  const db = getFirestoreDb();
  const phone = phoneE164.trim();
  const ref = doc(db, "users", phone);
  const snap = await getDoc(ref);
  const merged = profilePayload({ ...extras, phone });

  if (!snap.exists()) {
    await setDoc(ref, {
      ...merged,
      ...inviteCodeIfMissingPatch(undefined),
      phone,
      role: "player",
      playerId: generateImmutablePlayerPublicId(),
      createdAt: serverTimestamp(),
    });
    return;
  }

  const existing = snap.data() as Record<string, unknown>;
  const invitePatch = inviteCodeIfMissingPatch(existing);
  const hasPlayerId =
    typeof existing.playerId === "string" && String(existing.playerId).trim().length > 0;
  if (!hasPlayerId) {
    await setDoc(
      ref,
      {
        ...merged,
        ...invitePatch,
        playerId: generateImmutablePlayerPublicId(),
      },
      { merge: true },
    );
  } else {
    await setDoc(ref, { ...merged, ...invitePatch }, { merge: true });
  }
}

/**
 * دمج حقول الملف للمستخدم المسجّل (معرّف المستند = user.id من الجلسة).
 */
export async function mergeFirestorePlayerProfile(
  firestoreDocId: string,
  extras: FirestoreUserExtras,
): Promise<void> {
  assertFirebaseConfigured();
  const db = getFirestoreDb();
  const id = firestoreDocId.trim();
  if (!id) throw new Error("معرّف المستخدم غير صالح");
  const ref = doc(db, "users", id);
  const snap = await getDoc(ref);
  const merged = profilePayload(extras);

  if (!snap.exists()) {
    await setDoc(ref, {
      ...merged,
      ...inviteCodeIfMissingPatch(undefined),
      role: "player",
      playerId: generateImmutablePlayerPublicId(),
      createdAt: serverTimestamp(),
    });
    return;
  }

  const existing = snap.data() as Record<string, unknown>;
  const invitePatch = inviteCodeIfMissingPatch(existing);
  const hasPlayerId =
    typeof existing.playerId === "string" && String(existing.playerId).trim().length > 0;
  if (!hasPlayerId) {
    await setDoc(
      ref,
      {
        ...merged,
        ...invitePatch,
        playerId: generateImmutablePlayerPublicId(),
      },
      { merge: true },
    );
  } else {
    await setDoc(ref, { ...merged, ...invitePatch }, { merge: true });
  }
}

export async function buildAuthUserFromPhone(
  phoneE164: string,
  fallback?: { name?: string; email?: string },
): Promise<{
  id: string;
  playerId: string;
  name: string;
  email: string;
  phone: string;
  role: "player";
  dateOfBirth?: string | null;
  profileImage?: string | null;
  gender?: string | null;
  position?: string | null;
  /** رمز دعوة صديق — من Firestore */
  inviteCode?: string | null;
}> {
  assertFirebaseConfigured();
  const phone = phoneE164.trim();
  const db = getFirestoreDb();

  let docSnap = await getDoc(doc(db, "users", phone));
  let docId = phone;

  if (!docSnap.exists()) {
    const q = query(collection(db, "users"), where("phone", "==", phone), limit(10));
    const qs = await getDocs(q);
    if (qs.empty) {
      throw new Error("لم يُعثر على حساب لهذا الرقم");
    }
    const pickBest = (
      docs: QueryDocumentSnapshot[],
    ): QueryDocumentSnapshot => {
      const scored = docs.map((d) => {
        const x = d.data() as Record<string, unknown>;
        const role = typeof x.role === "string" ? x.role.trim().toLowerCase() : "";
        const hasName = typeof x.name === "string" && x.name.trim().length > 0;
        const hasPlayerId = typeof x.playerId === "string" && x.playerId.trim().length > 0;
        const hasDob = typeof x.dateOfBirth === "string" && x.dateOfBirth.trim().length > 0;
        const hasImage =
          (typeof x.profileImage === "string" && x.profileImage.trim().length > 0) ||
          (typeof x.image === "string" && x.image.trim().length > 0);
        // نفضّل حساب اللاعب المكتمل لتفادي الدخول بمستند قديم/ناقص لنفس الرقم.
        const score =
          (role === "player" ? 100 : 0) +
          (hasName ? 30 : 0) +
          (hasPlayerId ? 20 : 0) +
          (hasDob ? 5 : 0) +
          (hasImage ? 5 : 0);
        return { d, score };
      });
      scored.sort((a, b) => b.score - a.score || b.d.id.localeCompare(a.d.id));
      return scored[0].d;
    };
    docSnap = pickBest(qs.docs);
    docId = docSnap.id;
  }

  const data = docSnap.data() as Record<string, unknown>;
  const name =
    (typeof data?.name === "string" && data.name) ||
    fallback?.name ||
    "لاعب";
  const email =
    (typeof data?.email === "string" && data.email) ||
    fallback?.email ||
    "";
  const playerId =
    typeof data?.playerId === "string" && String(data.playerId).trim()
      ? String(data.playerId).trim()
      : "";
  const inviteCodeRaw =
    typeof data?.inviteCode === "string" ? String(data.inviteCode).trim() : "";

  return {
    id: docId,
    playerId,
    name,
    email,
    phone: (typeof data?.phone === "string" && data.phone) || phone,
    role: "player" as const,
    dateOfBirth:
      typeof data?.dateOfBirth === "string" ? data.dateOfBirth : null,
    profileImage:
      typeof data?.profileImage === "string"
        ? data.profileImage
        : typeof data?.image === "string"
          ? data.image
          : null,
    gender: typeof data?.gender === "string" ? data.gender : null,
    position: typeof data?.position === "string" ? data.position : null,
    inviteCode: inviteCodeRaw || null,
  };
}
