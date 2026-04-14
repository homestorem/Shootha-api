import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_TIME = "8:00 مساء";
export const RANDOM_MATCH_MAX_PLAYERS = 10;

/** تقسيم الحصص على اللاعبين لاحقاً | المنظم دفع الملعب كاملاً = انضمام الآخرين مجاناً */
export type RandomMatchPricingMode = "split" | "full_prepaid";

/** مباريات من مسار «إنشاء مباراة عشوائية» */
export type RandomMatchItem = {
  id: string;
  /** يُربط بحجز التطبيق عند الإنشاء من مسار المباراة العشوائية */
  bookingId?: string;
  venueId: string;
  venueName: string;
  time: string;
  date?: string;
  /** عرض مثل "3 / 10" */
  players: string;
  maxPlayers: number;
  currentCount: number;
  /** إجمالي سعر الحجز */
  totalPrice: number;
  /** حصة اللاعب الواحد عند التقسيم */
  pricePerPlayer: number;
  /** true = المنظم دفع المبلغ كاملاً، الانضمام مجاني */
  hostPaidFull: boolean;
  pricingMode: RandomMatchPricingMode;
  /** أسماء المسجلين (الأول عادة المنظم) */
  playerNames: string[];
  durationHours?: number;
  fieldSize?: string;
};

export type AddRandomMatchInput = {
  venueId: string;
  venueName: string;
  bookingId?: string;
  time?: string;
  date?: string;
  totalPrice: number;
  maxPlayers?: number;
  pricingMode: RandomMatchPricingMode;
  organizerName?: string;
  durationHours?: number;
  fieldSize?: string;
};

type RandomMatchContextValue = {
  matches: RandomMatchItem[];
  addMatch: (input: AddRandomMatchInput) => RandomMatchItem;
  /** استيراد مباراة من رابط مشاركة (جهاز المدعو) */
  importMatchFromSnapshot: (item: RandomMatchItem) => void;
  removeMatch: (id: string) => void;
  joinMatch: (matchId: string, playerName: string) => boolean;
  getMatch: (id: string) => RandomMatchItem | undefined;
};

const RandomMatchContext = createContext<RandomMatchContextValue | null>(null);

const RM_STORAGE_KEY = "shootha_random_matches_v2";

function computePricePerPlayer(total: number, max: number, mode: RandomMatchPricingMode): number {
  if (mode === "full_prepaid" || max <= 0) return 0;
  return Math.round(total / max);
}

function buildMatchItem(input: AddRandomMatchInput): RandomMatchItem {
  const max = input.maxPlayers ?? RANDOM_MATCH_MAX_PLAYERS;
  const mode = input.pricingMode;
  const pricePerPlayer = computePricePerPlayer(input.totalPrice, max, mode);
  const hostPaidFull = mode === "full_prepaid";
  const organizer = input.organizerName?.trim() || "المنظم";
  const id = `rm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    bookingId: input.bookingId,
    venueId: input.venueId,
    venueName: input.venueName,
    time: input.time ?? DEFAULT_TIME,
    date: input.date,
    players: `1 / ${max}`,
    maxPlayers: max,
    currentCount: 1,
    totalPrice: input.totalPrice,
    pricePerPlayer,
    hostPaidFull,
    pricingMode: mode,
    playerNames: [organizer],
    durationHours: input.durationHours,
    fieldSize: input.fieldSize,
  };
}

export function RandomMatchProvider({ children }: { children: ReactNode }) {
  const [matches, setMatches] = useState<RandomMatchItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(RM_STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as RandomMatchItem[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMatches(parsed);
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(RM_STORAGE_KEY, JSON.stringify(matches));
  }, [matches, hydrated]);

  const addMatch = useCallback((input: AddRandomMatchInput): RandomMatchItem => {
    const item = buildMatchItem(input);
    setMatches((prev) => [...prev, item]);
    return item;
  }, []);

  const importMatchFromSnapshot = useCallback((item: RandomMatchItem) => {
    setMatches((prev) => {
      if (prev.some((m) => m.id === item.id)) return prev;
      return [...prev, item];
    });
  }, []);

  const removeMatch = useCallback((id: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const joinMatch = useCallback((matchId: string, playerName: string): boolean => {
    let ok = false;
    setMatches((prev) =>
      prev.map((m) => {
        if (m.id !== matchId) return m;
        if (m.currentCount >= m.maxPlayers) return m;
        const name = playerName.trim() || "لاعب";
        const nextCount = m.currentCount + 1;
        ok = true;
        return {
          ...m,
          currentCount: nextCount,
          playerNames: [...m.playerNames, name],
          players: `${nextCount} / ${m.maxPlayers}`,
        };
      }),
    );
    return ok;
  }, []);

  const getMatch = useCallback(
    (id: string) => matches.find((m) => m.id === id),
    [matches],
  );

  const value: RandomMatchContextValue = {
    matches,
    addMatch,
    importMatchFromSnapshot,
    removeMatch,
    joinMatch,
    getMatch,
  };

  return (
    <RandomMatchContext.Provider value={value}>
      {children}
    </RandomMatchContext.Provider>
  );
}

export function useRandomMatch() {
  const ctx = useContext(RandomMatchContext);
  if (!ctx) throw new Error("useRandomMatch must be used within RandomMatchProvider");
  return ctx;
}
