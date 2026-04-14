import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, ReactNode, useEffect, useMemo, useState } from "react";
import { DevSettings, I18nManager, LayoutAnimation, Platform, UIManager } from "react-native";
import i18next from "@/i18n";
import { getDirectionalTextProps, isRtlLanguage } from "@/lib/i18n-helpers";
import { getPlayerLanguage, updatePlayerLanguage } from "@/lib/firestoreUserProfile";

export type Language = "ar" | "en" | "ku";
const KEY = "app_language_v1";
const MIDDLE_EAST_REGIONS = new Set([
  "IQ", "SA", "AE", "KW", "QA", "BH", "OM", "JO", "LB", "SY", "PS", "EG", "YE", "TR", "IR",
]);

function detectInitialLanguage(): Language {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || "ar-IQ";
  const normalized = locale.toLowerCase();
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("ku") || normalized.startsWith("ckb")) return "ku";
  const region = (locale.split("-")[1] || "").toUpperCase();
  if (MIDDLE_EAST_REGIONS.has(region)) return "ar";
  return "ar";
}

interface LanguageContextValue {
  language: Language;
  isReady: boolean;
  isRTL: boolean;
  textAlign: "left" | "right";
  writingDirection: "ltr" | "rtl";
  setLanguage: (lang: Language) => Promise<void>;
  setLanguageForUser: (lang: Language, userId?: string | null) => Promise<void>;
  t: (key: string, options?: Record<string, unknown>) => string;
  tWithFallback: (key: string, fallback: string, options?: Record<string, unknown>) => string;
  iconFlipStyle: { transform: { scaleX: number }[] } | undefined;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ar");
  const [isReady, setIsReady] = useState(false);
  const isRTL = isRtlLanguage(language);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const saved = (await AsyncStorage.getItem(KEY)) as Language | null;
      const initial =
        saved && ["ar", "en", "ku"].includes(saved) ? saved : detectInitialLanguage();
      setLanguageState(initial);
      await i18next.changeLanguage(initial);
      await applyRtlIfNeeded(initial);
      setIsReady(true);
    })().catch(() => {
      /* keep defaults */
      setIsReady(true);
    });
  }, []);

  useEffect(() => {
    I18nManager.allowRTL(isRTL);
  }, [isRTL]);

  const applyRtlIfNeeded = async (lang: Language) => {
    if (Platform.OS === "web") return;
    const targetRTL = isRtlLanguage(lang);
    const needsReload = I18nManager.isRTL !== targetRTL;
    I18nManager.allowRTL(targetRTL);
    I18nManager.forceRTL(targetRTL);
    if (needsReload && typeof DevSettings.reload === "function") {
      DevSettings.reload();
    }
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      isReady,
      isRTL,
      ...getDirectionalTextProps(language),
      setLanguage: async (lang: Language) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setLanguageState(lang);
        await AsyncStorage.setItem(KEY, lang);
        await i18next.changeLanguage(lang);
        await applyRtlIfNeeded(lang);
      },
      setLanguageForUser: async (lang: Language, userId?: string | null) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setLanguageState(lang);
        await Promise.all([AsyncStorage.setItem(KEY, lang), i18next.changeLanguage(lang)]);
        if (userId && userId !== "guest") {
          // لا ننتظر الشبكة حتى يكون تبديل اللغة فوريًا للمستخدم.
          void updatePlayerLanguage(userId, lang);
        }
        await applyRtlIfNeeded(lang);
      },
      t: (key: string, options?: Record<string, unknown>) => i18next.t(key, options as any),
      tWithFallback: (key: string, fallback: string, options?: Record<string, unknown>) => {
        const x = i18next.t(key, options as any);
        return x && x !== key ? x : fallback;
      },
      iconFlipStyle: isRTL ? { transform: [{ scaleX: -1 }] } : undefined,
    }),
    [language, isRTL, isReady],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}

export async function resolveCloudLanguageOrNull(userId: string): Promise<Language | null> {
  try {
    return await getPlayerLanguage(userId);
  } catch {
    return null;
  }
}
