import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";

export type UserRole = "player" | "owner" | "guest" | "supervisor";

export type AuthUser = {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
};

export type PendingPlayerData = {
  name: string;
  phone: string;
  password: string;
  dateOfBirth?: string;
  profileImage?: string;
  userLat?: string;
  userLon?: string;
};

export type PendingOwnerData = {
  name: string;
  phone: string;
  password: string;
  venueName: string;
  areaName: string;
  fieldSize: string;
  bookingPrice: string;
  hasBathrooms: boolean;
  hasMarket: boolean;
  latitude: string;
  longitude: string;
  venueImages?: string[];
  ownerDeviceLat?: string;
  ownerDeviceLon?: string;
};

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isGuest: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, otp: string) => Promise<void>;
  register: (
    phone: string,
    name: string,
    role: UserRole,
    otp: string,
    extraData?: Record<string, string | string[] | boolean | undefined>
  ) => Promise<void>;
  sendOtp: (phone: string) => Promise<{ devOtp?: string }>;
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_TOKEN_KEY = "shootha_auth_token";
const AUTH_USER_KEY = "shootha_auth_user";
const AUTH_GUEST_KEY = "shootha_auth_guest";
export const PENDING_REG_KEY = "shootha_pending_reg";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      const [storedToken, storedUser, storedGuest] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(AUTH_USER_KEY),
        AsyncStorage.getItem(AUTH_GUEST_KEY),
      ]);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } else if (storedGuest === "true") {
        setIsGuest(true);
      }
    } catch (e) {
      console.error("Auth init error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const sendOtp = async (phone: string): Promise<{ devOtp?: string }> => {
    const res = await apiRequest("POST", "/api/auth/send-otp", { phone });
    const data = await res.json();
    return data;
  };

  const login = async (phone: string, otp: string): Promise<void> => {
    const res = await apiRequest("POST", "/api/auth/login", { phone, otp });
    const data: { token: string; user: AuthUser } = await res.json();
    await Promise.all([
      AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token),
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user)),
      AsyncStorage.removeItem(AUTH_GUEST_KEY),
    ]);
    setToken(data.token);
    setUser(data.user);
    setIsGuest(false);
  };

  const register = async (
    phone: string,
    name: string,
    role: UserRole,
    otp: string,
    extraData?: Record<string, string | string[] | boolean | undefined>
  ): Promise<void> => {
    const payload: Record<string, string | string[] | boolean | undefined> = {
      phone,
      name,
      role,
      otp,
      ...extraData,
    };
    const res = await apiRequest("POST", "/api/auth/register", payload);
    const data: { token: string; user: AuthUser } = await res.json();
    await Promise.all([
      AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token),
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user)),
      AsyncStorage.removeItem(AUTH_GUEST_KEY),
      AsyncStorage.removeItem(PENDING_REG_KEY),
    ]);
    setToken(data.token);
    setUser(data.user);
    setIsGuest(false);
  };

  const continueAsGuest = async (): Promise<void> => {
    await AsyncStorage.setItem(AUTH_GUEST_KEY, "true");
    setIsGuest(true);
    setUser(null);
    setToken(null);
  };

  const logout = async (): Promise<void> => {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(AUTH_USER_KEY),
      AsyncStorage.removeItem(AUTH_GUEST_KEY),
    ]);
    setUser(null);
    setToken(null);
    setIsGuest(false);
  };

  const isAuthenticated = !isLoading && (user !== null || isGuest);

  const value = useMemo(
    () => ({
      user,
      token,
      isGuest,
      isLoading,
      isAuthenticated,
      login,
      register,
      sendOtp,
      continueAsGuest,
      logout,
    }),
    [user, token, isGuest, isLoading, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
