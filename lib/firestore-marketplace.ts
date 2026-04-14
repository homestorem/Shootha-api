import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import type { BannerAd } from "@/constants/fallbackBannerAds";
import { normalizeBannerImageUrl, sanitizeBannerLinkUrl } from "@/lib/banner-ad-utils";

export type StoreItem = {
  id: string;
  name: string;
  logo: string;
  coverImage: string;
  category: string;
  rating: number;
  isActive: boolean;
};

export type ProductItem = {
  id: string;
  storeId: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  stock: number;
  rating: number;
  isPopular: boolean;
  createdAtMs: number;
};

export type CartLine = {
  productId: string;
  /** اسم المنتج للعرض والطلبات */
  name: string;
  category?: string;
  price: number;
  qty: number;
  image?: string;
};

export type CategoryItem = {
  id: string;
  name: string;
};

export type MarketplaceOrderSummary = {
  id: string;
  status: string;
  total: number;
  storeName: string;
  paymentMethod: string;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asNum(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export async function fetchStoreAds(): Promise<BannerAd[]> {
  try {
    const db = getFirestoreDb();
    // Source of truth: storeAds collection only.
    const storeQuery = query(collection(db, "storeAds"), where("isActive", "==", true), limit(20));
    const storeSnap = await getDocs(storeQuery);
    type RawAd = { id: string } & Record<string, unknown>;
    return storeSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as RawAd)
      .sort((a, b) => asNum(a.order) - asNum(b.order))
      .map((x) => ({
        id: x.id,
        title: asString(x.title) || "عرض مميز",
        subtitle: asString(x.subtitle) || "",
        image: normalizeBannerImageUrl(asString(x.image) || asString(x.imageUri)) || "",
        linkUrl: sanitizeBannerLinkUrl(x.linkUrl || x.link),
      }))
      .filter((x) => Boolean(x.image));
  } catch {
    return [];
  }
}

export async function fetchActiveStores(): Promise<StoreItem[]> {
  try {
    const db = getFirestoreDb();
    const q = query(collection(db, "stores"), limit(120));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const x = d.data() as Record<string, unknown>;
        const status = asString(x.status).toLowerCase();
        const isActive =
          x.isActive === true ||
          status === "active" ||
          status === "enabled" ||
          (x.isActive === undefined && !status);
        return {
          id: d.id,
          name: asString(x.name) || "متجر",
          logo: asString(x.logo),
          coverImage: asString(x.coverImage),
          category: asString(x.category) || "عام",
          rating: asNum(x.rating, 0),
          isActive,
        } as StoreItem;
      })
      .filter((x) => x.isActive)
      .sort((a, b) => b.rating - a.rating);
  } catch {
    return [];
  }
}

export async function fetchStoreById(id: string): Promise<StoreItem | null> {
  const all = await fetchActiveStores();
  return all.find((x) => x.id === id) ?? null;
}

export async function fetchProductsByStoreId(storeId: string): Promise<ProductItem[]> {
  try {
    const db = getFirestoreDb();
    // نتجنب orderBy المركّب لتقليل أعطال index في الإنتاج الأولي.
    const q = query(collection(db, "products"), where("storeId", "==", storeId), limit(120));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const x = d.data() as Record<string, unknown>;
        const status = asString(x.status).toLowerCase();
        const images = Array.isArray(x.images)
          ? x.images.map((i) => asString(i)).filter(Boolean)
          : [];
        const createdAtMs =
          typeof x.createdAt === "object" &&
          x.createdAt &&
          "toMillis" in (x.createdAt as object) &&
          typeof (x.createdAt as { toMillis?: () => number }).toMillis === "function"
            ? (x.createdAt as { toMillis: () => number }).toMillis()
            : 0;
        return {
          id: d.id,
          storeId,
          name: asString(x.name) || "منتج",
          description: asString(x.description),
          price: Math.max(0, asNum(x.price)),
          images,
          category: asString(x.category) || "عام",
          stock: Math.max(0, Math.floor(asNum(x.stock, 0))),
          rating: asNum(x.rating, 0),
          isPopular: x.isPopular === true,
          createdAtMs,
          isActive:
            x.isActive !== false &&
            status !== "inactive" &&
            status !== "disabled" &&
            status !== "draft",
        };
      })
      .filter((x) => x.isActive);
  } catch {
    return [];
  }
}

export async function fetchProductById(productId: string): Promise<ProductItem | null> {
  try {
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, "products", productId));
    if (!snap.exists()) return null;
    const x = snap.data() as Record<string, unknown>;
    const images = Array.isArray(x.images) ? x.images.map((i) => asString(i)).filter(Boolean) : [];
    const createdAtMs =
      typeof x.createdAt === "object" &&
      x.createdAt &&
      "toMillis" in (x.createdAt as object) &&
      typeof (x.createdAt as { toMillis?: () => number }).toMillis === "function"
        ? (x.createdAt as { toMillis: () => number }).toMillis()
        : 0;
    return {
      id: snap.id,
      storeId: asString(x.storeId),
      name: asString(x.name) || "منتج",
      description: asString(x.description),
      price: Math.max(0, asNum(x.price)),
      images,
      category: asString(x.category) || "عام",
      stock: Math.max(0, Math.floor(asNum(x.stock, 0))),
      rating: asNum(x.rating, 0),
      isPopular: x.isPopular === true,
      createdAtMs,
    };
  } catch {
    return null;
  }
}

export async function fetchMarketplaceCategories(): Promise<CategoryItem[]> {
  try {
    const db = getFirestoreDb();
    const snap = await getDocs(query(collection(db, "categories"), limit(120)));
    return snap.docs
      .map((d) => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: asString(x.name),
        } as CategoryItem;
      })
      .filter((x) => Boolean(x.name));
  } catch {
    return [];
  }
}

export function filterBySearch(stores: StoreItem[], products: ProductItem[], keyword: string): {
  stores: StoreItem[];
  products: ProductItem[];
} {
  const k = keyword.trim().toLowerCase();
  if (!k) return { stores, products };
  return {
    stores: stores.filter((s) => `${s.name} ${s.category}`.toLowerCase().includes(k)),
    products: products.filter((p) =>
      `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(k),
    ),
  };
}

export async function createMarketplaceOrder(input: {
  userId: string;
  storeId: string;
  storeName: string;
  items: CartLine[];
  total: number;
  paymentMethod: "cash" | "wallet" | "stripe";
  subtotal?: number;
  deliveryFee?: number;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerLocation?: { lat: number; lon: number } | null;
  notes?: string;
}): Promise<string> {
  const db = getFirestoreDb();
  const cleanItems = input.items.map((i) => {
    const productName = asString(i.name) || "منتج";
    const category = asString(i.category);
    return {
      productId: i.productId,
      productName,
      name: productName,
      ...(category ? { category } : {}),
      price: i.price,
      qty: i.qty,
      lineTotal: Math.round(i.price * i.qty),
    };
  });
  const itemsSummary = input.items
    .map((i) => {
      const label = (asString(i.name) || "منتج").trim();
      const cat = asString(i.category);
      const withCat = cat ? `${label} (${cat})` : label;
      return `${withCat} × ${i.qty}`;
    })
    .join("، ");
  const ref = await addDoc(collection(db, "orders"), {
    userId: input.userId,
    storeId: input.storeId,
    storeName: input.storeName,
    items: cleanItems,
    /** نص واحد يوضح المنتجات لسهولة القراءة في اللوحة والإشعارات */
    itemsSummary,
    subtotal: Math.round(input.subtotal ?? input.total),
    deliveryFee: Math.round(input.deliveryFee ?? 0),
    total: Math.round(input.total),
    paymentMethod: input.paymentMethod,
    customerName: asString(input.customerName),
    customerPhone: asString(input.customerPhone),
    customerAddress: asString(input.customerAddress),
    customerLocation:
      input.customerLocation && Number.isFinite(input.customerLocation.lat) && Number.isFinite(input.customerLocation.lon)
        ? { lat: input.customerLocation.lat, lon: input.customerLocation.lon }
        : null,
    notes: asString(input.notes),
    status: "pending",
    createdAt: serverTimestamp(),
  });

  await addDoc(collection(db, "payments"), {
    orderId: ref.id,
    userId: input.userId,
    storeId: input.storeId,
    amount: Math.round(input.total),
    method: input.paymentMethod,
    status: input.paymentMethod === "cash" ? "unpaid" : "pending",
    itemsSummary,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

export async function createPendingMarketplaceOrder(input: {
  userId: string;
  storeId: string;
  storeName: string;
  items: CartLine[];
  subtotal?: number;
  deliveryFee?: number;
  total: number;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerLocation?: { lat: number; lon: number } | null;
  notes?: string;
}): Promise<string> {
  const db = getFirestoreDb();
  const cleanItems = input.items.map((i) => ({
    productId: i.productId,
    productName: asString(i.name) || "منتج",
    name: asString(i.name) || "منتج",
    ...(asString(i.category) ? { category: asString(i.category) } : {}),
    price: i.price,
    qty: i.qty,
    lineTotal: Math.round(i.price * i.qty),
  }));
  const ref = await addDoc(collection(db, "orders"), {
    userId: input.userId,
    storeId: input.storeId,
    storeName: input.storeName,
    items: cleanItems,
    subtotal: Math.round(input.subtotal ?? input.total),
    deliveryFee: Math.round(input.deliveryFee ?? 0),
    total: Math.round(input.total),
    paymentMethod: "wayl",
    customerName: asString(input.customerName),
    customerPhone: asString(input.customerPhone),
    customerAddress: asString(input.customerAddress),
    customerLocation:
      input.customerLocation && Number.isFinite(input.customerLocation.lat) && Number.isFinite(input.customerLocation.lon)
        ? { lat: input.customerLocation.lat, lon: input.customerLocation.lon }
        : null,
    notes: asString(input.notes),
    status: "pending_payment",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function confirmMarketplaceOrderPayment(
  orderId: string,
  transactionId?: string,
): Promise<void> {
  const db = getFirestoreDb();
  const orderRef = doc(db, "orders", orderId);
  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) throw new Error("Order not found");
  const data = orderSnap.data() as Record<string, unknown>;
  if (String(data.status ?? "") === "paid") return;
  await addDoc(collection(db, "payments"), {
    orderId,
    userId: String(data.userId ?? ""),
    storeId: String(data.storeId ?? ""),
    amount: Math.round(Number(data.total ?? 0)),
    method: "wayl",
    status: "paid",
    transactionId: transactionId || null,
    createdAt: serverTimestamp(),
  });
  await setDoc(
    orderRef,
    {
      status: "paid",
      paymentMethod: "wayl",
      paymentTransactionId: transactionId || null,
      paidAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function failMarketplacePendingOrder(orderId: string, reason?: string): Promise<void> {
  const db = getFirestoreDb();
  const ref = doc(db, "orders", orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as Record<string, unknown>;
  if (String(data.status ?? "") !== "pending_payment") return;
  await setDoc(
    ref,
    {
      status: "payment_failed",
      paymentFailureReason: reason || "validation_failed",
      paymentFailedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function fetchMarketplaceOrderSummary(orderId: string): Promise<MarketplaceOrderSummary | null> {
  try {
    const db = getFirestoreDb();
    const ref = doc(db, "orders", orderId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const x = snap.data() as Record<string, unknown>;
    return {
      id: snap.id,
      status: asString(x.status) || "pending",
      total: Math.round(asNum(x.total, 0)),
      storeName: asString(x.storeName) || "Store",
      paymentMethod: asString(x.paymentMethod) || "unknown",
    };
  } catch {
    return null;
  }
}
