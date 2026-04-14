import {
  addDoc,
  collection,
  doc,
  getDoc,
  query,
  serverTimestamp,
  where,
  getDocs,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";

export type PaymentInvoiceInput = {
  bookingId: string;
  userId: string;
  venueName: string;
  amount: number;
  currency?: string;
  transactionId?: string;
  category?: "booking" | "purchase" | "match";
};

export async function generatePaymentInvoice(
  input: PaymentInvoiceInput,
): Promise<{ invoiceId: string }> {
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, "paymentInvoices"), {
    bookingId: input.bookingId,
    userId: input.userId,
    venueName: input.venueName,
    amount: Math.round(Number(input.amount)),
    currency: input.currency || "IQD",
    transactionId: input.transactionId || null,
    category: input.category || "booking",
    createdAt: serverTimestamp(),
  });
  return { invoiceId: ref.id };
}

export type PaymentInvoiceDetails = {
  invoiceId: string;
  bookingId: string;
  venueName: string;
  amount: number;
  currency: string;
  transactionId: string;
  createdAtIso: string;
  bookingDate: string;
  bookingTime: string;
  playerName: string;
  ownerPhone: string;
  category: "booking" | "purchase" | "match";
};

export async function getPaymentInvoiceDetails(
  invoiceId: string,
): Promise<PaymentInvoiceDetails> {
  const db = getFirestoreDb();
  const invoiceRef = doc(db, "paymentInvoices", invoiceId);
  const invoiceSnap = await getDoc(invoiceRef);
  if (!invoiceSnap.exists()) {
    throw new Error("Invoice not found");
  }
  const inv = invoiceSnap.data() as Record<string, unknown>;
  const bookingId = String(inv.bookingId ?? "").trim();
  if (!bookingId) {
    throw new Error("Invoice has no booking reference");
  }

  const bookingSnap = await getDoc(doc(db, "bookings", bookingId));
  const booking = bookingSnap.exists()
    ? (bookingSnap.data() as Record<string, unknown>)
    : ({} as Record<string, unknown>);

  const ownerId = String(booking.ownerId ?? "").trim();
  let ownerPhone = "";
  if (ownerId) {
    const ownerDoc = await getDoc(doc(db, "users", ownerId));
    if (ownerDoc.exists()) {
      const ownerData = ownerDoc.data() as Record<string, unknown>;
      ownerPhone = String(ownerData.phone ?? "").trim();
    }
    if (!ownerPhone) {
      const q = query(collection(db, "users"), where("id", "==", ownerId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data() as Record<string, unknown>;
        ownerPhone = String(data.phone ?? "").trim();
      }
    }
  }

  const createdAtRaw = inv.createdAt as { toDate?: () => Date } | undefined;
  const createdAtIso =
    createdAtRaw && typeof createdAtRaw.toDate === "function"
      ? createdAtRaw.toDate().toISOString()
      : new Date().toISOString();

  return {
    invoiceId: invoiceSnap.id,
    bookingId,
    venueName: String(inv.venueName ?? booking.venueName ?? "Stadium booking"),
    amount: Number(inv.amount ?? booking.totalPrice ?? 0),
    currency: String(inv.currency ?? "IQD"),
    transactionId: String(inv.transactionId ?? booking.paymentTransactionId ?? ""),
    createdAtIso,
    bookingDate: String(booking.date ?? ""),
    bookingTime: String(booking.startTime ?? ""),
    playerName: String(booking.playerName ?? ""),
    ownerPhone,
    category:
      inv.category === "purchase" || inv.category === "match"
        ? inv.category
        : "booking",
  };
}
