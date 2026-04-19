/**
 * لوحة المتصدرين — مستندات يحدّثها الخادم (Admin) بعد تقييم ما بعد المباراة.
 * المجموعة: leaderboardPlayerStats
 */
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  type Unsubscribe,
  onSnapshot,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { firebaseConfig } from "@/lib/firebaseConfig";

export type LeaderboardPlayerStat = {
  id: string;
  displayName: string;
  totalPoints: number;
  matchesRated: number;
  totalGoals: number;
};

const COL = "leaderboardPlayerStats";

function isFs(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

function mapDoc(id: string, d: Record<string, unknown>): LeaderboardPlayerStat {
  return {
    id,
    displayName: String(d.displayName ?? "").trim() || "لاعب",
    totalPoints: Math.round(Number(d.totalPoints ?? 0)) || 0,
    matchesRated: Math.round(Number(d.matchesRated ?? 0)) || 0,
    totalGoals: Math.round(Number(d.totalGoals ?? 0)) || 0,
  };
}

export async function fetchLeaderboardPlayerStats(max = 50): Promise<LeaderboardPlayerStat[]> {
  if (!isFs()) return [];
  try {
    const db = getFirestoreDb();
    const q = query(collection(db, COL), orderBy("totalPoints", "desc"), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((x) => mapDoc(x.id, x.data() as Record<string, unknown>));
  } catch (e) {
    console.warn("[leaderboard] fetch failed", e);
    return [];
  }
}

export function subscribeLeaderboardPlayerStats(
  onNext: (rows: LeaderboardPlayerStat[]) => void,
  onError?: (e: unknown) => void,
  max = 50,
): Unsubscribe {
  if (!isFs()) {
    onNext([]);
    return () => {};
  }
  const db = getFirestoreDb();
  const q = query(collection(db, COL), orderBy("totalPoints", "desc"), limit(max));
  return onSnapshot(
    q,
    (snap) => {
      onNext(snap.docs.map((x) => mapDoc(x.id, x.data() as Record<string, unknown>)));
    },
    onError,
  );
}
