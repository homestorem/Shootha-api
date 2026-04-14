import React, { createContext, useContext, useMemo, useState } from "react";
import type { CartLine, ProductItem } from "@/lib/firestore-marketplace";

type StoreCartState = {
  storeId: string | null;
  storeName: string | null;
  items: CartLine[];
};

type AddResult = { ok: true } | { ok: false; reason: "different_store" };

type StoreCartContextType = StoreCartState & {
  addItem: (storeId: string, storeName: string, product: ProductItem) => AddResult;
  setItemQty: (storeId: string, storeName: string, product: ProductItem, qty: number) => AddResult;
  getItemQty: (productId: string) => number;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  clearAndSetStore: (storeId: string, storeName: string) => void;
  total: number;
};

const StoreCartContext = createContext<StoreCartContextType | null>(null);

export function StoreCartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreCartState>({
    storeId: null,
    storeName: null,
    items: [],
  });

  const total = useMemo(
    () => state.items.reduce((s, i) => s + Math.round(i.price * i.qty), 0),
    [state.items],
  );

  const value = useMemo<StoreCartContextType>(
    () => ({
      ...state,
      total,
      clearAndSetStore: (storeId: string, storeName: string) => {
        setState({ storeId, storeName, items: [] });
      },
      addItem: (storeId: string, storeName: string, product: ProductItem): AddResult => {
        if (state.storeId && state.storeId !== storeId && state.items.length > 0) {
          return { ok: false, reason: "different_store" };
        }
        setState((prev) => {
          const existing = prev.items.find((x) => x.productId === product.id);
          if (existing) {
            return {
              storeId,
              storeName,
              items: prev.items.map((x) =>
                x.productId === product.id
                  ? {
                      ...x,
                      qty: x.qty + 1,
                      name: product.name,
                      category: product.category?.trim() || x.category,
                    }
                  : x,
              ),
            };
          }
          return {
            storeId,
            storeName,
            items: [
              ...prev.items,
              {
                productId: product.id,
                name: product.name,
                category: product.category?.trim() || undefined,
                price: product.price,
                qty: 1,
                image: product.images[0],
              },
            ],
          };
        });
        return { ok: true };
      },
      setItemQty: (storeId: string, storeName: string, product: ProductItem, qty: number): AddResult => {
        if (state.storeId && state.storeId !== storeId && state.items.length > 0) {
          return { ok: false, reason: "different_store" };
        }
        const safeQty = Math.max(0, Math.floor(qty));
        setState((prev) => {
          const without = prev.items.filter((x) => x.productId !== product.id);
          if (safeQty === 0) {
            if (without.length === 0) return { storeId: null, storeName: null, items: [] };
            return { ...prev, items: without };
          }
          return {
            storeId,
            storeName,
            items: [
              ...without,
              {
                productId: product.id,
                name: product.name,
                category: product.category?.trim() || undefined,
                price: product.price,
                qty: safeQty,
                image: product.images[0],
              },
            ],
          };
        });
        return { ok: true };
      },
      getItemQty: (productId: string) => state.items.find((x) => x.productId === productId)?.qty ?? 0,
      removeItem: (productId: string) => {
        setState((prev) => {
          const next = prev.items.filter((x) => x.productId !== productId);
          if (next.length === 0) return { storeId: null, storeName: null, items: [] };
          return { ...prev, items: next };
        });
      },
      clearCart: () => setState({ storeId: null, storeName: null, items: [] }),
    }),
    [state, total],
  );

  return <StoreCartContext.Provider value={value}>{children}</StoreCartContext.Provider>;
}

export function useStoreCart() {
  const ctx = useContext(StoreCartContext);
  if (!ctx) throw new Error("useStoreCart must be used within StoreCartProvider");
  return ctx;
}
